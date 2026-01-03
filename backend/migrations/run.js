const mysql = require('mysql2/promise');
require('dotenv').config();

const migrations = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'manager', 'teller', 'viewer', 'employee') NOT NULL DEFAULT 'employee',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_role (role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Currencies table
  `CREATE TABLE IF NOT EXISTS currencies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Exchange rates table (manual rates)
  `CREATE TABLE IF NOT EXISTS exchange_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_currency_id INT NOT NULL,
    to_currency_id INT NOT NULL,
    buy_rate DECIMAL(18, 6) NOT NULL,
    sell_rate DECIMAL(18, 6) NOT NULL,
    updated_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (from_currency_id) REFERENCES currencies(id) ON DELETE CASCADE,
    FOREIGN KEY (to_currency_id) REFERENCES currencies(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id),
    UNIQUE KEY unique_rate_pair (from_currency_id, to_currency_id),
    INDEX idx_currencies (from_currency_id, to_currency_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Transactions table
  `CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20),
    currency_in_id INT NOT NULL,
    currency_out_id INT NOT NULL,
    amount_in DECIMAL(18, 2) NOT NULL,
    amount_out DECIMAL(18, 2) NOT NULL,
    exchange_rate DECIMAL(18, 6) NOT NULL,
    profit DECIMAL(18, 2) DEFAULT 0,
    notes TEXT,
    employee_id INT NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (currency_in_id) REFERENCES currencies(id),
    FOREIGN KEY (currency_out_id) REFERENCES currencies(id),
    FOREIGN KEY (employee_id) REFERENCES users(id),
    INDEX idx_date (transaction_date),
    INDEX idx_employee (employee_id),
    INDEX idx_customer (customer_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // Audit log table
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_date (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

// Additional alter statements for schema updates
const alterStatements = [
  // Add low_balance_alert to cash_drawers if missing
  `ALTER TABLE cash_drawers ADD COLUMN low_balance_alert DECIMAL(20,4) DEFAULT 0`,
  // Add created_by to cash_drawers if missing
  `ALTER TABLE cash_drawers ADD COLUMN created_by INT UNSIGNED NULL`,
  // Add created_by to customers if missing
  `ALTER TABLE customers ADD COLUMN created_by INT UNSIGNED NULL`,
  // Add permissions tables
  `CREATE TABLE IF NOT EXISTS permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_permissions_category (category)
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role ENUM('admin', 'manager', 'teller', 'viewer') NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_role_permission (role, permission_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  )`,
  // Add shift_id to transactions table for shift tracking
  `ALTER TABLE transactions ADD COLUMN shift_id INT UNSIGNED NULL`,
  `ALTER TABLE transactions ADD INDEX idx_shift_id (shift_id)`,
  // Add other missing transaction columns
  `ALTER TABLE transactions ADD COLUMN customer_id INT UNSIGNED NULL`,
  `ALTER TABLE transactions ADD COLUMN customer_id_type VARCHAR(50) NULL`,
  `ALTER TABLE transactions ADD COLUMN customer_id_number VARCHAR(100) NULL`,
  `ALTER TABLE transactions ADD COLUMN market_rate DECIMAL(18,6) NULL`,
  `ALTER TABLE transactions ADD COLUMN commission DECIMAL(18,2) DEFAULT 0`,
  `ALTER TABLE transactions ADD COLUMN status ENUM('completed', 'pending', 'cancelled') DEFAULT 'completed'`,
  `ALTER TABLE transactions ADD COLUMN cancelled_by INT UNSIGNED NULL`,
  `ALTER TABLE transactions ADD COLUMN cancelled_at TIMESTAMP NULL`,
  `ALTER TABLE transactions ADD COLUMN cancellation_reason TEXT NULL`,
  `ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMP NULL`,
  `ALTER TABLE transactions ADD COLUMN deleted_by INT UNSIGNED NULL`,
  `ALTER TABLE transactions ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash'`,
  `ALTER TABLE transactions ADD COLUMN reference_number VARCHAR(100) NULL`,
  `ALTER TABLE transactions ADD COLUMN transaction_number VARCHAR(50) NULL`,
  // Create customers table if not exists
  `CREATE TABLE IF NOT EXISTS customers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    id_type VARCHAR(50) NULL,
    id_number VARCHAR(100) NULL,
    id_expiry DATE NULL,
    address TEXT NULL,
    notes TEXT NULL,
    is_vip BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    block_reason TEXT NULL,
    total_transactions INT DEFAULT 0,
    total_volume DECIMAL(20,2) DEFAULT 0,
    created_by INT UNSIGNED NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customers_phone (phone),
    INDEX idx_customers_email (email)
  )`,
  // Create shifts table if not exists
  `CREATE TABLE IF NOT EXISTS shifts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    employee_id INT UNSIGNED NOT NULL,
    drawer_id INT UNSIGNED NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
    opening_notes TEXT NULL,
    closing_notes TEXT NULL,
    handover_to INT UNSIGNED NULL,
    handover_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shifts_employee (employee_id),
    INDEX idx_shifts_status (status)
  )`,
  // Create shift_balances table if not exists
  `CREATE TABLE IF NOT EXISTS shift_balances (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    shift_id INT UNSIGNED NOT NULL,
    currency_id INT UNSIGNED NOT NULL,
    opening_balance DECIMAL(20,4) DEFAULT 0,
    closing_balance DECIMAL(20,4) NULL,
    expected_closing DECIMAL(20,4) NULL,
    difference DECIMAL(20,4) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_shift_currency (shift_id, currency_id)
  )`,
  // Create shift_summaries table if not exists
  `CREATE TABLE IF NOT EXISTS shift_summaries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    shift_id INT UNSIGNED NOT NULL UNIQUE,
    total_transactions INT DEFAULT 0,
    total_profit DECIMAL(20,4) DEFAULT 0,
    total_commission DECIMAL(20,4) DEFAULT 0,
    cancelled_transactions INT DEFAULT 0,
    total_volume_in DECIMAL(20,4) DEFAULT 0,
    total_volume_out DECIMAL(20,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  // Create cash_drawers table if not exists
  `CREATE TABLE IF NOT EXISTS cash_drawers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT UNSIGNED NULL,
    low_balance_alert DECIMAL(20,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  // Create cash_drawer_transactions table if not exists
  `CREATE TABLE IF NOT EXISTS cash_drawer_transactions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    drawer_id INT UNSIGNED NOT NULL,
    currency_id INT UNSIGNED NOT NULL,
    type ENUM('deposit', 'withdrawal', 'adjustment') NOT NULL,
    amount DECIMAL(20,4) NOT NULL,
    notes TEXT NULL,
    performed_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  // Create cash_drawer_reconciliations table if not exists
  `CREATE TABLE IF NOT EXISTS cash_drawer_reconciliations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    drawer_id INT UNSIGNED NOT NULL,
    currency_id INT UNSIGNED NOT NULL,
    expected_balance DECIMAL(20,4) NOT NULL,
    actual_balance DECIMAL(20,4) NOT NULL,
    difference DECIMAL(20,4) NOT NULL,
    status ENUM('balanced', 'over', 'short') NOT NULL,
    notes TEXT NULL,
    reconciled_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  // Add missing columns to shifts table
  `ALTER TABLE shifts ADD COLUMN handover_to INT UNSIGNED NULL`,
  `ALTER TABLE shifts ADD COLUMN handover_notes TEXT NULL`,
  `ALTER TABLE shifts ADD COLUMN opening_notes TEXT NULL`,
  `ALTER TABLE shifts ADD COLUMN closing_notes TEXT NULL`,
  `ALTER TABLE shifts ADD COLUMN drawer_id INT UNSIGNED NULL`,
  // Add missing columns to shift_summaries table
  `ALTER TABLE shift_summaries ADD COLUMN total_commission DECIMAL(20,4) DEFAULT 0`,
  `ALTER TABLE shift_summaries ADD COLUMN cancelled_transactions INT DEFAULT 0`,
  `ALTER TABLE shift_summaries ADD COLUMN total_volume_in DECIMAL(20,4) DEFAULT 0`,
  `ALTER TABLE shift_summaries ADD COLUMN total_volume_out DECIMAL(20,4) DEFAULT 0`,
  // Add uuid column to currencies table
  `ALTER TABLE currencies ADD COLUMN uuid VARCHAR(36) NULL`,
  // Create daily_closing_reports table if not exists
  `CREATE TABLE IF NOT EXISTS daily_closing_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL,
    report_date DATE NOT NULL,
    total_transactions INT DEFAULT 0,
    cancelled_transactions INT DEFAULT 0,
    total_profit DECIMAL(20,4) DEFAULT 0,
    total_commission DECIMAL(20,4) DEFAULT 0,
    status ENUM('draft', 'finalized') DEFAULT 'draft',
    notes TEXT NULL,
    generated_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_report_date (report_date),
    INDEX idx_status (status)
  )`,
  // Add uuid to daily_closing_reports if missing
  `ALTER TABLE daily_closing_reports ADD COLUMN uuid VARCHAR(36) NULL`,
  // Add missing columns to daily_closing_reports
  `ALTER TABLE daily_closing_reports ADD COLUMN total_commission DECIMAL(20,4) DEFAULT 0`,
  `ALTER TABLE daily_closing_reports ADD COLUMN cancelled_transactions INT DEFAULT 0`,
  // Add high_value_threshold to currencies
  `ALTER TABLE currencies ADD COLUMN high_value_threshold DECIMAL(20,4) DEFAULT 0`,
  // Add is_flagged and flag_reason to transactions
  `ALTER TABLE transactions ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE transactions ADD COLUMN flag_reason TEXT NULL`,
  // Create exchange_rate_history table
  `CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    exchange_rate_id INT UNSIGNED NOT NULL,
    from_currency_id INT UNSIGNED NOT NULL,
    to_currency_id INT UNSIGNED NOT NULL,
    old_buy_rate DECIMAL(18,6) NULL,
    new_buy_rate DECIMAL(18,6) NOT NULL,
    old_sell_rate DECIMAL(18,6) NULL,
    new_sell_rate DECIMAL(18,6) NOT NULL,
    changed_by INT UNSIGNED NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rate_id (exchange_rate_id),
    INDEX idx_currencies (from_currency_id, to_currency_id),
    INDEX idx_changed_at (changed_at)
  )`,
  // Create filter_presets table
  `CREATE TABLE IF NOT EXISTS filter_presets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    filters JSON NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_resource (user_id, resource_type)
  )`,
  // Create rate_alerts table
  `CREATE TABLE IF NOT EXISTS rate_alerts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT UNSIGNED NOT NULL,
    from_currency_id INT UNSIGNED NOT NULL,
    to_currency_id INT UNSIGNED NOT NULL,
    condition_type ENUM('above', 'below') NOT NULL,
    target_rate DECIMAL(18,6) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_currencies (from_currency_id, to_currency_id)
  )`,
  // Create scheduled_reports table
  `CREATE TABLE IF NOT EXISTS scheduled_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT UNSIGNED NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    frequency ENUM('daily', 'weekly', 'monthly') NOT NULL,
    recipients JSON NOT NULL,
    filters JSON NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMP NULL,
    next_run_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_next_run (next_run_at)
  )`,
  // Create two_factor_auth table
  `CREATE TABLE IF NOT EXISTS two_factor_auth (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    secret VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    backup_codes JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // Add assigned_to column to cash_drawers
  `ALTER TABLE cash_drawers ADD COLUMN assigned_to INT UNSIGNED NULL`
];

async function runMigrations() {
  let connection;

  try {
    // First connect without database to create it if needed
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    const dbName = process.env.DB_NAME || 'united_exchange';

    // Create database if not exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database '${dbName}' ensured`);

    // Switch to the database
    await connection.query(`USE \`${dbName}\``);

    // Run migrations
    for (let i = 0; i < migrations.length; i++) {
      await connection.query(migrations[i]);
      console.log(`Migration ${i + 1} completed`);
    }

    // Run alter statements (ignore errors for already existing columns/tables)
    for (let i = 0; i < alterStatements.length; i++) {
      try {
        await connection.query(alterStatements[i]);
        console.log(`Alter statement ${i + 1} completed`);
      } catch (err) {
        // Ignore duplicate column/table errors
        if (err.code !== 'ER_DUP_FIELDNAME' && err.code !== 'ER_TABLE_EXISTS_ERROR') {
          console.log(`Alter ${i + 1} skipped: ${err.message}`);
        }
      }
    }

    // Seed permissions if table is empty
    const [permCount] = await connection.query('SELECT COUNT(*) as cnt FROM permissions');
    if (permCount[0].cnt === 0) {
      console.log('Seeding permissions...');
      const permissionSeeds = [
        ['transactions.view', 'View Transactions', 'View transaction list and details', 'transactions'],
        ['transactions.create', 'Create Transactions', 'Create new exchange transactions', 'transactions'],
        ['transactions.edit', 'Edit Transactions', 'Edit transaction details', 'transactions'],
        ['transactions.cancel', 'Cancel Transactions', 'Cancel existing transactions', 'transactions'],
        ['transactions.delete', 'Delete Transactions', 'Permanently delete transactions', 'transactions'],
        ['customers.view', 'View Customers', 'View customer list and details', 'customers'],
        ['customers.create', 'Create Customers', 'Add new customers', 'customers'],
        ['customers.edit', 'Edit Customers', 'Edit customer information', 'customers'],
        ['customers.delete', 'Delete Customers', 'Delete customers', 'customers'],
        ['customers.block', 'Block Customers', 'Block/unblock customers', 'customers'],
        ['currencies.view', 'View Currencies', 'View currencies and exchange rates', 'currencies'],
        ['currencies.manage', 'Manage Currencies', 'Add/edit currencies', 'currencies'],
        ['currencies.rates', 'Manage Exchange Rates', 'Set exchange rates', 'currencies'],
        ['reports.view', 'View Reports', 'View basic reports', 'reports'],
        ['reports.daily', 'Daily Reports', 'Access daily reports', 'reports'],
        ['reports.monthly', 'Monthly Reports', 'Access monthly reports', 'reports'],
        ['audit.view', 'View Audit Logs', 'View audit trail', 'audit'],
        ['cash_drawer.view', 'View Cash Drawers', 'View cash drawer balances', 'cash_drawer'],
        ['cash_drawer.manage', 'Manage Cash Drawers', 'Create/edit cash drawers', 'cash_drawer'],
        ['shifts.view', 'View Shifts', 'View shift history', 'shifts'],
        ['shifts.manage', 'Manage Shifts', 'Start/end/handover shifts', 'shifts'],
        ['users.view', 'View Users', 'View user list', 'users'],
        ['users.create', 'Create Users', 'Add new users', 'users'],
        ['users.edit', 'Edit Users', 'Edit user information', 'users'],
        ['users.permissions', 'Manage Permissions', 'Manage role permissions', 'users']
      ];

      for (const [code, name, desc, cat] of permissionSeeds) {
        await connection.query(
          'INSERT INTO permissions (code, name, description, category) VALUES (?, ?, ?, ?)',
          [code, name, desc, cat]
        );
      }
      console.log('Permissions seeded');
    }

    // Always ensure admin has all permissions (fix for missing permissions)
    console.log('Ensuring admin has all permissions...');
    await connection.query(`
      INSERT IGNORE INTO role_permissions (role, permission_id)
      SELECT 'admin', id FROM permissions
    `);

    // Check and assign manager permissions if missing
    const [managerPerms] = await connection.query('SELECT COUNT(*) as cnt FROM role_permissions WHERE role = "manager"');
    if (managerPerms[0].cnt === 0) {
      await connection.query('INSERT INTO role_permissions (role, permission_id) SELECT "manager", id FROM permissions WHERE category != "users"');
      console.log('Manager permissions assigned');
    }

    // Check and assign teller permissions if missing
    const [tellerPerms] = await connection.query('SELECT COUNT(*) as cnt FROM role_permissions WHERE role = "teller"');
    if (tellerPerms[0].cnt === 0) {
      await connection.query(`INSERT INTO role_permissions (role, permission_id) SELECT "teller", id FROM permissions WHERE code IN (
        'transactions.view', 'transactions.create', 'transactions.edit',
        'customers.view', 'customers.create', 'customers.edit',
        'currencies.view', 'reports.view', 'reports.daily',
        'cash_drawer.view', 'shifts.view', 'shifts.manage'
      )`);
      console.log('Teller permissions assigned');
    }

    // Check and assign viewer permissions if missing
    const [viewerPerms] = await connection.query('SELECT COUNT(*) as cnt FROM role_permissions WHERE role = "viewer"');
    if (viewerPerms[0].cnt === 0) {
      await connection.query(`INSERT INTO role_permissions (role, permission_id) SELECT "viewer", id FROM permissions WHERE code IN (
        'transactions.view', 'customers.view', 'currencies.view',
        'reports.view', 'cash_drawer.view', 'shifts.view'
      )`);
      console.log('Viewer permissions assigned');
    }

    console.log('Role permissions verified');

    console.log('All migrations completed successfully');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigrations();
