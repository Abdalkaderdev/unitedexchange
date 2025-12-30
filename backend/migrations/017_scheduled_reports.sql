-- Migration: 017_scheduled_reports
-- Description: Create scheduled_reports table for automated report delivery
-- Created: 2025-01-01

-- Scheduled Reports Table
-- Stores configuration for automated report generation and email delivery
CREATE TABLE scheduled_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  report_type ENUM('daily', 'monthly', 'profit_loss', 'transactions') NOT NULL,
  schedule_type ENUM('daily', 'weekly') NOT NULL,
  schedule_day INT DEFAULT NULL COMMENT 'Day of week for weekly schedules (0=Sunday, 6=Saturday)',
  schedule_time TIME NOT NULL DEFAULT '08:00:00',
  recipients JSON NOT NULL COMMENT 'Array of email addresses',
  export_format ENUM('xlsx', 'csv', 'pdf') DEFAULT 'xlsx',
  filters JSON DEFAULT NULL COMMENT 'Optional filters for report generation',
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP NULL COMMENT 'Last successful execution time',
  next_run_at TIMESTAMP NULL COMMENT 'Next scheduled execution time',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_scheduled_reports_uuid (uuid),
  INDEX idx_scheduled_reports_is_active (is_active),
  INDEX idx_scheduled_reports_next_run (next_run_at),
  INDEX idx_scheduled_reports_created_by (created_by),
  CONSTRAINT chk_schedule_day CHECK (
    schedule_day IS NULL OR (schedule_day >= 0 AND schedule_day <= 6)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comments for documentation
ALTER TABLE scheduled_reports COMMENT = 'Stores scheduled report configurations for automated email delivery';
