-- Shift Management Schema
-- Tracks employee shifts with cash balances and transaction summaries

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  employee_id INT NOT NULL,
  drawer_id INT,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
  opening_notes TEXT,
  closing_notes TEXT,
  handover_to INT,
  handover_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (drawer_id) REFERENCES cash_drawers(id) ON DELETE SET NULL,
  FOREIGN KEY (handover_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_employee_date (employee_id, start_time),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shift Opening/Closing Balances per Currency
CREATE TABLE IF NOT EXISTS shift_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shift_id INT NOT NULL,
  currency_id INT NOT NULL,
  opening_balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(18,2),
  expected_closing DECIMAL(18,2),
  difference DECIMAL(18,2),
  UNIQUE KEY unique_shift_currency (shift_id, currency_id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shift Transaction Summary
CREATE TABLE IF NOT EXISTS shift_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shift_id INT NOT NULL UNIQUE,
  total_transactions INT DEFAULT 0,
  total_buy_transactions INT DEFAULT 0,
  total_sell_transactions INT DEFAULT 0,
  total_profit DECIMAL(18,2) DEFAULT 0,
  total_commission DECIMAL(18,2) DEFAULT 0,
  cancelled_transactions INT DEFAULT 0,
  total_volume_in DECIMAL(18,2) DEFAULT 0,
  total_volume_out DECIMAL(18,2) DEFAULT 0,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Link transactions to shifts
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shift_id INT REFERENCES shifts(id);
ALTER TABLE transactions ADD INDEX IF NOT EXISTS idx_shift (shift_id);
