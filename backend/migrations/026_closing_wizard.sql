CREATE TABLE IF NOT EXISTS drawer_closings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    drawer_id INT NOT NULL,
    user_id INT NOT NULL,
    opening_time TIMESTAMP NULL,
    closing_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_balances JSON NOT NULL,
    actual_balances JSON NOT NULL,
    variance JSON NULL,
    status ENUM('pending', 'completed', 'disputed') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (drawer_id) REFERENCES cash_drawers(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_drawer_date (drawer_id, closing_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
