/**
 * Import Controller
 * Handles bulk CSV/Excel imports for transactions
 */
const fs = require('fs');
const csv = require('csv-parser');
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { parseDecimal, logAudit, getClientIp } = require('../utils/helpers');

/**
 * Handle Transaction Import
 * Expected CSV Columns: 
 * Date, CustomerName, CustomerPhone, CurrencyIn, AmountIn, CurrencyOut, AmountOut, ExchangeRate, Status, Notes
 */
const importTransactions = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const results = [];
    const errors = [];
    let rowCount = 0;
    let successCount = 0;

    const filePath = req.file.path;

    try {
        // 1. Load Caches for validation (Currencies, Users?)
        // We need to map Currency Codes to IDs.
        const [currencies] = await pool.query('SELECT id, code FROM currencies');
        const currencyMap = currencies.reduce((acc, curr) => {
            acc[curr.code.toUpperCase()] = curr.id;
            return acc;
        }, {});

        const processingPromise = new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', resolve)
                .on('error', reject);
        });

        await processingPromise;

        // Process each row
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const row of results) {
                rowCount++;

                // Basic Validation
                const currInCode = row['CurrencyIn']?.toUpperCase();
                const currOutCode = row['CurrencyOut']?.toUpperCase();
                const amountIn = parseFloat(row['AmountIn']);
                const amountOut = parseFloat(row['AmountOut']);
                const customerName = row['CustomerName'];

                if (!currInCode || !currOutCode || isNaN(amountIn) || isNaN(amountOut)) {
                    errors.push({ row: rowCount, message: 'Missing required fields or invalid numbers' });
                    continue;
                }

                if (!currencyMap[currInCode] || !currencyMap[currOutCode]) {
                    errors.push({ row: rowCount, message: `Invalid currency code: ${currInCode} or ${currOutCode}` });
                    continue;
                }

                // Resolve Customer
                let customerId = null;
                if (customerName) {
                    // Try modify to find by phone if present, detailed logic omitted for brevity
                    // Simple lookup by name
                    const [custs] = await connection.query('SELECT id FROM customers WHERE full_name = ? LIMIT 1', [customerName]);
                    if (custs.length > 0) {
                        customerId = custs[0].id;
                    } else {
                        // Create new customer? Or fail? Let's auto-create for import convenience
                        const custUuid = uuidv4();
                        const [res] = await connection.query(
                            'INSERT INTO customers (uuid, full_name, created_by) VALUES (?, ?, ?)',
                            [custUuid, customerName, req.user.id]
                        );
                        customerId = res.insertId;
                    }
                }

                // Insert Transaction
                const uuid = uuidv4();
                const profit = 0; // simplified

                await connection.query(
                    `INSERT INTO transactions 
           (uuid, customer_id, customer_name, currency_in_id, currency_out_id, 
            amount_in, amount_out, exchange_rate, status, notes, employee_id, transaction_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        uuid, customerId, customerName, currencyMap[currInCode], currencyMap[currOutCode],
                        amountIn, amountOut, row['ExchangeRate'] || 0, 'completed',
                        `Imported Row ${rowCount}: ` + (row['Notes'] || ''), req.user.id
                    ]
                );
                successCount++;
            }

            await connection.commit();

            // Cleanup file
            fs.unlinkSync(filePath);

            // Log Audit
            await logAudit(req.user.id, 'IMPORT_TRANSACTIONS', 'transactions', null, null,
                { total: rowCount, success: successCount, failed: errors.length }, getClientIp(req), 'info');

            res.json({
                success: true,
                message: 'Import completed',
                data: {
                    totalRows: rowCount,
                    imported: successCount,
                    failed: errors.length,
                    errors: errors
                }
            });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        next(error);
    }
};

module.exports = {
    importTransactions
};
