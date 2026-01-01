const { pool } = require('./src/config/database');

async function fixColumn() {
  try {
    // Check if column exists
    const [cols] = await pool.query('SHOW COLUMNS FROM cash_drawers');
    const hasColumn = cols.some(c => c.Field === 'low_balance_alert');

    if (hasColumn) {
      console.log('Column low_balance_alert already exists');
    } else {
      console.log('Adding low_balance_alert column...');
      await pool.query('ALTER TABLE cash_drawers ADD COLUMN low_balance_alert DECIMAL(20,4) DEFAULT 0');
      console.log('Column added successfully');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixColumn();
