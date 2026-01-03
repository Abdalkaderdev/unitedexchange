require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [columns] = await conn.query('SHOW COLUMNS FROM cash_drawers');
  console.log('Columns in cash_drawers:');
  columns.forEach(c => console.log(' -', c.Field, c.Type));

  await conn.end();
}

check();
