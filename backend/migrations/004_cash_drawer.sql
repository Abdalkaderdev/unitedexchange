-- Cash Drawer Management Schema
-- Tracks cash on hand by currency with full transaction history

-- Cash Drawers (physical cash registers/tills)
CREATE TABLE IF NOT EXISTS cash_drawers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  location VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  low_balance_alert DECIMAL(18,2) DEFAULT 1000.00,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cash Drawer Balances per Currency
CREATE TABLE IF NOT EXISTS cash_drawer_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  drawer_id INT NOT NULL,
  currency_id INT NOT NULL,
  balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_updated_by INT REFERENCES users(id),
  UNIQUE KEY unique_drawer_currency (drawer_id, currency_id),
  FOREIGN KEY (drawer_id) REFERENCES cash_drawers(id) ON DELETE CASCADE,
  FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT,
  INDEX idx_drawer (drawer_id),
  INDEX idx_currency (currency_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cash Drawer Transaction Log
CREATE TABLE IF NOT EXISTS cash_drawer_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  drawer_id INT NOT NULL,
  currency_id INT NOT NULL,
  type ENUM('deposit', 'withdrawal', 'adjustment', 'transaction_in', 'transaction_out', 'transfer_in', 'transfer_out') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  balance_before DECIMAL(18,2) NOT NULL,
  balance_after DECIMAL(18,2) NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(36),
  notes TEXT,
  performed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (drawer_id) REFERENCES cash_drawers(id) ON DELETE RESTRICT,
  FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_drawer_date (drawer_id, created_at),
  INDEX idx_type (type),
  INDEX idx_reference (reference_type, reference_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cash Drawer Reconciliations
CREATE TABLE IF NOT EXISTS cash_drawer_reconciliations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  drawer_id INT NOT NULL,
  currency_id INT NOT NULL,
  expected_balance DECIMAL(18,2) NOT NULL,
  actual_balance DECIMAL(18,2) NOT NULL,
  difference DECIMAL(18,2) NOT NULL,
  status ENUM('balanced', 'over', 'short') NOT NULL,
  notes TEXT,
  reconciled_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (drawer_id) REFERENCES cash_drawers(id) ON DELETE RESTRICT,
  FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT,
  FOREIGN KEY (reconciled_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_drawer_date (drawer_id, created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cash Transfers Between Drawers
CREATE TABLE IF NOT EXISTS cash_drawer_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  from_drawer_id INT NOT NULL,
  to_drawer_id INT NOT NULL,
  currency_id INT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  notes TEXT,
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
  initiated_by INT NOT NULL,
  completed_by INT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_drawer_id) REFERENCES cash_drawers(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_drawer_id) REFERENCES cash_drawers(id) ON DELETE RESTRICT,
  FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE RESTRICT,
  FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default drawer
INSERT INTO cash_drawers (uuid, name, location, created_by)
SELECT UUID(), 'Main Drawer', 'Front Counter', id FROM users WHERE role = 'admin' LIMIT 1;
