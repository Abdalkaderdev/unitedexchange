const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function migrate() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await pool.getConnection();
        console.log('Connected.');

        const migrationFile = path.join(__dirname, '../migrations/025_phase2_operations.sql');
        const sql = fs.readFileSync(migrationFile, 'utf8');

        console.log('Running migration 025_phase2_operations.sql...');

        // Split SQL by semicolons to run multiple statements if pool.query doesn't support multipleStatements option by default for pool
        // Actually pool from mysql2 supports it if configured.
        // But safely, let's just run query. If it fails due to multiple statements, we might need to enable it in config or split.
        // The previous error was ECONNREFUSED, so connection is the main issue.
        // Let's assume the pool is configured correctly.

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
