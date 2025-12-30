-- =============================================================================
-- UNITED EXCHANGE - PRODUCTION DATABASE SCHEMA
-- =============================================================================
-- This schema includes:
-- - Proper DECIMAL precision for monetary values
-- - Soft deletes for transactions
-- - Login attempts tracking for rate limiting
-- - Refresh tokens table for JWT refresh strategy
-- - Enhanced audit logging
-- - Daily closing reports table
-- =============================================================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS `united_exchange`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `united_exchange`;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(36) NOT NULL UNIQUE,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL COMMENT 'bcrypt hashed, cost 12',
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
  `is_active` BOOLEAN DEFAULT TRUE,
  `password_changed_at` TIMESTAMP NULL,
  `last_login_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_users_username` (`username`),
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- REFRESH TOKENS TABLE (for JWT refresh strategy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL COMMENT 'SHA-256 hash of refresh token',
  `device_info` VARCHAR(255) NULL COMMENT 'User agent or device identifier',
  `ip_address` VARCHAR(45) NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `revoked_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_refresh_tokens_user` (`user_id`),
  INDEX `idx_refresh_tokens_hash` (`token_hash`),
  INDEX `idx_refresh_tokens_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- LOGIN ATTEMPTS TABLE (for rate limiting)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `attempted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `success` BOOLEAN DEFAULT FALSE,
  `user_agent` VARCHAR(500) NULL,

  INDEX `idx_login_attempts_username` (`username`),
  INDEX `idx_login_attempts_ip` (`ip_address`),
  INDEX `idx_login_attempts_time` (`attempted_at`),
  INDEX `idx_login_attempts_combined` (`username`, `ip_address`, `attempted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- CURRENCIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS `currencies` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(3) NOT NULL UNIQUE COMMENT 'ISO 4217 currency code',
  `name` VARCHAR(50) NOT NULL,
  `name_ar` VARCHAR(50) NULL COMMENT 'Arabic name',
  `name_ku` VARCHAR(50) NULL COMMENT 'Kurdish name',
  `symbol` VARCHAR(10) NOT NULL,
  `decimal_places` TINYINT UNSIGNED DEFAULT 2 COMMENT 'Decimal precision for this currency',
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX `idx_currencies_code` (`code`),
  INDEX `idx_currencies_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- EXCHANGE RATES TABLE
-- Uses DECIMAL(18,6) for precise rate calculations
-- =============================================================================
CREATE TABLE IF NOT EXISTS `exchange_rates` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `from_currency_id` INT UNSIGNED NOT NULL,
  `to_currency_id` INT UNSIGNED NOT NULL,
  `buy_rate` DECIMAL(18, 6) NOT NULL COMMENT 'Rate when buying from_currency',
  `sell_rate` DECIMAL(18, 6) NOT NULL COMMENT 'Rate when selling from_currency',
  `spread` DECIMAL(10, 6) GENERATED ALWAYS AS (`sell_rate` - `buy_rate`) STORED,
  `updated_by` INT UNSIGNED NOT NULL,
  `effective_from` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (`from_currency_id`) REFERENCES `currencies`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`to_currency_id`) REFERENCES `currencies`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,

  UNIQUE KEY `unique_rate_pair` (`from_currency_id`, `to_currency_id`),
  INDEX `idx_exchange_rates_currencies` (`from_currency_id`, `to_currency_id`),
  INDEX `idx_exchange_rates_updated_by` (`updated_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- EXCHANGE RATE HISTORY TABLE (audit trail for rate changes)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `exchange_rate_history` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `exchange_rate_id` INT UNSIGNED NOT NULL,
  `from_currency_id` INT UNSIGNED NOT NULL,
  `to_currency_id` INT UNSIGNED NOT NULL,
  `old_buy_rate` DECIMAL(18, 6) NULL,
  `old_sell_rate` DECIMAL(18, 6) NULL,
  `new_buy_rate` DECIMAL(18, 6) NOT NULL,
  `new_sell_rate` DECIMAL(18, 6) NOT NULL,
  `changed_by` INT UNSIGNED NOT NULL,
  `change_reason` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (`exchange_rate_id`) REFERENCES `exchange_rates`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,

  INDEX `idx_rate_history_rate` (`exchange_rate_id`),
  INDEX `idx_rate_history_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TRANSACTIONS TABLE
-- Uses DECIMAL(18,2) for monetary amounts
-- Includes soft delete support
-- =============================================================================
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(36) NOT NULL UNIQUE,
  `transaction_number` VARCHAR(20) UNIQUE COMMENT 'Human-readable transaction ID',
  `customer_name` VARCHAR(100) NOT NULL,
  `customer_phone` VARCHAR(20) NULL,
  `customer_id_type` VARCHAR(50) NULL COMMENT 'Type of ID document',
  `customer_id_number` VARCHAR(50) NULL COMMENT 'ID document number',
  `currency_in_id` INT UNSIGNED NOT NULL,
  `currency_out_id` INT UNSIGNED NOT NULL,
  `amount_in` DECIMAL(18, 2) NOT NULL COMMENT 'Amount received from customer',
  `amount_out` DECIMAL(18, 2) NOT NULL COMMENT 'Amount given to customer',
  `exchange_rate` DECIMAL(18, 6) NOT NULL COMMENT 'Applied exchange rate',
  `market_rate` DECIMAL(18, 6) NULL COMMENT 'Market rate at time of transaction',
  `profit` DECIMAL(18, 2) DEFAULT 0.00 COMMENT 'Calculated profit',
  `commission` DECIMAL(18, 2) DEFAULT 0.00 COMMENT 'Any commission charged',
  `notes` TEXT NULL,
  `employee_id` INT UNSIGNED NOT NULL,
  `transaction_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('completed', 'cancelled', 'pending') DEFAULT 'completed',
  `cancelled_by` INT UNSIGNED NULL,
  `cancelled_at` TIMESTAMP NULL,
  `cancellation_reason` VARCHAR(255) NULL,
  `deleted_at` TIMESTAMP NULL COMMENT 'Soft delete timestamp',
  `deleted_by` INT UNSIGNED NULL COMMENT 'User who soft-deleted',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (`currency_in_id`) REFERENCES `currencies`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`currency_out_id`) REFERENCES `currencies`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,

  INDEX `idx_transactions_uuid` (`uuid`),
  INDEX `idx_transactions_number` (`transaction_number`),
  INDEX `idx_transactions_date` (`transaction_date`),
  INDEX `idx_transactions_employee` (`employee_id`),
  INDEX `idx_transactions_customer` (`customer_name`),
  INDEX `idx_transactions_status` (`status`),
  INDEX `idx_transactions_deleted` (`deleted_at`),
  INDEX `idx_transactions_date_employee` (`transaction_date`, `employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- AUDIT LOGS TABLE (comprehensive audit trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NULL,
  `action` VARCHAR(50) NOT NULL COMMENT 'LOGIN, LOGOUT, CREATE, UPDATE, DELETE, RATE_CHANGE, etc.',
  `resource_type` VARCHAR(50) NOT NULL COMMENT 'Table or resource name',
  `resource_id` VARCHAR(50) NULL COMMENT 'ID of affected record',
  `old_values` JSON NULL COMMENT 'Previous values (for updates)',
  `new_values` JSON NULL COMMENT 'New values',
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `session_id` VARCHAR(100) NULL,
  `severity` ENUM('info', 'warning', 'critical') DEFAULT 'info',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,

  INDEX `idx_audit_user` (`user_id`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_resource` (`resource_type`, `resource_id`),
  INDEX `idx_audit_time` (`created_at`),
  INDEX `idx_audit_severity` (`severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- DAILY CLOSING REPORTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS `daily_closing_reports` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `report_date` DATE NOT NULL UNIQUE,
  `total_transactions` INT UNSIGNED DEFAULT 0,
  `cancelled_transactions` INT UNSIGNED DEFAULT 0,

  -- Summary by currency (stored as JSON for flexibility)
  `currency_summary` JSON NOT NULL COMMENT 'Breakdown by currency pair',

  -- Totals in base currency (e.g., USD)
  `total_amount_in_usd` DECIMAL(18, 2) DEFAULT 0.00,
  `total_amount_out_usd` DECIMAL(18, 2) DEFAULT 0.00,
  `total_profit_usd` DECIMAL(18, 2) DEFAULT 0.00,
  `total_commission_usd` DECIMAL(18, 2) DEFAULT 0.00,

  -- Employee breakdown
  `employee_summary` JSON NOT NULL COMMENT 'Breakdown by employee',

  -- Opening and closing rates
  `opening_rates` JSON NULL COMMENT 'Exchange rates at start of day',
  `closing_rates` JSON NULL COMMENT 'Exchange rates at end of day',

  -- Report metadata
  `generated_by` INT UNSIGNED NOT NULL,
  `generated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT NULL,
  `status` ENUM('draft', 'finalized') DEFAULT 'draft',
  `finalized_by` INT UNSIGNED NULL,
  `finalized_at` TIMESTAMP NULL,

  FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`finalized_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,

  INDEX `idx_daily_closing_date` (`report_date`),
  INDEX `idx_daily_closing_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TRIGGERS FOR AUTO-GENERATING TRANSACTION NUMBERS
-- =============================================================================
DELIMITER //

CREATE TRIGGER IF NOT EXISTS `before_transaction_insert`
BEFORE INSERT ON `transactions`
FOR EACH ROW
BEGIN
  DECLARE next_num INT;
  DECLARE date_prefix VARCHAR(8);

  SET date_prefix = DATE_FORMAT(NOW(), '%Y%m%d');

  SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_number, 10) AS UNSIGNED)), 0) + 1
  INTO next_num
  FROM transactions
  WHERE transaction_number LIKE CONCAT('TXN', date_prefix, '%');

  SET NEW.transaction_number = CONCAT('TXN', date_prefix, LPAD(next_num, 4, '0'));
END//

DELIMITER ;

-- =============================================================================
-- VIEWS FOR REPORTING
-- =============================================================================

-- Active transactions view (excludes soft-deleted)
CREATE OR REPLACE VIEW `v_active_transactions` AS
SELECT t.*,
       ci.code AS currency_in_code,
       ci.symbol AS currency_in_symbol,
       co.code AS currency_out_code,
       co.symbol AS currency_out_symbol,
       u.full_name AS employee_name
FROM transactions t
JOIN currencies ci ON t.currency_in_id = ci.id
JOIN currencies co ON t.currency_out_id = co.id
JOIN users u ON t.employee_id = u.id
WHERE t.deleted_at IS NULL;

-- Daily summary view
CREATE OR REPLACE VIEW `v_daily_summary` AS
SELECT
  DATE(transaction_date) AS report_date,
  COUNT(*) AS total_transactions,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
  SUM(CASE WHEN status = 'completed' THEN amount_in ELSE 0 END) AS total_in,
  SUM(CASE WHEN status = 'completed' THEN amount_out ELSE 0 END) AS total_out,
  SUM(CASE WHEN status = 'completed' THEN profit ELSE 0 END) AS total_profit,
  COUNT(DISTINCT employee_id) AS active_employees
FROM transactions
WHERE deleted_at IS NULL
GROUP BY DATE(transaction_date);

-- =============================================================================
-- STORED PROCEDURE FOR DAILY CLOSING REPORT
-- =============================================================================
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS `generate_daily_closing_report`(
  IN p_report_date DATE,
  IN p_generated_by INT
)
BEGIN
  DECLARE v_currency_summary JSON;
  DECLARE v_employee_summary JSON;
  DECLARE v_total_transactions INT;
  DECLARE v_cancelled_transactions INT;
  DECLARE v_total_profit DECIMAL(18,2);

  -- Get transaction counts
  SELECT
    COUNT(*),
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'completed' THEN profit ELSE 0 END)
  INTO v_total_transactions, v_cancelled_transactions, v_total_profit
  FROM transactions
  WHERE DATE(transaction_date) = p_report_date
    AND deleted_at IS NULL;

  -- Build currency summary
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT(
      'currency_in', ci.code,
      'currency_out', co.code,
      'transaction_count', cnt,
      'total_in', total_in,
      'total_out', total_out,
      'profit', profit
    )
  )
  INTO v_currency_summary
  FROM (
    SELECT
      currency_in_id,
      currency_out_id,
      COUNT(*) AS cnt,
      SUM(amount_in) AS total_in,
      SUM(amount_out) AS total_out,
      SUM(profit) AS profit
    FROM transactions
    WHERE DATE(transaction_date) = p_report_date
      AND deleted_at IS NULL
      AND status = 'completed'
    GROUP BY currency_in_id, currency_out_id
  ) AS currency_totals
  JOIN currencies ci ON currency_totals.currency_in_id = ci.id
  JOIN currencies co ON currency_totals.currency_out_id = co.id;

  -- Build employee summary
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT(
      'employee_id', u.id,
      'employee_name', u.full_name,
      'transaction_count', cnt,
      'total_profit', profit
    )
  )
  INTO v_employee_summary
  FROM (
    SELECT
      employee_id,
      COUNT(*) AS cnt,
      SUM(profit) AS profit
    FROM transactions
    WHERE DATE(transaction_date) = p_report_date
      AND deleted_at IS NULL
      AND status = 'completed'
    GROUP BY employee_id
  ) AS employee_totals
  JOIN users u ON employee_totals.employee_id = u.id;

  -- Insert or update the report
  INSERT INTO daily_closing_reports (
    report_date,
    total_transactions,
    cancelled_transactions,
    currency_summary,
    employee_summary,
    total_profit_usd,
    generated_by
  ) VALUES (
    p_report_date,
    COALESCE(v_total_transactions, 0),
    COALESCE(v_cancelled_transactions, 0),
    COALESCE(v_currency_summary, '[]'),
    COALESCE(v_employee_summary, '[]'),
    COALESCE(v_total_profit, 0),
    p_generated_by
  )
  ON DUPLICATE KEY UPDATE
    total_transactions = VALUES(total_transactions),
    cancelled_transactions = VALUES(cancelled_transactions),
    currency_summary = VALUES(currency_summary),
    employee_summary = VALUES(employee_summary),
    total_profit_usd = VALUES(total_profit_usd),
    generated_by = VALUES(generated_by),
    generated_at = CURRENT_TIMESTAMP,
    status = 'draft';

END//

DELIMITER ;

-- =============================================================================
-- CLEANUP OLD LOGIN ATTEMPTS (run as scheduled event)
-- =============================================================================
DELIMITER //

CREATE EVENT IF NOT EXISTS `cleanup_login_attempts`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  DELETE FROM login_attempts
  WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END//

DELIMITER ;

-- Enable event scheduler
SET GLOBAL event_scheduler = ON;
