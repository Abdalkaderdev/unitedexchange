const { pool } = require('./src/config/database');

async function debug() {
  try {
    // Check shift_summaries table
    const [summaries] = await pool.query('SELECT * FROM shift_summaries');
    console.log('=== SHIFT SUMMARIES ===');
    console.log('Total:', summaries.length);
    console.log(summaries);

    // Run the exact API query
    const [shifts] = await pool.query(`
      SELECT
        s.*,
        d.uuid as drawer_uuid,
        d.name as drawer_name,
        u.uuid as employee_uuid,
        u.full_name as employee_name,
        ss.total_transactions,
        ss.total_profit,
        ss.cancelled_transactions
      FROM shifts s
      LEFT JOIN cash_drawers d ON s.drawer_id = d.id
      JOIN users u ON s.employee_id = u.id
      LEFT JOIN shift_summaries ss ON s.id = ss.shift_id
      WHERE 1=1
      ORDER BY s.start_time DESC
      LIMIT 10
    `);
    console.log('\n=== API QUERY RESULT ===');
    console.log('Total:', shifts.length);
    if (shifts.length > 0) {
      console.log(JSON.stringify(shifts[0], null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

debug();
