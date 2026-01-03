require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTables() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('=== ALL TABLES IN DATABASE ===\n');

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);

  console.log('Tables found:', tableNames.length);
  console.log(tableNames.join(', '));
  console.log('\n=== TABLE DETAILS ===\n');

  for (const table of tableNames) {
    const [columns] = await conn.query(`SHOW COLUMNS FROM ${table}`);
    console.log(`\n[${table}] - ${columns.length} columns:`);
    columns.forEach(c => console.log(`  - ${c.Field} (${c.Type})${c.Key === 'PRI' ? ' PRIMARY' : ''}`));
  }

  await conn.end();
}

checkTables().catch(console.error);
