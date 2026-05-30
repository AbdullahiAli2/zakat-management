-- Enterprise Accounting Wallet Architecture Migration
-- Replaces static system_wallet with ledger-driven system_wallets

-- =========================================
-- 1. CHART OF ACCOUNTS
-- =========================================
CREATE TABLE `chart_of_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `account_type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
    `parent_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `chart_of_accounts_code_key`(`code`),
    INDEX `idx_coa_type`(`account_type`),
    PRIMARY KEY (`id`),
    CONSTRAINT `chart_of_accounts_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =========================================
-- 2. SYSTEM WALLETS (replaces system_wallet)
-- =========================================
CREATE TABLE `system_wallets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `wallet_type` ENUM('MAIN', 'ZAKAT', 'SADAQAH', 'EMERGENCY', 'OPERATIONS') NOT NULL,
    `chart_account_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `system_wallets_code_key`(`code`),
    INDEX `idx_wallets_type`(`wallet_type`),
    INDEX `idx_wallets_status`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `system_wallets_chart_account_id_fkey` FOREIGN KEY (`chart_account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `system_wallets_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =========================================
-- 3. JOURNAL ENTRIES
-- =========================================
CREATE TABLE `journal_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entry_number` VARCHAR(50) NOT NULL,
    `entry_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `description` TEXT NULL,
    `reference_type` ENUM('ZAKAT_PAYMENT', 'DISTRIBUTION', 'MANUAL', 'OPENING_BALANCE') NOT NULL,
    `reference_id` INTEGER NULL,
    `status` ENUM('POSTED', 'REVERSED') NOT NULL DEFAULT 'POSTED',
    `posted_by` INTEGER NULL,
    `posted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reversed_by` INTEGER NULL,
    `reversed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `journal_entries_entry_number_key`(`entry_number`),
    INDEX `idx_journal_ref`(`reference_type`, `reference_id`),
    INDEX `idx_journal_status`(`status`),
    PRIMARY KEY (`id`),
    CONSTRAINT `journal_entries_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `journal_entries_reversed_by_fkey` FOREIGN KEY (`reversed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =========================================
-- 4. JOURNAL ENTRY LINES
-- =========================================
CREATE TABLE `journal_entry_lines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `journal_entry_id` INTEGER NOT NULL,
    `account_id` INTEGER NOT NULL,
    `wallet_id` INTEGER NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `line_description` VARCHAR(255) NULL,
    INDEX `idx_jel_account`(`account_id`),
    INDEX `idx_jel_wallet`(`wallet_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `journal_entry_lines_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `journal_entry_lines_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `journal_entry_lines_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `system_wallets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =========================================
-- 5. LINK TRANSACTIONS TO JOURNAL
-- =========================================
ALTER TABLE `transactions`
    ADD COLUMN `journal_entry_id` INTEGER NULL,
    ADD CONSTRAINT `transactions_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `idx_transactions_journal` ON `transactions`(`journal_entry_id`);

-- =========================================
-- 6. SEED DEFAULT CHART OF ACCOUNTS
-- =========================================
INSERT INTO `chart_of_accounts` (`code`, `name`, `account_type`, `description`) VALUES
('1000', 'Main Cash & Bank', 'ASSET', 'Primary organizational cash account'),
('1010', 'Zakat Pool Cash', 'ASSET', 'Zakat collection wallet asset account'),
('1020', 'Sadaqah Pool Cash', 'ASSET', 'Sadaqah collection wallet asset account'),
('1030', 'Emergency Fund Cash', 'ASSET', 'Emergency relief wallet asset account'),
('1040', 'Operations Cash', 'ASSET', 'Operational expenses wallet asset account'),
('4000', 'Zakat Income', 'INCOME', 'Recognized zakat revenue'),
('4100', 'Sadaqah Income', 'INCOME', 'Recognized sadaqah revenue'),
('5000', 'Zakat Distribution Expense', 'EXPENSE', 'Zakat distribution to beneficiaries'),
('5100', 'Emergency Distribution Expense', 'EXPENSE', 'Emergency relief distributions'),
('5200', 'Operations Expense', 'EXPENSE', 'General operational spending');

-- =========================================
-- 7. SEED DEFAULT WALLETS
-- =========================================
INSERT INTO `system_wallets` (`code`, `name`, `wallet_type`, `chart_account_id`, `status`)
SELECT 'WAL-MAIN', 'Main Treasury Wallet', 'MAIN', id, 'ACTIVE' FROM `chart_of_accounts` WHERE `code` = '1000' LIMIT 1;

INSERT INTO `system_wallets` (`code`, `name`, `wallet_type`, `chart_account_id`, `status`)
SELECT 'WAL-ZAKAT', 'Zakat Collection Wallet', 'ZAKAT', id, 'ACTIVE' FROM `chart_of_accounts` WHERE `code` = '1010' LIMIT 1;

INSERT INTO `system_wallets` (`code`, `name`, `wallet_type`, `chart_account_id`, `status`)
SELECT 'WAL-SADAQAH', 'Sadaqah Wallet', 'SADAQAH', id, 'ACTIVE' FROM `chart_of_accounts` WHERE `code` = '1020' LIMIT 1;

INSERT INTO `system_wallets` (`code`, `name`, `wallet_type`, `chart_account_id`, `status`)
SELECT 'WAL-EMERGENCY', 'Emergency Relief Wallet', 'EMERGENCY', id, 'ACTIVE' FROM `chart_of_accounts` WHERE `code` = '1030' LIMIT 1;

INSERT INTO `system_wallets` (`code`, `name`, `wallet_type`, `chart_account_id`, `status`)
SELECT 'WAL-OPS', 'Operations Wallet', 'OPERATIONS', id, 'ACTIVE' FROM `chart_of_accounts` WHERE `code` = '1040' LIMIT 1;

-- =========================================
-- 8. DROP LEGACY STATIC WALLET TABLE
-- =========================================
DROP TABLE IF EXISTS `system_wallet`;
