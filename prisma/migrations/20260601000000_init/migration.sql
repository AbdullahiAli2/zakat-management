-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `age` INTEGER NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `country` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `role` ENUM('SUPERUSER', 'ADMIN', 'DONOR') NOT NULL DEFAULT 'DONOR',
    `avatar_url` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `idx_users_email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codename` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `permissions_codename_key`(`codename`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `groups_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_group` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `group_id` INTEGER NOT NULL,

    UNIQUE INDEX `user_group_user_id_group_id_key`(`user_id`, `group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,

    UNIQUE INDEX `group_permission_group_id_permission_id_key`(`group_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,

    UNIQUE INDEX `user_permission_user_id_permission_id_key`(`user_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nisab_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `gold_price_per_gram` DECIMAL(10, 2) NOT NULL,
    `nisab_value` DECIMAL(15, 2) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `zakat_calculations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `total_assets` DECIMAL(15, 2) NOT NULL,
    `liabilities` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `net_assets` DECIMAL(15, 2) NOT NULL,
    `nisab_value` DECIMAL(15, 2) NOT NULL,
    `zakat_due` DECIMAL(15, 2) NOT NULL,
    `zakat_year` YEAR NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_zakat_calc_user_year`(`user_id`, `zakat_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `zakat_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `account_id` INTEGER NOT NULL,
    `calculation_id` INTEGER NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `zakat_type` ENUM('MAAL', 'BUSINESS') NOT NULL,
    `method` ENUM('EVCPLUS', 'E_DAHAB', 'ZAAD', 'CASH', 'WALLET') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reference_number` VARCHAR(255) NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `nisab_checked` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_payments_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `account_id` INTEGER NULL,
    `zakat_payment_id` INTEGER NULL,
    `type` ENUM('DEPOSIT', 'ZAKAT_PAYMENT', 'DISTRIBUTION') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
    `transaction_code` VARCHAR(100) NULL,
    `reference` VARCHAR(255) NULL,
    `gateway_response` TEXT NULL,
    `description` TEXT NULL,
    `journal_entry_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `transactions_transaction_code_key`(`transaction_code`),
    INDEX `idx_transactions_user`(`user_id`),
    INDEX `idx_transactions_status`(`status`),
    INDEX `idx_transactions_journal`(`journal_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_wallets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `wallet_type` ENUM('MAIN', 'ZAKAT', 'SADAQAH', 'EMERGENCY', 'OPERATIONS') NOT NULL,
    `chart_account_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `system_wallets_code_key`(`code`),
    INDEX `idx_wallets_type`(`wallet_type`),
    INDEX `idx_wallets_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entry_number` VARCHAR(50) NOT NULL,
    `entry_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `description` TEXT NULL,
    `reference_type` ENUM('ZAKAT_PAYMENT', 'DISTRIBUTION', 'COMMUNITY_DISTRIBUTION', 'MANUAL', 'OPENING_BALANCE') NOT NULL,
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
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `beneficiaries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `phone` VARCHAR(50) NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `category` ENUM('POOR', 'ORPHAN', 'WIDOW', 'DISABLED', 'STUDENT', 'EMERGENCY') NOT NULL,
    `national_id` VARCHAR(100) NULL,
    `family_size` INTEGER NULL,
    `monthly_income` DECIMAL(15, 2) NULL,
    `address` TEXT NULL,
    `status` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `verified_by` INTEGER NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_beneficiaries_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `distributions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `beneficiary_id` INTEGER NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `transaction_id` INTEGER NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `distribution_type` ENUM('FOOD', 'CASH', 'MEDICAL', 'EDUCATION', 'WATER', 'EMERGENCY') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_distributions_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `community_distributions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `transaction_id` INTEGER NULL,
    `title` VARCHAR(255) NOT NULL,
    `distribution_type` ENUM('FOOD', 'CASH', 'MEDICAL', 'EDUCATION', 'WATER', 'EMERGENCY') NOT NULL,
    `beneficiary_count` INTEGER NOT NULL DEFAULT 0,
    `amount` DECIMAL(15, 2) NOT NULL,
    `location` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `distribution_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_community_distributions_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transaction_id` INTEGER NOT NULL,
    `receipt_number` VARCHAR(100) NOT NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `receipts_receipt_number_key`(`receipt_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NULL,
    `message` TEXT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_notifications_user`(`user_id`),
    INDEX `idx_notifications_user_read`(`user_id`, `is_read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `report_type` VARCHAR(100) NULL,
    `generated_by` INTEGER NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `backup_name` VARCHAR(255) NULL,
    `file_path` VARCHAR(255) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `path` VARCHAR(255) NULL,
    `action` TEXT NULL,
    `module` TEXT NULL,
    `operating_system` VARCHAR(200) NULL,
    `browser` VARCHAR(200) NULL,
    `ip_address` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_audits_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_group` ADD CONSTRAINT `user_group_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_group` ADD CONSTRAINT `user_group_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_permission` ADD CONSTRAINT `group_permission_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_permission` ADD CONSTRAINT `group_permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission` ADD CONSTRAINT `user_permission_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permission` ADD CONSTRAINT `user_permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zakat_calculations` ADD CONSTRAINT `zakat_calculations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zakat_payments` ADD CONSTRAINT `zakat_payments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zakat_payments` ADD CONSTRAINT `zakat_payments_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zakat_payments` ADD CONSTRAINT `zakat_payments_calculation_id_fkey` FOREIGN KEY (`calculation_id`) REFERENCES `zakat_calculations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zakat_payments` ADD CONSTRAINT `zakat_payments_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_zakat_payment_id_fkey` FOREIGN KEY (`zakat_payment_id`) REFERENCES `zakat_payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chart_of_accounts` ADD CONSTRAINT `chart_of_accounts_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_wallets` ADD CONSTRAINT `system_wallets_chart_account_id_fkey` FOREIGN KEY (`chart_account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_wallets` ADD CONSTRAINT `system_wallets_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_posted_by_fkey` FOREIGN KEY (`posted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entries` ADD CONSTRAINT `journal_entries_reversed_by_fkey` FOREIGN KEY (`reversed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_entry_lines` ADD CONSTRAINT `journal_entry_lines_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `system_wallets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `beneficiaries` ADD CONSTRAINT `beneficiaries_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributions` ADD CONSTRAINT `distributions_beneficiary_id_fkey` FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributions` ADD CONSTRAINT `distributions_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributions` ADD CONSTRAINT `distributions_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `distributions` ADD CONSTRAINT `distributions_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_distributions` ADD CONSTRAINT `community_distributions_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_distributions` ADD CONSTRAINT `community_distributions_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `community_distributions` ADD CONSTRAINT `community_distributions_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reports` ADD CONSTRAINT `reports_generated_by_fkey` FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `backups` ADD CONSTRAINT `backups_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audits` ADD CONSTRAINT `audits_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;