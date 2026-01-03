const { pool } = require('../src/config/database');

async function migrate() {
    console.log('Starting migration: rate_alerts');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Create rate_alerts table
        await connection.query(`
      CREATE TABLE IF NOT EXISTS rate_alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        from_currency_id INT NOT NULL,
        to_currency_id INT NOT NULL,
        target_rate DECIMAL(18, 6) NOT NULL,
        condition_type ENUM('above', 'below') NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_triggered_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (from_currency_id) REFERENCES currencies(id),
        FOREIGN KEY (to_currency_id) REFERENCES currencies(id),
        INDEX idx_user_alert (user_id, is_active),
        INDEX idx_currency_pair (from_currency_id, to_currency_id, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

        console.log('rate_alerts table created successfully');

        await connection.commit();
        console.log('Migration completed successfully');
    } catch (error) {
        await connection.rollback();
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        connection.release();
        process.exit(0);
    }
}

migrate();
