/**
 * Receipt Controller
 * Handles PDF receipt generation for transactions
 */
const { pool } = require('../config/database');
const { generateReceipt, generateReceiptFilename } = require('../services/receiptService');
const { parseDecimal } = require('../utils/helpers');

/**
 * Get receipt for a transaction
 * GET /api/transactions/:uuid/receipt
 *
 * Query parameters:
 * - type: 'customer' (default) or 'internal' (includes profit/commission)
 * - download: 'true' to force download, otherwise inline
 * - lang: 'en' (default), 'ar', or 'ku' for language
 */
const getReceipt = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const {
      type = 'customer',
      download = 'false',
      lang = 'en'
    } = req.query;

    // Validate type parameter
    if (!['customer', 'internal'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receipt type. Use "customer" or "internal".'
      });
    }

    // Validate language parameter
    if (!['en', 'ar', 'ku'].includes(lang)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language. Use "en", "ar", or "ku".'
      });
    }

    // Only admin and managers can view internal receipts with profit info
    if (type === 'internal' && !['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Internal receipts require admin or manager role.'
      });
    }

    // Fetch transaction with full details
    const [transactions] = await pool.query(`
      SELECT
        t.id,
        t.uuid,
        t.transaction_number,
        t.customer_name,
        t.customer_phone,
        t.customer_id_type,
        t.customer_id_number,
        t.currency_in_id,
        t.currency_out_id,
        t.amount_in,
        t.amount_out,
        t.exchange_rate,
        t.market_rate,
        t.profit,
        t.commission,
        t.notes,
        t.status,
        t.transaction_date,
        t.created_at,
        ci.code as currency_in_code,
        ci.symbol as currency_in_symbol,
        ci.name as currency_in_name,
        co.code as currency_out_code,
        co.symbol as currency_out_symbol,
        co.name as currency_out_name,
        u.uuid as employee_uuid,
        u.full_name as employee_name
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      WHERE t.uuid = ? AND t.deleted_at IS NULL
    `, [uuid]);

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const t = transactions[0];

    // Check if transaction is cancelled
    if (t.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate receipt for cancelled transaction.'
      });
    }

    // Transform to receipt format
    const transaction = {
      uuid: t.uuid,
      transactionNumber: t.transaction_number,
      customerName: t.customer_name,
      customerPhone: t.customer_phone,
      customerIdType: t.customer_id_type,
      customerIdNumber: t.customer_id_number,
      currencyIn: {
        id: t.currency_in_id,
        code: t.currency_in_code,
        symbol: t.currency_in_symbol,
        name: t.currency_in_name
      },
      currencyOut: {
        id: t.currency_out_id,
        code: t.currency_out_code,
        symbol: t.currency_out_symbol,
        name: t.currency_out_name
      },
      amountIn: parseDecimal(t.amount_in),
      amountOut: parseDecimal(t.amount_out),
      exchangeRate: parseDecimal(t.exchange_rate, 6),
      marketRate: parseDecimal(t.market_rate, 6),
      profit: parseDecimal(t.profit),
      commission: parseDecimal(t.commission),
      notes: t.notes,
      status: t.status,
      transactionDate: t.transaction_date,
      employee: {
        uuid: t.employee_uuid,
        fullName: t.employee_name
      }
    };

    // Generate PDF
    const includeProfit = type === 'internal';
    const pdfBuffer = await generateReceipt(transaction, {
      includeProfit,
      language: lang
    });

    // Generate filename
    const filename = generateReceiptFilename(transaction, type);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);

    // Set Content-Disposition based on download preference
    const disposition = download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

    // Cache control - allow caching for 5 minutes
    res.setHeader('Cache-Control', 'private, max-age=300');

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Receipt generation error:', error);
    next(error);
  }
};

module.exports = {
  getReceipt
};
