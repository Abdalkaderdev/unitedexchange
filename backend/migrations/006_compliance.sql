-- Compliance/KYC Features Schema
-- Tracks compliance rules, alerts, and suspicious activity reports

-- Compliance Rules
CREATE TABLE IF NOT EXISTS compliance_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  rule_type ENUM('transaction_limit', 'daily_limit', 'customer_limit', 'id_required', 'velocity') NOT NULL,
  currency_id INT,
  threshold_amount DECIMAL(18,2),
  threshold_count INT,
  time_window_hours INT DEFAULT 24,
  action ENUM('flag', 'block', 'require_approval', 'require_id') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_type (rule_type),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Compliance Alerts
CREATE TABLE IF NOT EXISTS compliance_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  rule_id INT,
  transaction_id INT,
  customer_id INT,
  alert_type ENUM('large_transaction', 'daily_limit_exceeded', 'suspicious_pattern', 'id_missing', 'blocked_customer', 'velocity_exceeded', 'manual') NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  description TEXT,
  details JSON,
  status ENUM('pending', 'reviewed', 'escalated', 'resolved', 'false_positive') DEFAULT 'pending',
  reviewed_by INT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_id) REFERENCES compliance_rules(id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_severity (severity),
  INDEX idx_type (alert_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Suspicious Activity Reports (SAR)
CREATE TABLE IF NOT EXISTS suspicious_activity_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(36) UNIQUE NOT NULL,
  customer_id INT,
  alert_ids JSON,
  transaction_ids JSON,
  description TEXT NOT NULL,
  risk_level ENUM('low', 'medium', 'high') NOT NULL,
  status ENUM('draft', 'submitted', 'under_review', 'closed') DEFAULT 'draft',
  submitted_by INT,
  submitted_at TIMESTAMP,
  reviewed_by INT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_status (status),
  INDEX idx_risk (risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Customer Risk Profiles
CREATE TABLE IF NOT EXISTS customer_risk_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL UNIQUE,
  risk_score INT DEFAULT 0,
  risk_level ENUM('low', 'medium', 'high') DEFAULT 'low',
  total_alerts INT DEFAULT 0,
  total_sars INT DEFAULT 0,
  last_alert_date TIMESTAMP,
  last_review_date TIMESTAMP,
  notes TEXT,
  reviewed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_risk_level (risk_level),
  INDEX idx_risk_score (risk_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default compliance rules
INSERT INTO compliance_rules (uuid, name, description, rule_type, threshold_amount, action, is_active, priority) VALUES
(UUID(), 'Large Transaction Alert', 'Flag transactions exceeding $10,000 equivalent', 'transaction_limit', 10000.00, 'flag', TRUE, 1),
(UUID(), 'ID Required Threshold', 'Require customer ID for transactions over $3,000', 'transaction_limit', 3000.00, 'require_id', TRUE, 2),
(UUID(), 'Daily Customer Limit', 'Alert when a customer exceeds $25,000 in a day', 'daily_limit', 25000.00, 'flag', TRUE, 3),
(UUID(), 'High Velocity Alert', 'Alert when customer makes more than 5 transactions in 24 hours', 'velocity', NULL, 'flag', TRUE, 4);

UPDATE compliance_rules SET threshold_count = 5, time_window_hours = 24 WHERE name = 'High Velocity Alert';
