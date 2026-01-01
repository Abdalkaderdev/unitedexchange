const mysql = require('mysql2/promise');
require('dotenv').config();

async function fix() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('Checking cash_drawers columns...');
  const [cols] = await conn.query('SHOW COLUMNS FROM cash_drawers');
  console.log('Current columns:', cols.map(c => c.Field).join(', '));

  // Add missing columns
  const hasLowBalanceAlert = cols.some(c => c.Field === 'low_balance_alert');
  const hasCreatedBy = cols.some(c => c.Field === 'created_by');

  if (!hasLowBalanceAlert) {
    try {
      await conn.query('ALTER TABLE cash_drawers ADD COLUMN low_balance_alert DECIMAL(20,4) DEFAULT 0');
      console.log('Added low_balance_alert column');
    } catch (e) { console.log('low_balance_alert error:', e.code); }
  } else {
    console.log('low_balance_alert already exists');
  }

  if (!hasCreatedBy) {
    try {
      await conn.query('ALTER TABLE cash_drawers ADD COLUMN created_by INT UNSIGNED NULL');
      console.log('Added created_by column');
    } catch (e) { console.log('created_by error:', e.code); }
  } else {
    console.log('created_by already exists');
  }

  // Also check customers table
  console.log('\nChecking customers columns...');
  const [custCols] = await conn.query('SHOW COLUMNS FROM customers');
  console.log('Current columns:', custCols.map(c => c.Field).join(', '));

  const custHasCreatedBy = custCols.some(c => c.Field === 'created_by');
  if (!custHasCreatedBy) {
    try {
      await conn.query('ALTER TABLE customers ADD COLUMN created_by INT UNSIGNED NULL');
      console.log('Added created_by column to customers');
    } catch (e) { console.log('customers created_by error:', e.code); }
  } else {
    console.log('customers.created_by already exists');
  }

  await conn.end();
  console.log('\nDone!');
}

fix().catch(e => { console.error(e); process.exit(1); });
