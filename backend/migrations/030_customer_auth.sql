-- Migration: Customer Authentication
-- Date: 2025-01-03
-- Description: Add password and auth fields to customers table

ALTER TABLE `customers`
ADD COLUMN `password` VARCHAR(255) NULL COMMENT 'bcrypt hashed',
ADD COLUMN `last_login_at` TIMESTAMP NULL,
ADD COLUMN `reset_token` VARCHAR(255) NULL,
ADD COLUMN `reset_token_expires_at` TIMESTAMP NULL;

-- Add index for auth lookups
CREATE INDEX `idx_customers_auth` ON `customers`(`email`, `is_blocked`);
