const { pool } = require('./src/config/database');

async function debug() {
  try {
    // Check shifts table structure
    const [cols] = await pool.query('DESCRIBE shifts');
    console.log('=== SHIFTS TABLE STRUCTURE ===');
    cols.forEach(c => console.log(`  ${c.Field}: ${c.Type} ${c.Null === 'YES' ? 'NULL' : 'NOT NULL'}`));

    // Get all shift data
    const [shifts] = await pool.query('SELECT * FROM shifts');
    console.log('\n=== SHIFTS DATA ===');
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
