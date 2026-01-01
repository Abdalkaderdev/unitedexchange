-- Migration: Receipt Logs Table
-- Tracks all receipt generation, print, download, and email actions

CREATE TABLE IF NOT EXISTS `receipt_logs` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(36) NOT NULL UNIQUE,
  `transaction_id` INT UNSIGNED NOT NULL,
  `action` ENUM('view', 'download', 'print', 'email') NOT NULL,
  `receipt_type` ENUM('customer', 'internal') NOT NULL DEFAULT 'customer',
  `language` ENUM('en', 'ar', 'ku') NOT NULL DEFAULT 'en',
  `email_to` VARCHAR(255) NULL,
  `email_status` ENUM('pending', 'sent', 'failed') NULL,
  `email_error` TEXT NULL,
  `performed_by` INT UNSIGNED NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,

  INDEX `idx_receipt_logs_transaction` (`transaction_id`),
  INDEX `idx_receipt_logs_action` (`action`),
  INDEX `idx_receipt_logs_date` (`created_at`),
  INDEX `idx_receipt_logs_user` (`performed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
