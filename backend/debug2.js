const { pool } = require('./src/config/database');

async function debug() {
  // Check transaction status
  const [txns] = await pool.query('SELECT id, status, deleted_at, DATE(transaction_date) as txn_date FROM transactions');
  console.log('Transactions:', txns);

  // Test the exact daily report query
  const today = new Date().toISOString().split('T')[0];
  console.log('\nToday:', today);

  const [report] = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM transactions t
    WHERE DATE(t.transaction_date) = ?
      AND t.deleted_at IS NULL
      AND t.status = 'completed'
  `, [today]);
  console.log('Daily report count:', report[0].cnt);

  // Without status filter
  const [noStatus] = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM transactions t
    WHERE DATE(t.transaction_date) = ?
      AND t.deleted_at IS NULL
  `, [today]);
  console.log('Without status filter:', noStatus[0].cnt);

  process.exit();
}
debug();
