const { pool } = require('../config/database');
const emailService = require('../services/emailService');
const { logAudit, parseDecimal, getClientIp } = require('../utils/helpers');

/**
 * Send receipt via email
 */
const sendReceipt = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { email } = req.body;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    // Fetch transaction details
    const [transactions] = await pool.query(`
      SELECT 
        t.*,
        ci.code as currency_in_code,
        co.code as currency_out_code,
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

    const transaction = transactions[0];

    // Prepare data for email
    const transactionData = {
      transactionNumber: transaction.transaction_number,
      customerName: transaction.customer_name,
      amountIn: parseDecimal(transaction.amount_in),
      currencyIn: transaction.currency_in_code,
      amountOut: parseDecimal(transaction.amount_out),
      currencyOut: transaction.currency_out_code,
      exchangeRate: parseDecimal(transaction.exchange_rate),
      date: transaction.transaction_date,
      employeeName: transaction.employee_name,
      status: transaction.status
    };

    // Send email
    const emailResult = await emailService.sendReceiptEmail(email, transactionData);

    // Prepare log data
    const emailStatus = emailResult.success ? 'sent' : 'failed';
    const emailError = emailResult.success ? null : emailResult.error;

    // Log to receipt_logs
    await pool.query(`
      INSERT INTO receipt_logs 
      (uuid, transaction_id, action, receipt_type, email_to, email_status, email_error, performed_by, ip_address)
      VALUES (UUID(), ?, 'email', 'customer', ?, ?, ?, ?, ?)
    `, [
      transaction.id,
      email,
      emailStatus,
      emailError,
      userId,
      getClientIp(req)
    ]);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send email.'
      });
    }

    res.json({
      success: true,
      message: 'Receipt sent successfully.'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get receipt (PDF generation)
 */
const getReceipt = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { type = 'customer', download = 'false', lang = 'en' } = req.query;

    const [transactions] = await pool.query(`
      SELECT
        t.*,
        ci.code as currency_in_code, ci.name as currency_in_name,
        co.code as currency_out_code, co.name as currency_out_name,
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

    const transaction = transactions[0];

    // For now, return JSON data - PDF generation can be added later
    res.json({
      success: true,
      data: {
        transactionNumber: transaction.transaction_number,
        customerName: transaction.customer_name,
        customerPhone: transaction.customer_phone,
        amountIn: parseDecimal(transaction.amount_in),
        currencyIn: transaction.currency_in_code,
        currencyInName: transaction.currency_in_name,
        amountOut: parseDecimal(transaction.amount_out),
        currencyOut: transaction.currency_out_code,
        currencyOutName: transaction.currency_out_name,
        exchangeRate: parseDecimal(transaction.exchange_rate),
        date: transaction.transaction_date,
        employeeName: transaction.employee_name,
        status: transaction.status,
        notes: transaction.notes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Email receipt
 */
const emailReceipt = async (req, res, next) => {
  return sendReceipt(req, res, next);
};

/**
 * Get receipt history for a transaction
 */
const getReceiptHistory = async (req, res, next) => {
  try {
    const { uuid } = req.params;

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

    const [logs] = await pool.query(`
      SELECT
        rl.action,
        rl.receipt_type,
        rl.email_to,
        rl.email_status,
        rl.created_at,
        u.full_name as performed_by_name
      FROM receipt_logs rl
      LEFT JOIN users u ON rl.performed_by = u.id
      WHERE rl.transaction_id = ?
      ORDER BY rl.created_at DESC
    `, [transactions[0].id]);

    res.json({
      success: true,
      data: logs.map(log => ({
        action: log.action,
        receiptType: log.receipt_type,
        emailTo: log.email_to,
        emailStatus: log.email_status,
        performedBy: log.performed_by_name,
        createdAt: log.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log receipt action
 */
const logReceiptAction = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { action, receiptType = 'customer' } = req.body;
    const userId = req.user.id;

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

    await pool.query(`
      INSERT INTO receipt_logs
      (uuid, transaction_id, action, receipt_type, performed_by, ip_address)
      VALUES (UUID(), ?, ?, ?, ?, ?)
    `, [
      transactions[0].id,
      action,
      receiptType,
      userId,
      getClientIp(req)
    ]);

    res.json({
      success: true,
      message: 'Receipt action logged.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendReceipt,
  getReceipt,
  emailReceipt,
  getReceiptHistory,
  logReceiptAction
};
