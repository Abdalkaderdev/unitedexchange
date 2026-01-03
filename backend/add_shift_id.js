const { pool } = require('./src/config/database');

async function addShiftId() {
  try {
    console.log('Adding shift_id column to transactions table...');

    // First check if it exists
    const [cols] = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'united_exchange'
      AND table_name = 'transactions'
      AND column_name = 'shift_id'
    `);

    if (cols.length > 0) {
      console.log('shift_id column already exists');
    } else {
      await pool.query(`
        ALTER TABLE transactions
        ADD COLUMN shift_id INT NULL,
        ADD INDEX idx_shift_id (shift_id)
      `);
      console.log('shift_id column added successfully');
    }

    // Also add payment_method and reference_number if missing
    const [paymentCols] = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'united_exchange'
      AND table_name = 'transactions'
      AND column_name = 'payment_method'
    `);

    if (paymentCols.length === 0) {
      await pool.query(`
        ALTER TABLE transactions
        ADD COLUMN payment_method ENUM('cash', 'card', 'bank_transfer', 'cheque', 'other') DEFAULT 'cash',
        ADD COLUMN reference_number VARCHAR(100) NULL
      `);
      console.log('payment_method and reference_number columns added');
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

addShiftId();
