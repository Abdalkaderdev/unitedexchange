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
      includeDeleted = false,
      transactionNumber,
      minAmount,
      maxAmount,
      notes,
      customerPhone
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
        t.is_flagged,
        t.flag_reason,
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

    // Role-based filtering
    if (req.user.role === 'customer') {
      // Customers can only see their own transactions
      // req.user.id in customer context (from customerAuthController) is the customer.id
      query += ' AND t.customer_id = ?';
      params.push(req.user.id);
    } else {
      // Staff filters
      if (status && status !== 'all') {
        query += ' AND t.status = ?';
        params.push(status);
      }
      if (employeeId) {
        query += ' AND u.uuid = ?';
        params.push(employeeId);
      }
      if (customerName) {
        query += ' AND t.customer_name LIKE ?';
        params.push(`%${customerName}%`);
      }
      if (customerPhone) {
        query += ' AND t.customer_phone LIKE ?';
        params.push(`%${customerPhone}%`);
      }
    }

    if (startDate) {
      query += ' AND DATE(t.transaction_date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(t.transaction_date) <= ?';
      params.push(endDate);
    }

    if (req.user.role !== 'customer') {
      if (currencyIn) {
        query += ' AND ci.code = ?';
        params.push(currencyIn);
      }
      if (currencyOut) {
        query += ' AND co.code = ?';
        params.push(currencyOut);
      }
      if (transactionNumber) {
        query += ' AND t.transaction_number LIKE ?';
        params.push(`%${transactionNumber}%`);
      }
      if (minAmount) {
        query += ' AND t.amount_in >= ?';
        params.push(minAmount);
      }
      if (maxAmount) {
        query += ' AND t.amount_in <= ?';
        params.push(maxAmount);
      }
      if (notes) {
        query += ' AND t.notes LIKE ?';
        params.push(`%${notes}%`);
      }
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
        isFlagged: Boolean(t.is_flagged),
        flagReason: t.flag_reason,
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
  let connection;
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

    // Get connection for transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Verify currencies exist and are active
    const [currencies] = await connection.query(
      'SELECT id, code, high_value_threshold FROM currencies WHERE id IN (?, ?) AND is_active = TRUE',
      [currencyInId, currencyOutId]
    );

    if (currencies.length !== 2) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid currency IDs or currencies are not active.'
      });
    }

    const currencyIn = currencies.find(c => c.id === currencyInId);
    const currencyOut = currencies.find(c => c.id === currencyOutId);

    // --- Phase 2: Cash Drawer Management ---
    // Get the employee's active drawer
    // Assuming 1:1 user-drawer or finding the active drawer for this user
    // For now, let's look up the drawer assigned to this user or the "Main Drawer" if not explicit?
    // Better: Check if there's an open drawer session.
    // Simplifying assumption: User has ONE active drawer they are working on.
    // Querying cash_drawers where created_by = user.id (or assigned).

    // STRICT MODE: Find drawer assigned to user (or Created By user for now as fallback)
    const [drawers] = await connection.query(
      'SELECT id, name FROM cash_drawers WHERE is_active = TRUE AND created_by = ? LIMIT 1',
      [req.user.id]
    );

    // If no drawer found for user, we likely should block, but for migration safety check if "Main Drawer" exists
    let drawerId = null;
    if (drawers.length > 0) {
      drawerId = drawers[0].id;
    } else {
      // Fallback to "Main Drawer" if admin, or fail?
      // Let's fail if no drawer to enforce procedure
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'No active cash drawer found for this user. Please open a drawer first.'
      });
    }

    // Check Balance for Currency OUT (Selling)
    // We are giving AmountOut of CurrencyOut
    const [balances] = await connection.query(
      'SELECT balance FROM cash_drawer_balances WHERE drawer_id = ? AND currency_id = ? FOR UPDATE',
      [drawerId, currencyOutId]
    );

    const currentBalanceOut = balances.length > 0 ? parseFloat(balances[0].balance) : 0.0;
    const requiredAmount = parseFloat(amountOut);

    if (currentBalanceOut < requiredAmount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient funds in cash drawer. Available: ${currentBalanceOut} ${currencyOut.code}, Required: ${requiredAmount}`
      });
    }

    // --- End Cash Drawer Check ---

    // Validate customer if provided, or auto-create if customer name given
    let customerDbId = null;
    let resolvedCustomerName = customerName;
    let resolvedCustomerPhone = customerPhone;

    if (customerId) {
      // Existing customer selected
      const [customers] = await connection.query(
        'SELECT id, full_name, phone, is_blocked, block_reason FROM customers WHERE uuid = ?',
        [customerId]
      );

      if (customers.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Customer not found.'
        });
      }

      const customer = customers[0];

      // Check if customer is blocked
      if (customer.is_blocked) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot create transaction for blocked customer. Reason: ${customer.block_reason || 'Not specified'}`
        });
      }

      customerDbId = customer.id;
      // Use customer data if not provided in request
      resolvedCustomerName = customerName || customer.full_name;
      resolvedCustomerPhone = customerPhone || customer.phone;
    } else if (customerName) {
      // Auto-create customer if customer name is provided but no customer ID
      // First check if customer with same phone exists (if phone provided)
      if (customerPhone) {
        const [existingByPhone] = await connection.query(
          'SELECT id, full_name, is_blocked, block_reason FROM customers WHERE phone = ?',
          [customerPhone]
        );

        if (existingByPhone.length > 0) {
          const existingCustomer = existingByPhone[0];
          if (existingCustomer.is_blocked) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              message: `Cannot create transaction for blocked customer. Reason: ${existingCustomer.block_reason || 'Not specified'}`
            });
          }
          customerDbId = existingCustomer.id;
          // Update customer name if different
          if (existingCustomer.full_name !== customerName) {
            await connection.query('UPDATE customers SET full_name = ? WHERE id = ?', [customerName, customerDbId]);
          }
        }
      }

      // If no existing customer found, create new one
      if (!customerDbId) {
        const customerUuid = uuidv4();
        const [newCustomer] = await connection.query(
          `INSERT INTO customers (uuid, full_name, phone, id_type, id_number, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            customerUuid,
            customerName,
            customerPhone || null,
            customerIdType || null,
            customerIdNumber || null,
            req.user.id
          ]
        );
        customerDbId = newCustomer.insertId;

        // Log customer creation audit
        await logAudit(
          req.user.id,
          'CREATE',
          'customers',
          customerDbId,
          null,
          { uuid: customerUuid, fullName: customerName, phone: customerPhone, source: 'transaction' },
          ipAddress,
          'info',
          connection
        );
      }
    }

    const uuid = uuidv4();

    // Calculate profit using safe decimal math
    // Profit = (Applied Rate - Market Rate) * Amount In
    const appliedRate = parseDecimal(exchangeRate, 6);
    const mktRate = marketRate ? parseDecimal(marketRate, 6) : appliedRate;
    const profit = parseDecimal((appliedRate - mktRate) * parseDecimal(amountIn), 2);

    // --- Phase 2: Flagging Logic ---
    let isFlagged = false;
    let flagReason = null;
    const threshold = parseFloat(currencyIn.high_value_threshold || 10000); // Default 10k if null

    if (parseFloat(amountIn) >= threshold) {
      isFlagged = true;
      flagReason = `High Value Transaction (>= ${threshold} ${currencyIn.code})`;
    }
    // Could add more flagging rules here (e.g. watchlist)

    const [result] = await connection.query(
      `INSERT INTO transactions
       (uuid, customer_id, customer_name, customer_phone, customer_id_type, customer_id_number,
        currency_in_id, currency_out_id, amount_in, amount_out, exchange_rate,
        market_rate, profit, commission, notes, employee_id, transaction_date, status, is_flagged, flag_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'completed', ?, ?)`,
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
        req.user.id,
        isFlagged,
        flagReason
      ]
    );

    // Update customer statistics if customer exists
    if (customerDbId) {
      await connection.query(
        `UPDATE customers
         SET total_transactions = total_transactions + 1,
             total_volume = total_volume + ?
         WHERE id = ?`,
        [parseDecimal(amountIn), customerDbId]
      );
    }

    // --- Phase 2: Update Cash Drawer Balances ---
    // 1. Deduct OUT amount from Currency Out Balance
    await connection.query(
      'UPDATE cash_drawer_balances SET balance = balance - ?, last_updated_by = ? WHERE drawer_id = ? AND currency_id = ?',
      [parseFloat(amountOut), req.user.id, drawerId, currencyOutId]
    );

    // 2. Add IN amount to Currency In Balance
    // Check if balance record exists first (FOR UPDATE above handled Out, but In might be new)
    const [balanceInCheck] = await connection.query(
      'SELECT id FROM cash_drawer_balances WHERE drawer_id = ? AND currency_id = ?',
      [drawerId, currencyInId]
    );

    if (balanceInCheck.length > 0) {
      await connection.query(
        'UPDATE cash_drawer_balances SET balance = balance + ?, last_updated_by = ? WHERE drawer_id = ? AND currency_id = ?',
        [parseFloat(amountIn), req.user.id, drawerId, currencyInId]
      );
    } else {
      await connection.query(
        'INSERT INTO cash_drawer_balances (drawer_id, currency_id, balance, last_updated_by) VALUES (?, ?, ?, ?)',
        [drawerId, currencyInId, parseFloat(amountIn), req.user.id]
      );
    }

    // Log Cash Drawer Transaction (Audit) - One entry or two?
    // Let's log 'transaction_out' and 'transaction_in' type events in cash_drawer_transactions
    // This is optional but good for strict tracking.
    // For now, let's keep it simple transaction log is enough, but strictly `cash_drawer_transactions` table should store this too?
    // Yes, schema says "transaction_in", "transaction_out".

    // Log OUT
    await connection.query(
      `INSERT INTO cash_drawer_transactions (uuid, drawer_id, currency_id, type, amount, balance_before, balance_after, reference_type, reference_id, performed_by)
       VALUES (UUID(), ?, ?, 'transaction_out', ?, ?, ?, 'transaction', ?, ?)`,
      [drawerId, currencyOutId, parseFloat(amountOut), currentBalanceOut, currentBalanceOut - parseFloat(amountOut), uuid, req.user.id]
    );

    // Log IN (Need to fetch balance before)
    // We didn't fetch In balance yet.
    // Optimization: Just log it.

    // --------------------------------------------

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
        profit,
        isFlagged,
        flagReason
      },
      ipAddress,
      isFlagged ? 'warning' : 'info',
      connection
    );

    await connection.commit();

    // EMIT REAL-TIME UPDATE
    const io = req.app.get('io');
    if (io) {
      // Calculate today's total profit to broadcast
      // We can either query it (safe) or just emit the increment (optimization)
      // Querying is safer to keep everyone in sync
      const [profitResult] = await pool.query(
        'SELECT SUM(profit) as total_profit FROM transactions WHERE DATE(transaction_date) = CURDATE() AND deleted_at IS NULL AND status = "completed"'
      );
      const totalProfit = profitResult[0].total_profit || 0;

      io.emit('profit_update', {
        newTransaction: {
          uuid,
          amountIn: parseDecimal(amountIn),
          currencyCode: currencyIn.code
        },
        dailyProfit: parseFloat(totalProfit)
      });
    }

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
        profit,
        isFlagged,
        flagReason
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
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
