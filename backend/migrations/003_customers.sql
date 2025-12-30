-- =============================================================================
-- UNITED EXCHANGE - CUSTOMERS TABLE MIGRATION
-- Migration: 003_customers.sql
-- Description: Add customer management system with full profile support
-- =============================================================================

-- =============================================================================
-- CUSTOMERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(36) NOT NULL UNIQUE,
  `full_name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `email` VARCHAR(100) NULL,
  `id_type` ENUM('passport', 'national_id', 'driver_license', 'other') NULL,
  `id_number` VARCHAR(50) NULL,
  `id_expiry` DATE NULL,
  `address` TEXT NULL,
  `notes` TEXT NULL,
  `is_vip` BOOLEAN DEFAULT FALSE,
  `is_blocked` BOOLEAN DEFAULT FALSE,
  `block_reason` VARCHAR(255) NULL,
  `total_transactions` INT UNSIGNED DEFAULT 0,
  `total_volume` DECIMAL(18, 2) DEFAULT 0.00,
  `created_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,

  INDEX `idx_customers_uuid` (`uuid`),
  INDEX `idx_customers_phone` (`phone`),
  INDEX `idx_customers_email` (`email`),
  INDEX `idx_customers_id_number` (`id_number`),
  INDEX `idx_customers_name` (`full_name`),
  INDEX `idx_customers_vip` (`is_vip`),
  INDEX `idx_customers_blocked` (`is_blocked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- ADD CUSTOMER_ID TO TRANSACTIONS TABLE
-- =============================================================================
ALTER TABLE `transactions`
  ADD COLUMN `customer_id` INT UNSIGNED NULL AFTER `uuid`,
  ADD CONSTRAINT `fk_transactions_customer`
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`)
    ON DELETE SET NULL;

-- Add index for customer lookups
CREATE INDEX `idx_transactions_customer_id` ON `transactions`(`customer_id`);

-- =============================================================================
-- TRIGGER TO UPDATE CUSTOMER STATISTICS ON TRANSACTION INSERT
-- =============================================================================
DELIMITER //

CREATE TRIGGER IF NOT EXISTS `after_transaction_insert_customer_stats`
AFTER INSERT ON `transactions`
FOR EACH ROW
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' AND NEW.deleted_at IS NULL THEN
    UPDATE customers
    SET
      total_transactions = total_transactions + 1,
      total_volume = total_volume + NEW.amount_in
    WHERE id = NEW.customer_id;
  END IF;
END//

-- =============================================================================
-- TRIGGER TO UPDATE CUSTOMER STATISTICS ON TRANSACTION UPDATE
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS `after_transaction_update_customer_stats`
AFTER UPDATE ON `transactions`
FOR EACH ROW
BEGIN
  -- Handle customer_id change
  IF OLD.customer_id IS NOT NULL AND OLD.customer_id != COALESCE(NEW.customer_id, 0) THEN
    -- Decrement old customer stats if transaction was completed
    IF OLD.status = 'completed' AND OLD.deleted_at IS NULL THEN
      UPDATE customers
      SET
        total_transactions = GREATEST(0, total_transactions - 1),
        total_volume = GREATEST(0, total_volume - OLD.amount_in)
      WHERE id = OLD.customer_id;
    END IF;
  END IF;

  IF NEW.customer_id IS NOT NULL AND NEW.customer_id != COALESCE(OLD.customer_id, 0) THEN
    -- Increment new customer stats if transaction is completed
    IF NEW.status = 'completed' AND NEW.deleted_at IS NULL THEN
      UPDATE customers
      SET
        total_transactions = total_transactions + 1,
        total_volume = total_volume + NEW.amount_in
      WHERE id = NEW.customer_id;
    END IF;
  END IF;

  -- Handle status change for same customer
  IF NEW.customer_id IS NOT NULL AND NEW.customer_id = OLD.customer_id THEN
    -- Transaction cancelled or deleted
    IF (OLD.status = 'completed' AND NEW.status = 'cancelled') OR
       (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      UPDATE customers
      SET
        total_transactions = GREATEST(0, total_transactions - 1),
        total_volume = GREATEST(0, total_volume - OLD.amount_in)
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
END//

DELIMITER ;
