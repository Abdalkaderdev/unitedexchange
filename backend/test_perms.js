const { pool } = require('./src/config/database');

async function test() {
  // Get all role permissions
  const [rolePerms] = await pool.query(`
    SELECT role, permission_id
    FROM role_permissions
  `);

  console.log('Total role_permissions rows:', rolePerms.length);

  // Count by role
  const roles = ['admin', 'manager', 'teller', 'viewer'];
  for (const role of roles) {
    const count = rolePerms.filter(rp => rp.role === role).length;
    console.log(`${role}: ${count} permissions`);
  }

  // Show admin permissions
  const adminPerms = rolePerms.filter(rp => rp.role === 'admin');
  console.log('\nAdmin permission IDs:', adminPerms.map(p => p.permission_id));

  process.exit();
}

test();
