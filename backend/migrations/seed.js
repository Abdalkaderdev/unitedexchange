const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function seed() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'united_exchange'
    });

    console.log('Connected to database');

    // Seed currencies
    const currencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د' },
      { code: 'EUR', name: 'Euro', symbol: '€' }
    ];

    for (const currency of currencies) {
      await connection.query(
        `INSERT INTO currencies (code, name, symbol) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), symbol = VALUES(symbol)`,
        [currency.code, currency.name, currency.symbol]
      );
    }
    console.log('Currencies seeded');

    // Seed admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const adminUuid = uuidv4();

    await connection.query(
      `INSERT INTO users (uuid, username, email, password, full_name, role)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      [adminUuid, 'admin', 'admin@unitedexchange.com', adminPassword, 'System Administrator', 'admin']
    );
    console.log('Admin user seeded (username: admin, password: admin123)');

    // Seed employee user
    const employeePassword = await bcrypt.hash('employee123', 12);
    const employeeUuid = uuidv4();

    await connection.query(
      `INSERT INTO users (uuid, username, email, password, full_name, role)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password)`,
      [employeeUuid, 'employee', 'employee@unitedexchange.com', employeePassword, 'Ahmed Hassan', 'employee']
    );
    console.log('Employee user seeded (username: employee, password: employee123)');

    // Get user and currency IDs for exchange rates
    const [users] = await connection.query('SELECT id FROM users WHERE username = ?', ['admin']);
    const [currencyRows] = await connection.query('SELECT id, code FROM currencies');

    const currencyMap = {};
    currencyRows.forEach(c => { currencyMap[c.code] = c.id; });

    // Seed exchange rates
    const rates = [
      { from: 'USD', to: 'IQD', buy: 1460.00, sell: 1465.00 },
      { from: 'EUR', to: 'IQD', buy: 1590.00, sell: 1600.00 },
      { from: 'EUR', to: 'USD', buy: 1.08, sell: 1.09 }
    ];

    for (const rate of rates) {
      await connection.query(
        `INSERT INTO exchange_rates (from_currency_id, to_currency_id, buy_rate, sell_rate, updated_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE buy_rate = VALUES(buy_rate), sell_rate = VALUES(sell_rate)`,
        [currencyMap[rate.from], currencyMap[rate.to], rate.buy, rate.sell, users[0].id]
      );
    }
    console.log('Exchange rates seeded');

    console.log('\nSeed completed successfully!');
    console.log('\nDefault credentials:');
    console.log('Admin - username: admin, password: admin123');
    console.log('Employee - username: employee, password: employee123');

  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seed();
