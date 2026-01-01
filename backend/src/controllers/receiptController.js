/**
 * Receipt Controller
 * Handles PDF receipt generation for transactions
 */
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { generateReceipt, generateReceiptFilename } = require('../services/receiptService');
const { sendEmail } = require('../services/emailService');
const { parseDecimal, logAudit, getClientIp } = require('../utils/helpers');

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

/**
 * Email receipt to a customer
 * POST /api/transactions/:uuid/receipt/email
 */
const emailReceipt = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { email, type = 'customer', lang = 'en' } = req.body;
    const ipAddress = getClientIp(req);

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required.'
      });
    }

    // Validate type and language
    if (!['customer', 'internal'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receipt type.'
      });
    }

    if (!['en', 'ar', 'ku'].includes(lang)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language.'
      });
    }

    // Internal receipts require admin/manager role
    if (type === 'internal' && !['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Internal receipts require admin or manager role.'
      });
    }

    // Fetch transaction
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

    // Create receipt log entry
    const receiptLogUuid = uuidv4();
    await pool.query(`
      INSERT INTO receipt_logs (uuid, transaction_id, action, receipt_type, language, email_to, email_status, performed_by, ip_address)
      VALUES (?, ?, 'email', ?, ?, ?, 'pending', ?, ?)
    `, [receiptLogUuid, t.id, type, lang, email, req.user.id, ipAddress]);

    // Generate email content
    const filename = generateReceiptFilename(transaction, type);
    const subject = `Transaction Receipt - ${transaction.transactionNumber}`;
    const html = generateReceiptEmailHtml(transaction, lang);

    // Send email with PDF attachment
    const emailResult = await sendEmail(email, subject, html, [
      {
        filename: filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]);

    // Update receipt log with result
    await pool.query(`
      UPDATE receipt_logs SET email_status = ?, email_error = ? WHERE uuid = ?
    `, [
      emailResult.success ? 'sent' : 'failed',
      emailResult.error || null,
      receiptLogUuid
    ]);

    // Audit log
    await logAudit(
      req.user.id,
      'RECEIPT_EMAIL',
      'transactions',
      t.id,
      null,
      { email, type, lang, success: emailResult.success },
      ipAddress,
      'info'
    );

    if (emailResult.success) {
      res.json({
        success: true,
        message: 'Receipt sent successfully.',
        data: { email, messageId: emailResult.messageId }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send receipt email.',
        error: emailResult.error
      });
    }

  } catch (error) {
    console.error('Email receipt error:', error);
    next(error);
  }
};

/**
 * Get receipt history for a transaction
 * GET /api/transactions/:uuid/receipt/history
 */
const getReceiptHistory = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    // Get transaction ID
    const [transactions] = await pool.query(
      'SELECT id FROM transactions WHERE uuid = ? AND deleted_at IS NULL',
      [uuid]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const transactionId = transactions[0].id;

    // Get receipt logs
    const [logs] = await pool.query(`
      SELECT
        rl.uuid,
        rl.action,
        rl.receipt_type,
        rl.language,
        rl.email_to,
        rl.email_status,
        rl.created_at,
        u.full_name as performed_by_name
      FROM receipt_logs rl
      JOIN users u ON rl.performed_by = u.id
      WHERE rl.transaction_id = ?
      ORDER BY rl.created_at DESC
    `, [transactionId]);

    res.json({
      success: true,
      data: logs.map(log => ({
        uuid: log.uuid,
        action: log.action,
        receiptType: log.receipt_type,
        language: log.language,
        emailTo: log.email_to,
        emailStatus: log.email_status,
        createdAt: log.created_at,
        performedBy: log.performed_by_name
      }))
    });

  } catch (error) {
    console.error('Get receipt history error:', error);
    next(error);
  }
};

/**
 * Log a receipt action (view, download, print)
 * POST /api/transactions/:uuid/receipt/log
 */
