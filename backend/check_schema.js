const { pool } = require('./src/config/database');

async function check() {
  try {
    const [rows] = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'united_exchange'
      AND table_name = 'transactions'
    `);
    console.log('=== TRANSACTIONS TABLE COLUMNS ===');
    console.log(rows.map(r => r.COLUMN_NAME).join('\n'));

    const hasShiftId = rows.some(r => r.COLUMN_NAME === 'shift_id');
    console.log('\nshift_id column exists:', hasShiftId);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
