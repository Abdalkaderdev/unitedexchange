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
    role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
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
  )`
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

      // Assign all permissions to admin
      await connection.query('INSERT INTO role_permissions (role, permission_id) SELECT "admin", id FROM permissions');

      // Assign most to manager (except users)
      await connection.query('INSERT INTO role_permissions (role, permission_id) SELECT "manager", id FROM permissions WHERE category != "users"');

      // Assign basic to teller
      await connection.query(`INSERT INTO role_permissions (role, permission_id) SELECT "teller", id FROM permissions WHERE code IN (
        'transactions.view', 'transactions.create', 'transactions.edit',
        'customers.view', 'customers.create', 'customers.edit',
        'currencies.view', 'reports.view', 'reports.daily',
        'cash_drawer.view', 'shifts.view', 'shifts.manage'
      )`);

      // Assign view-only to viewer
      await connection.query(`INSERT INTO role_permissions (role, permission_id) SELECT "viewer", id FROM permissions WHERE code IN (
        'transactions.view', 'customers.view', 'currencies.view',
        'reports.view', 'cash_drawer.view', 'shifts.view'
      )`);

      console.log('Role permissions assigned');
    }

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