const logReceiptAction = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { action, type = 'customer', lang = 'en' } = req.body;
    const ipAddress = getClientIp(req);

    // Validate action
    if (!['view', 'download', 'print'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "view", "download", or "print".'
      });
    }

    // Get transaction ID
    const [transactions] = await pool.query(
      'SELECT id FROM transactions WHERE uuid = ? AND deleted_at IS NULL',
      [uuid]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const transactionId = transactions[0].id;
    const receiptLogUuid = uuidv4();

    // Insert log entry
    await pool.query(`
      INSERT INTO receipt_logs (uuid, transaction_id, action, receipt_type, language, performed_by, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [receiptLogUuid, transactionId, action, type, lang, req.user.id, ipAddress]);

    res.json({
      success: true,
      message: 'Action logged successfully.',
      data: { uuid: receiptLogUuid }
    });

  } catch (error) {
    console.error('Log receipt action error:', error);
    next(error);
  }
};

/**
 * Generate HTML email template for receipt
 */
const generateReceiptEmailHtml = (transaction, lang) => {
  const isRtl = ['ar', 'ku'].includes(lang);
  const direction = isRtl ? 'rtl' : 'ltr';

  const labels = {
    en: {
      title: 'Transaction Receipt',
      transactionNumber: 'Transaction Number',
      date: 'Date',
      customer: 'Customer',
      amount: 'Amount',
      received: 'Received',
      paid: 'Paid',
      rate: 'Exchange Rate',
      attached: 'Your transaction receipt is attached to this email.',
      footer: 'Thank you for choosing United Exchange.'
    },
    ar: {
      title: 'إيصال المعاملة',
      transactionNumber: 'رقم المعاملة',
      date: 'التاريخ',
      customer: 'العميل',
      amount: 'المبلغ',
      received: 'المستلم',
      paid: 'المدفوع',
      rate: 'سعر الصرف',
      attached: 'إيصال المعاملة مرفق بهذا البريد الإلكتروني.',
      footer: 'شكراً لاختياركم يونايتد للصرافة.'
    },
    ku: {
      title: 'پسوولەی مامەڵە',
      transactionNumber: 'ژمارەی مامەڵە',
      date: 'بەروار',
      customer: 'کڕیار',
      amount: 'بڕ',
      received: 'وەرگیراو',
      paid: 'دراو',
      rate: 'ڕێژەی ئاڵاوگۆڕین',
      attached: 'پسوولەی مامەڵەکەت لەگەڵ ئەم ئیمەیڵە هاوپێچ کراوە.',
      footer: 'سوپاس بۆ هەڵبژاردنی یونایتید ئێکسچەینج.'
    }
  };

  const l = labels[lang] || labels.en;

  return `
    <!DOCTYPE html>
    <html dir="${direction}">
    <head>
      <meta charset="utf-8">
      <title>${l.title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5; direction: ${direction};">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px;">
              <tr>
                <td style="background-color: #1e40af; padding: 24px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">United Exchange</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${l.title}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  <table width="100%" cellpadding="8">
                    <tr>
                      <td style="color: #666;">${l.transactionNumber}:</td>
                      <td style="color: #333; font-weight: bold;">${transaction.transactionNumber}</td>
                    </tr>
                    <tr>
                      <td style="color: #666;">${l.date}:</td>
                      <td style="color: #333;">${new Date(transaction.transactionDate).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style="color: #666;">${l.customer}:</td>
                      <td style="color: #333;">${transaction.customerName}</td>
                    </tr>
                    <tr>
                      <td style="color: #666;">${l.received}:</td>
                      <td style="color: #16a34a; font-weight: bold;">${transaction.currencyIn.symbol} ${transaction.amountIn.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style="color: #666;">${l.paid}:</td>
                      <td style="color: #dc2626; font-weight: bold;">${transaction.currencyOut.symbol} ${transaction.amountOut.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style="color: #666;">${l.rate}:</td>
                      <td style="color: #333;">${transaction.exchangeRate}</td>
                    </tr>
                  </table>
                  <div style="background-color: #eff6ff; padding: 16px; border-radius: 4px; margin-top: 24px;">
                    <p style="color: #1e40af; margin: 0;">${l.attached}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f5f5f5; padding: 24px; border-radius: 0 0 8px 8px; text-align: center;">
                  <p style="color: #666; margin: 0;">${l.footer}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

module.exports = {
  getReceipt,
  emailReceipt,
  getReceiptHistory,
  logReceiptAction
};
