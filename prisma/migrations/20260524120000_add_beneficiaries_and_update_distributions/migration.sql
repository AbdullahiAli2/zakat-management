-- Create beneficiaries table
CREATE TABLE `beneficiaries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(100) NULL,
    `last_name` VARCHAR(100) NULL,
    `phone` VARCHAR(50) NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `category` ENUM('POOR', 'ORPHAN', 'WIDOW', 'DISABLED', 'STUDENT', 'EMERGENCY') NOT NULL,
    `address` TEXT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add new distribution columns (nullable during migration)
ALTER TABLE `distributions`
    ADD COLUMN `beneficiary_id` INTEGER NULL,
    ADD COLUMN `distribution_type` ENUM('FOOD', 'CASH', 'MEDICAL', 'EDUCATION', 'WATER', 'EMERGENCY') NULL,
    ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `notes` TEXT NULL;

-- Migrate legacy rows: one beneficiary per existing distribution
INSERT INTO `beneficiaries` (`first_name`, `last_name`, `category`, `verified`, `created_at`)
SELECT
    CONCAT('Legacy-', d.id),
    'Beneficiary',
    d.beneficiary_category,
    true,
    d.created_at
FROM `distributions` d;

UPDATE `distributions` d
INNER JOIN `beneficiaries` b ON b.first_name = CONCAT('Legacy-', d.id)
SET
    d.beneficiary_id = b.id,
    d.distribution_type = 'CASH',
    d.status = 'COMPLETED'
WHERE d.beneficiary_id IS NULL;

-- Drop legacy column and enforce new structure
ALTER TABLE `distributions`
    DROP COLUMN `beneficiary_category`,
    MODIFY `beneficiary_id` INTEGER NOT NULL,
    MODIFY `distribution_type` ENUM('FOOD', 'CASH', 'MEDICAL', 'EDUCATION', 'WATER', 'EMERGENCY') NOT NULL,
    MODIFY `transaction_id` INTEGER NULL;

-- Add foreign keys
ALTER TABLE `distributions`
    ADD CONSTRAINT `distributions_beneficiary_id_fkey`
        FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
