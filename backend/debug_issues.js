const { pool } = require('./src/config/database');

async function debug() {
  try {
    // Check currencies
    const [currencies] = await pool.query('SELECT id, code, is_active FROM currencies');
    console.log('\n=== CURRENCIES ===');
    currencies.forEach(c => console.log(`  ${c.code}: is_active=${c.is_active}`));

    // Check transactions with dates
    const [txns] = await pool.query(`
      SELECT id, uuid, customer_name, transaction_date,
             DATE(transaction_date) as txn_date,
             created_at
      FROM transactions
      ORDER BY id DESC LIMIT 5
    `);
    console.log('\n=== TRANSACTIONS ===');
    txns.forEach(t => {
      console.log(`  ID: ${t.id}, Customer: ${t.customer_name}`);
      console.log(`    transaction_date: ${t.transaction_date}`);
      console.log(`    DATE(transaction_date): ${t.txn_date}`);
    });

    // Check today's date on server
    const [serverDate] = await pool.query('SELECT CURDATE() as today, NOW() as now');
    console.log('\n=== SERVER DATE ===');
    console.log(`  Today: ${serverDate[0].today}`);
    console.log(`  Now: ${serverDate[0].now}`);

    // Check customers
    const [customers] = await pool.query('SELECT id, uuid, full_name, phone FROM customers LIMIT 5');
    console.log('\n=== CUSTOMERS ===');
    if (customers.length === 0) {
      console.log('  No customers found!');
    } else {
      customers.forEach(c => console.log(`  ${c.id}: ${c.full_name} (${c.phone})`));
    }

    // Check if transaction has customer_id
    const [txnCustomers] = await pool.query(`
      SELECT t.id, t.customer_name, t.customer_id, c.full_name as linked_customer
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LIMIT 5
    `);
    console.log('\n=== TRANSACTION CUSTOMER LINKS ===');
    txnCustomers.forEach(t => {
      console.log(`  Txn ${t.id}: customer_name="${t.customer_name}", customer_id=${t.customer_id}, linked="${t.linked_customer}"`);
    });

    // Check admin permissions
    const [perms] = await pool.query(`
      SELECT p.code
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role = 'admin'
      ORDER BY p.code
    `);
    console.log('\n=== ADMIN PERMISSIONS ===');
    console.log(`  Total: ${perms.length}`);
    const userPerms = perms.filter(p => p.code.startsWith('users.'));
    console.log(`  User permissions: ${userPerms.map(p => p.code).join(', ') || 'NONE'}`);

    // Check all permissions exist
    const [allPerms] = await pool.query('SELECT id, code FROM permissions WHERE code LIKE "users.%"');
    console.log('\n=== ALL USER PERMISSIONS IN DB ===');
    allPerms.forEach(p => console.log(`  ${p.id}: ${p.code}`));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

debug();
