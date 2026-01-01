const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function checkAdmin() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('Checking users table...\n');

  // Get all users
  const [users] = await conn.query('SELECT id, uuid, username, email, password, full_name, role, is_active FROM users');

  if (users.length === 0) {
    console.log('No users found in database!');
  } else {
    console.log('Users found:', users.length);
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Username: ${u.username}, Role: ${u.role}, Active: ${u.is_active}`);
      console.log(`  Password hash: ${u.password.substring(0, 20)}...`);
    });
  }

  // Check if admin exists
  const [admin] = await conn.query('SELECT * FROM users WHERE username = ?', ['admin']);

  if (admin.length === 0) {
    console.log('\nAdmin user does NOT exist!');

    // Create admin user
    console.log('\nCreating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const uuid = require('crypto').randomUUID();

    await conn.query(
      'INSERT INTO users (uuid, username, email, password, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid, 'admin', 'admin@unitedexchange.com', hashedPassword, 'System Administrator', 'admin', true]
    );
    console.log('Admin user created!');
  } else {
    console.log('\nAdmin user exists:', admin[0].username);
    console.log('Email:', admin[0].email);
    console.log('Role:', admin[0].role);
    console.log('Active:', admin[0].is_active);

    // Test password
    const isMatch = await bcrypt.compare('admin123', admin[0].password);
    console.log('\nPassword "admin123" matches:', isMatch);

    if (!isMatch) {
      console.log('\nResetting admin password...');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await conn.query('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'admin']);
      console.log('Password reset to: admin123');
    }
  }

  await conn.end();
  console.log('\nDone!');
}

checkAdmin().catch(e => { console.error(e); process.exit(1); });
