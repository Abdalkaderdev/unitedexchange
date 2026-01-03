require('dotenv').config();
const mysql = require('mysql2/promise');

async function fix() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    await conn.query('ALTER TABLE cash_drawers ADD COLUMN assigned_to INT UNSIGNED NULL');
    console.log('Column assigned_to added successfully');
  } catch(e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists');
    } else {
      console.log('Error:', e.message);
    }
  }

  await conn.end();
}

fix();
