const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function migrate() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await pool.getConnection();
        console.log('Connected.');

        const migrationFile = path.join(__dirname, '../migrations/026_closing_wizard.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('Running migration 026_closing_wizard.sql...');

        await connection.query(sql);
        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

migrate();
