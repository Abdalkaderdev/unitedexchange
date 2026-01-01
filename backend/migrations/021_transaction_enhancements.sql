-- Migration: Transaction Enhancements
-- Adds payment_method and reference_number fields to transactions

-- Add payment_method column
ALTER TABLE `transactions`
  ADD COLUMN IF NOT EXISTS `payment_method` ENUM('cash', 'card', 'bank_transfer', 'cheque', 'other')
    DEFAULT 'cash' AFTER `notes`;

-- Add reference_number column (PNR, bank reference, etc.)
ALTER TABLE `transactions`
  ADD COLUMN IF NOT EXISTS `reference_number` VARCHAR(100) NULL AFTER `payment_method`;

-- Add indexes for lookups
CREATE INDEX IF NOT EXISTS `idx_transactions_reference` ON `transactions`(`reference_number`);
CREATE INDEX IF NOT EXISTS `idx_transactions_payment_method` ON `transactions`(`payment_method`);
