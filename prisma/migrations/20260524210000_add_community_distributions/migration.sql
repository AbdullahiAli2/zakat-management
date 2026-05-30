-- Community Distributions (mass/group NGO aid without individual beneficiaries)

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
    PRIMARY KEY (`id`),
    CONSTRAINT `community_distributions_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `community_distributions_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `community_distributions_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `journal_entries`
    MODIFY COLUMN `reference_type` ENUM('ZAKAT_PAYMENT', 'DISTRIBUTION', 'COMMUNITY_DISTRIBUTION', 'MANUAL', 'OPENING_BALANCE') NOT NULL;
