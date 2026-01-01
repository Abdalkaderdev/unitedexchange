-- Filter Presets - Save custom filter configurations per user
CREATE TABLE IF NOT EXISTS `filter_presets` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(36) NOT NULL UNIQUE,
  `user_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(50) NOT NULL COMMENT 'transactions, customers, reports, etc.',
  `filters` JSON NOT NULL,
  `is_default` BOOLEAN DEFAULT FALSE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_resource` (`user_id`, `resource_type`),
  INDEX `idx_default` (`user_id`, `resource_type`, `is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
