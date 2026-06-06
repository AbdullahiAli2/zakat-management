-- Normalize gender enum values to lowercase (male / female)

ALTER TABLE `users` MODIFY `gender` ENUM('MALE', 'FEMALE', 'male', 'female') NULL;
UPDATE `users` SET `gender` = 'male' WHERE `gender` = 'MALE';
UPDATE `users` SET `gender` = 'female' WHERE `gender` = 'FEMALE';
ALTER TABLE `users` MODIFY `gender` ENUM('male', 'female') NULL;

ALTER TABLE `beneficiaries` MODIFY `gender` ENUM('MALE', 'FEMALE', 'male', 'female') NULL;
UPDATE `beneficiaries` SET `gender` = 'male' WHERE `gender` = 'MALE';
UPDATE `beneficiaries` SET `gender` = 'female' WHERE `gender` = 'FEMALE';
ALTER TABLE `beneficiaries` MODIFY `gender` ENUM('male', 'female') NULL;
