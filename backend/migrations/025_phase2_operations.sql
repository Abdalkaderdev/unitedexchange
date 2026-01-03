-- Migration: Phase 2 Operations (High Value Flagging & Cash Management Enhancements)
-- Date: 2026-01-03

-- 1. Add High Value Threshold to Currencies
-- Default threshold is 10,000 (in that currency units)
ALTER TABLE currencies ADD COLUMN IF NOT EXISTS high_value_threshold DECIMAL(18,2) DEFAULT 10000.00;

-- 2. Add Flagging columns to Transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(255) NULL;

-- 3. Add Index for flagged transactions for faster lookup
CREATE INDEX idx_transactions_flagged ON transactions(is_flagged);
