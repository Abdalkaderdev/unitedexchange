/**
 * Transaction Controller
 * Production-ready with soft deletes, comprehensive audit logging, and safe decimal handling
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logAudit, getClientIp, generateTransactionNumber, parseDecimal } = require('../utils/helpers');

/**
 * Get transactions with pagination and filters
 * Excludes soft-deleted transactions
 */
const getTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      employeeId,
      currencyIn,
      currencyOut,
      customerName,
      status = 'completed',
      includeDeleted = false
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT
        t.id,
        t.uuid,
        t.transaction_number,
        t.customer_id,
        t.customer_name,
        t.customer_phone,
        t.amount_in,
        t.amount_out,
        t.exchange_rate,
        t.profit,
        t.commission,
        t.notes,
        t.status,
        t.transaction_date,
        t.created_at,
        ci.id as currency_in_id,
        ci.code as currency_in_code,
        ci.symbol as currency_in_symbol,
        co.id as currency_out_id,
        co.code as currency_out_code,
        co.symbol as currency_out_symbol,
        u.uuid as employee_uuid,
        u.full_name as employee_name,
        c.uuid as customer_uuid,
        c.is_vip as customer_is_vip
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];

    // Exclude soft-deleted unless explicitly requested by admin
    if (!includeDeleted || req.user.role !== 'admin') {
      query += ' AND t.deleted_at IS NULL';
    }

    if (status && status !== 'all') {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (startDate) {
      query += ' AND DATE(t.transaction_date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(t.transaction_date) <= ?';
      params.push(endDate);
    }
    if (employeeId) {
      query += ' AND u.uuid = ?';
      params.push(employeeId);
    }
    if (currencyIn) {
      query += ' AND ci.code = ?';
      params.push(currencyIn);
    }
    if (currencyOut) {
      query += ' AND co.code = ?';
      params.push(currencyOut);
    }
    if (customerName) {
      query += ' AND t.customer_name LIKE ?';
      params.push(`%${customerName}%`);
    }

    // Count query for pagination
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Add ordering and pagination
    query += ' ORDER BY t.transaction_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [transactions] = await pool.query(query, params);

    res.json({
      success: true,
      data: transactions.map(t => ({
        uuid: t.uuid,
        transactionNumber: t.transaction_number,
        customer: t.customer_uuid ? {
          uuid: t.customer_uuid,
          fullName: t.customer_name,
          phone: t.customer_phone,
          isVip: Boolean(t.customer_is_vip)
        } : null,
        customerName: t.customer_name,
        customerPhone: t.customer_phone,
        currencyIn: {
          id: t.currency_in_id,
          code: t.currency_in_code,
          symbol: t.currency_in_symbol
        },
        currencyOut: {
          id: t.currency_out_id,
          code: t.currency_out_code,
          symbol: t.currency_out_symbol
        },
        amountIn: parseDecimal(t.amount_in),
        amountOut: parseDecimal(t.amount_out),
        exchangeRate: parseDecimal(t.exchange_rate, 6),
        profit: parseDecimal(t.profit),
        commission: parseDecimal(t.commission),
        notes: t.notes,
        status: t.status,
        transactionDate: t.transaction_date,
        employee: {
          uuid: t.employee_uuid,
          fullName: t.employee_name
        },
        createdAt: t.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new transaction
 */
const createTransaction = async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      customerIdType,
      customerIdNumber,
      customerId, // Optional: UUID of existing customer
      currencyInId,
      currencyOutId,
      amountIn,
      amountOut,
      exchangeRate,
      marketRate,
      commission = 0,
      notes
    } = req.body;

    const ipAddress = getClientIp(req);

    // Verify currencies exist and are active
    const [currencies] = await pool.query(
      'SELECT id, code FROM currencies WHERE id IN (?, ?) AND is_active = TRUE',
      [currencyInId, currencyOutId]
    );

    if (currencies.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid currency IDs or currencies are not active.'
      });
    }

    // Validate customer if provided
    let customerDbId = null;
    let resolvedCustomerName = customerName;
    let resolvedCustomerPhone = customerPhone;

    if (customerId) {
      const [customers] = await pool.query(
        'SELECT id, full_name, phone, is_blocked, block_reason FROM customers WHERE uuid = ?',
        [customerId]
      );

      if (customers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Customer not found.'
        });
      }

      const customer = customers[0];

      // Check if customer is blocked
      if (customer.is_blocked) {
        return res.status(400).json({
          success: false,
          message: `Cannot create transaction for blocked customer. Reason: ${customer.block_reason || 'Not specified'}`
        });
      }

      customerDbId = customer.id;
      // Use customer data if not provided in request
      resolvedCustomerName = customerName || customer.full_name;
      resolvedCustomerPhone = customerPhone || customer.phone;
    }

    const uuid = uuidv4();

    // Calculate profit using safe decimal math
    // Profit = (Applied Rate - Market Rate) * Amount In
    const appliedRate = parseDecimal(exchangeRate, 6);
    const mktRate = marketRate ? parseDecimal(marketRate, 6) : appliedRate;
    const profit = parseDecimal((appliedRate - mktRate) * parseDecimal(amountIn), 2);

    const [result] = await pool.query(
      `INSERT INTO transactions
       (uuid, customer_id, customer_name, customer_phone, customer_id_type, customer_id_number,
        currency_in_id, currency_out_id, amount_in, amount_out, exchange_rate,
        market_rate, profit, commission, notes, employee_id, transaction_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'completed')`,
      [
        uuid,
        customerDbId,
        resolvedCustomerName,
        resolvedCustomerPhone || null,
        customerIdType || null,
        customerIdNumber || null,
        currencyInId,
        currencyOutId,
        parseDecimal(amountIn),
        parseDecimal(amountOut),
        appliedRate,
        mktRate,
        profit,
        parseDecimal(commission),
        notes || null,
        req.user.id
      ]
    );

    // Log audit with full details
    await logAudit(
      req.user.id,
      'CREATE',
      'transactions',
      result.insertId,
      null,
      {
        uuid,
        customerId: customerId || null,
        customerName: resolvedCustomerName,
        currencyInId,
        currencyOutId,
        amountIn: parseDecimal(amountIn),
        amountOut: parseDecimal(amountOut),
        exchangeRate: appliedRate,
        profit
      },
      ipAddress,
      'info'
    );

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully.',
      data: {
        uuid,
        customerId: customerId || null,
        customerName: resolvedCustomerName,
        customerPhone: resolvedCustomerPhone,
        currencyInId,
        currencyOutId,
        amountIn: parseDecimal(amountIn),
        amountOut: parseDecimal(amountOut),
        exchangeRate: appliedRate,
        profit
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single transaction by UUID
 */
const getTransaction = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    const [transactions] = await pool.query(`
      SELECT
        t.*,
        ci.code as currency_in_code,
        ci.symbol as currency_in_symbol,
        ci.name as currency_in_name,
        co.code as currency_out_code,
        co.symbol as currency_out_symbol,
        co.name as currency_out_name,
        u.uuid as employee_uuid,
        u.full_name as employee_name,
        cb.full_name as cancelled_by_name,
        c.uuid as customer_uuid,
        c.full_name as customer_full_name,
        c.is_vip as customer_is_vip,
        c.is_blocked as customer_is_blocked
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      LEFT JOIN users cb ON t.cancelled_by = cb.id
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.uuid = ? AND t.deleted_at IS NULL
    `, [uuid]);

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const t = transactions[0];

    res.json({
      success: true,
      data: {
        uuid: t.uuid,
        transactionNumber: t.transaction_number,
        customer: t.customer_uuid ? {
          uuid: t.customer_uuid,
          fullName: t.customer_full_name,
          isVip: Boolean(t.customer_is_vip),
          isBlocked: Boolean(t.customer_is_blocked)
        } : null,
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
        },
        paymentMethod: t.payment_method || 'cash',
        referenceNumber: t.reference_number || null,
        cancellation: t.status === 'cancelled' ? {
          cancelledBy: t.cancelled_by_name,
          cancelledAt: t.cancelled_at,
          reason: t.cancellation_reason
        } : null,
        createdAt: t.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update transaction (editable fields only)
 * Cannot update cancelled transactions
 */
const updateTransaction = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const {
      customerName,
      customerPhone,
      customerIdType,
      customerIdNumber,
      notes,
      paymentMethod,
      referenceNumber
    } = req.body;
    const ipAddress = getClientIp(req);

    // Get transaction
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE uuid = ? AND deleted_at IS NULL',
      [uuid]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const transaction = transactions[0];

    if (transaction.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a cancelled transaction.'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    const oldValues = {};
    const newValues = {};

    if (customerName !== undefined) {
      updates.push('customer_name = ?');
      params.push(customerName);
      oldValues.customerName = transaction.customer_name;
      newValues.customerName = customerName;
    }

    if (customerPhone !== undefined) {
      updates.push('customer_phone = ?');
      params.push(customerPhone || null);
      oldValues.customerPhone = transaction.customer_phone;
      newValues.customerPhone = customerPhone;
    }

    if (customerIdType !== undefined) {
      updates.push('customer_id_type = ?');
      params.push(customerIdType || null);
      oldValues.customerIdType = transaction.customer_id_type;
      newValues.customerIdType = customerIdType;
    }

    if (customerIdNumber !== undefined) {
      updates.push('customer_id_number = ?');
      params.push(customerIdNumber || null);
      oldValues.customerIdNumber = transaction.customer_id_number;
      newValues.customerIdNumber = customerIdNumber;
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes || null);
      oldValues.notes = transaction.notes;
      newValues.notes = notes;
    }

    if (paymentMethod !== undefined) {
      updates.push('payment_method = ?');
      params.push(paymentMethod);
      oldValues.paymentMethod = transaction.payment_method;
      newValues.paymentMethod = paymentMethod;
    }

    if (referenceNumber !== undefined) {
      updates.push('reference_number = ?');
      params.push(referenceNumber || null);
      oldValues.referenceNumber = transaction.reference_number;
      newValues.referenceNumber = referenceNumber;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    // Add uuid to params for WHERE clause
    params.push(uuid);

    await pool.query(
      `UPDATE transactions SET ${updates.join(', ')} WHERE uuid = ?`,
      params
    );

    // Log audit
    await logAudit(
      req.user.id,
      'UPDATE',
      'transactions',
      transaction.id,
      oldValues,
      newValues,
      ipAddress,
      'info'
    );

    res.json({
      success: true,
      message: 'Transaction updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel transaction (soft state change)
 */
const cancelTransaction = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { reason } = req.body;
    const ipAddress = getClientIp(req);

    // Get transaction
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE uuid = ? AND deleted_at IS NULL',
      [uuid]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const transaction = transactions[0];

    if (transaction.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is already cancelled.'
      });
    }

    // Update status
    await pool.query(
      `UPDATE transactions
       SET status = 'cancelled', cancelled_by = ?, cancelled_at = NOW(), cancellation_reason = ?
       WHERE uuid = ?`,
      [req.user.id, reason || null, uuid]
    );

    // Log audit
    await logAudit(
      req.user.id,
      'CANCEL',
      'transactions',
      transaction.id,
      { status: transaction.status },
      { status: 'cancelled', reason },
      ipAddress,
      'warning'
    );

    res.json({
      success: true,
      message: 'Transaction cancelled successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete transaction (admin only)
 */
const deleteTransaction = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { reason } = req.body;
    const ipAddress = getClientIp(req);

    // Admin only check is done in route
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE uuid = ? AND deleted_at IS NULL',
      [uuid]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    const transaction = transactions[0];

    // Soft delete - never hard delete transactions
    await pool.query(
      `UPDATE transactions SET deleted_at = NOW(), deleted_by = ? WHERE uuid = ?`,
      [req.user.id, uuid]
    );

    // Log audit with critical severity
    await logAudit(
      req.user.id,
      'SOFT_DELETE',
      'transactions',
      transaction.id,
      {
        transactionNumber: transaction.transaction_number,
        customerName: transaction.customer_name,
        amountIn: parseDecimal(transaction.amount_in),
        amountOut: parseDecimal(transaction.amount_out)
      },
      { reason, deletedAt: new Date().toISOString() },
      ipAddress,
      'critical'
    );

    res.json({
      success: true,
      message: 'Transaction deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  cancelTransaction,
  deleteTransaction
};
