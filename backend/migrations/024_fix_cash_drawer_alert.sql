-- Migration: Fix missing low_balance_alert column in cash_drawers table
-- Date: 2025-01-01

-- Add low_balance_alert column if not exists (MySQL 8+ syntax)
ALTER TABLE cash_drawers ADD COLUMN IF NOT EXISTS low_balance_alert DECIMAL(20,4) DEFAULT 0;
