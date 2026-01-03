const { pool } = require('./src/config/database');

async function debug() {
  try {
    // Check shifts table
    const [shifts] = await pool.query('SELECT * FROM shifts');
    console.log('=== SHIFTS TABLE ===');
    console.log('Total shifts:', shifts.length);
    if (shifts.length > 0) {
      shifts.forEach(s => {
        console.log(`  ID: ${s.id}, UUID: ${s.uuid}, User: ${s.user_id}, Status: ${s.status}`);
        console.log(`    Start: ${s.start_time}, End: ${s.end_time}`);
      });
    } else {
      console.log('  No shifts found');
    }

    // Check shift_balances table
    const [balances] = await pool.query('SELECT * FROM shift_balances');
    console.log('\n=== SHIFT BALANCES ===');
    console.log('Total balances:', balances.length);

    // Check what the API would return
    const [apiResult] = await pool.query(`
      SELECT
        s.id,
        s.uuid,
        s.user_id,
        s.status,
        s.start_time,
        s.end_time,
        s.notes,
        u.full_name as employee_name,
        u.username
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      ORDER BY s.start_time DESC
      LIMIT 10
    `);
    console.log('\n=== API QUERY RESULT ===');
    console.log('Results:', apiResult.length);
    apiResult.forEach(r => {
      console.log(`  ${r.employee_name} (${r.username}): ${r.status} - Started: ${r.start_time}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

debug();
