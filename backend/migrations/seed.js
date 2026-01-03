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
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
      { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
      { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
      { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
      { code: 'SYP', name: 'Syrian Pound', symbol: '£S' },
      { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا' },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' }
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
      // USD pairs
      { from: 'USD', to: 'IQD', buy: 1460.00, sell: 1465.00 },
      // EUR pairs
      { from: 'EUR', to: 'IQD', buy: 1590.00, sell: 1600.00 },
      { from: 'EUR', to: 'USD', buy: 1.08, sell: 1.09 },
      // GBP pairs
      { from: 'GBP', to: 'IQD', buy: 1850.00, sell: 1865.00 },
      { from: 'GBP', to: 'USD', buy: 1.26, sell: 1.27 },
      // TRY pairs
      { from: 'TRY', to: 'IQD', buy: 43.00, sell: 44.00 },
      { from: 'USD', to: 'TRY', buy: 33.50, sell: 34.00 },
      // AED pairs
      { from: 'AED', to: 'IQD', buy: 397.00, sell: 400.00 },
      { from: 'USD', to: 'AED', buy: 3.67, sell: 3.68 },
      // SAR pairs
      { from: 'SAR', to: 'IQD', buy: 389.00, sell: 392.00 },
      { from: 'USD', to: 'SAR', buy: 3.75, sell: 3.76 },
      // KWD pairs
      { from: 'KWD', to: 'IQD', buy: 4750.00, sell: 4780.00 },
      { from: 'KWD', to: 'USD', buy: 3.25, sell: 3.27 },
      // JOD pairs
      { from: 'JOD', to: 'IQD', buy: 2060.00, sell: 2075.00 },
      { from: 'JOD', to: 'USD', buy: 1.41, sell: 1.42 },
      // IRR pairs (per 10,000 Rial)
      { from: 'IRR', to: 'IQD', buy: 0.035, sell: 0.036 },
      // CHF pairs
      { from: 'CHF', to: 'USD', buy: 1.12, sell: 1.13 },
      { from: 'CHF', to: 'IQD', buy: 1640.00, sell: 1655.00 }
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
