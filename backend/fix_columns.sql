-- Fix missing uuid columns
USE united_exchange;

-- Add uuid column to daily_closing_reports if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'united_exchange' AND table_name = 'daily_closing_reports' AND column_name = 'uuid');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE daily_closing_reports ADD COLUMN uuid VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add uuid column to currencies if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'united_exchange' AND table_name = 'currencies' AND column_name = 'uuid');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE currencies ADD COLUMN uuid VARCHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update UUIDs for rows where it's null
UPDATE currencies SET uuid = UUID() WHERE uuid IS NULL;
UPDATE daily_closing_reports SET uuid = UUID() WHERE uuid IS NULL;
