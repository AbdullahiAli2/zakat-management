-- MIS Professional Upgrade Migration
-- Online Zakat Payment Management Information System

-- =========================================
-- 1. USER ROLE ENUM (replace boolean flags)
-- =========================================
ALTER TABLE `users`
    ADD COLUMN `role` ENUM('SUPERUSER', 'ADMIN', 'DONOR') NOT NULL DEFAULT 'DONOR' AFTER `address`;

UPDATE `users`
SET `role` = CASE
    WHEN `is_superuser` = 1 THEN 'SUPERUSER'
    WHEN `is_admin` = 1 THEN 'ADMIN'
    ELSE 'DONOR'
END;

ALTER TABLE `users`
    DROP COLUMN `is_superuser`,
    DROP COLUMN `is_admin`,
    DROP COLUMN `is_donor`;

-- =========================================
-- 2. ZAKAT CALCULATIONS
-- =========================================
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
    PRIMARY KEY (`id`),
    INDEX `idx_zakat_calc_user_year`(`user_id`, `zakat_year`),
    CONSTRAINT `zakat_calculations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `zakat_payments`
    ADD COLUMN `calculation_id` INTEGER NULL,
    ADD CONSTRAINT `zakat_payments_calculation_id_fkey` FOREIGN KEY (`calculation_id`) REFERENCES `zakat_calculations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================
-- 3. TRANSACTIONS ENHANCEMENTS
-- =========================================
ALTER TABLE `transactions`
    ADD COLUMN `transaction_code` VARCHAR(100) NULL,
    ADD COLUMN `gateway_response` TEXT NULL;

CREATE UNIQUE INDEX `transactions_transaction_code_key` ON `transactions`(`transaction_code`);

-- =========================================
-- 4. BENEFICIARY VERIFICATION WORKFLOW
-- =========================================
ALTER TABLE `beneficiaries`
    ADD COLUMN `national_id` VARCHAR(100) NULL,
    ADD COLUMN `family_size` INTEGER NULL,
    ADD COLUMN `monthly_income` DECIMAL(15, 2) NULL,
    ADD COLUMN `status` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `verified_by` INTEGER NULL,
    ADD COLUMN `verified_at` DATETIME(3) NULL;

UPDATE `beneficiaries`
SET `status` = CASE WHEN `verified` = 1 THEN 'APPROVED' ELSE 'PENDING' END;

ALTER TABLE `beneficiaries`
    DROP COLUMN `verified`,
    ADD CONSTRAINT `beneficiaries_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================
-- 5. DISTRIBUTION WORKFLOW
-- =========================================
ALTER TABLE `distributions`
    ADD COLUMN `approved_by` INTEGER NULL,
    ADD COLUMN `approved_at` DATETIME(3) NULL,
    ADD COLUMN `completed_at` DATETIME(3) NULL,
    MODIFY COLUMN `status` ENUM('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE `distributions`
    ADD CONSTRAINT `distributions_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================
-- 6. NOTIFICATIONS
-- =========================================
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NULL,
    `message` TEXT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `idx_notifications_user`(`user_id`),
    INDEX `idx_notifications_user_read`(`user_id`, `is_read`),
    PRIMARY KEY (`id`),
    CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Legacy installs: rename body -> message if old column exists
SET @has_body := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'body'
);
SET @sql := IF(@has_body > 0,
    'ALTER TABLE `notifications` CHANGE COLUMN `body` `message` TEXT NULL, MODIFY COLUMN `title` VARCHAR(255) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =========================================
-- 7. REPORTS & BACKUPS
-- =========================================
CREATE TABLE IF NOT EXISTS `reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `report_type` VARCHAR(100) NULL,
    `generated_by` INTEGER NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    CONSTRAINT `reports_generated_by_fkey` FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `backups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `backup_name` VARCHAR(255) NULL,
    `file_path` VARCHAR(255) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    CONSTRAINT `backups_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes are managed via Prisma schema @@index directives.
