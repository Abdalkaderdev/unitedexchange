/**
 * Customer Controller
 * Production-ready customer management with comprehensive audit logging
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');

/**
 * Get customers with search and pagination
 */
const getCustomers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      isVip,
      isBlocked,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Validate sort parameters
    const allowedSortFields = ['full_name', 'created_at', 'total_transactions', 'total_volume'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = `
      SELECT
        c.id,
        c.uuid,
        c.full_name,
        c.phone,
        c.email,
        c.id_type,
        c.id_number,
        c.id_expiry,
        c.address,
        c.notes,
        c.is_vip,
        c.is_blocked,
        c.block_reason,
        c.total_transactions,
        c.total_volume,
        c.created_at,
        c.updated_at,
        u.full_name as created_by_name
      FROM customers c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    // Search filter
    if (search) {
      query += ` AND (
        c.full_name LIKE ? OR
        c.phone LIKE ? OR
        c.email LIKE ? OR
        c.id_number LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // VIP filter
    if (isVip !== undefined) {
      query += ' AND c.is_vip = ?';
      params.push(isVip === 'true');
    }

    // Blocked filter
    if (isBlocked !== undefined) {
      query += ' AND c.is_blocked = ?';
      params.push(isBlocked === 'true');
    }

    // Count query for pagination
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Add ordering and pagination
    query += ` ORDER BY c.${sortField} ${order} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [customers] = await pool.query(query, params);

    res.json({
      success: true,
      data: customers.map(c => ({
        uuid: c.uuid,
        fullName: c.full_name,
        phone: c.phone,
        email: c.email,
        idType: c.id_type,
        idNumber: c.id_number,
        idExpiry: c.id_expiry,
        address: c.address,
        notes: c.notes,
        isVip: Boolean(c.is_vip),
        isBlocked: Boolean(c.is_blocked),
        blockReason: c.block_reason,
        totalTransactions: c.total_transactions,
        totalVolume: parseDecimal(c.total_volume),
        createdBy: c.created_by_name,
        createdAt: c.created_at,
        updatedAt: c.updated_at
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
 * Get single customer by UUID
 */
const getCustomer = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    const [customers] = await pool.query(`
      SELECT
        c.*,
        u.full_name as created_by_name
      FROM customers c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.uuid = ?
    `, [uuid]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const c = customers[0];

    res.json({
      success: true,
      data: {
        uuid: c.uuid,
        fullName: c.full_name,
        phone: c.phone,
        email: c.email,
        idType: c.id_type,
        idNumber: c.id_number,
        idExpiry: c.id_expiry,
        address: c.address,
        notes: c.notes,
        isVip: Boolean(c.is_vip),
        isBlocked: Boolean(c.is_blocked),
        blockReason: c.block_reason,
        totalTransactions: c.total_transactions,
        totalVolume: parseDecimal(c.total_volume),
        createdBy: c.created_by_name,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new customer
 */
const createCustomer = async (req, res, next) => {
  try {
    const {
      fullName,
      phone,
      email,
      idType,
      idNumber,
      idExpiry,
      address,
      notes,
      isVip = false
    } = req.body;

    const ipAddress = getClientIp(req);
    const uuid = uuidv4();

    // Check for duplicate phone or email if provided
    if (phone || email) {
      const duplicateChecks = [];
      const duplicateParams = [];

      if (phone) {
        duplicateChecks.push('phone = ?');
        duplicateParams.push(phone);
      }
      if (email) {
        duplicateChecks.push('email = ?');
        duplicateParams.push(email);
      }

      const [existing] = await pool.query(
        `SELECT id, phone, email FROM customers WHERE ${duplicateChecks.join(' OR ')}`,
        duplicateParams
      );

      if (existing.length > 0) {
        const duplicateField = existing[0].phone === phone ? 'phone' : 'email';
        return res.status(400).json({
          success: false,
          message: `Customer with this ${duplicateField} already exists.`
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO customers
       (uuid, full_name, phone, email, id_type, id_number, id_expiry, address, notes, is_vip, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        fullName,
        phone || null,
        email || null,
        idType || null,
        idNumber || null,
        idExpiry || null,
        address || null,
        notes || null,
        isVip,
        req.user.id
      ]
    );

    // Log audit
    await logAudit(
      req.user.id,
      'CREATE',
      'customers',
      result.insertId,
      null,
      { uuid, fullName, phone, email, idType, idNumber, isVip },
      ipAddress,
      'info'
    );

    res.status(201).json({
      success: true,
      message: 'Customer created successfully.',
      data: {
        uuid,
        fullName,
        phone,
        email,
        idType,
        idNumber,
        idExpiry,
        address,
        notes,
        isVip
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update customer
 */
const updateCustomer = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const {
      fullName,
      phone,
      email,
      idType,
      idNumber,
      idExpiry,
      address,
      notes,
      isVip
    } = req.body;

    const ipAddress = getClientIp(req);

    // Get existing customer
    const [customers] = await pool.query('SELECT * FROM customers WHERE uuid = ?', [uuid]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const oldCustomer = customers[0];

    // Check for duplicate phone or email if changed
    if ((phone && phone !== oldCustomer.phone) || (email && email !== oldCustomer.email)) {
      const duplicateChecks = [];
      const duplicateParams = [];

      if (phone && phone !== oldCustomer.phone) {
        duplicateChecks.push('phone = ?');
        duplicateParams.push(phone);
      }
      if (email && email !== oldCustomer.email) {
        duplicateChecks.push('email = ?');
        duplicateParams.push(email);
      }

      if (duplicateChecks.length > 0) {
        duplicateParams.push(uuid);
        const [existing] = await pool.query(
          `SELECT id, phone, email FROM customers WHERE (${duplicateChecks.join(' OR ')}) AND uuid != ?`,
          duplicateParams
        );

        if (existing.length > 0) {
          const duplicateField = existing[0].phone === phone ? 'phone' : 'email';
          return res.status(400).json({
            success: false,
            message: `Another customer with this ${duplicateField} already exists.`
          });
        }
      }
    }

    // Build update query
    const updates = [];
    const params = [];

    if (fullName !== undefined) {
      updates.push('full_name = ?');
      params.push(fullName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone || null);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email || null);
    }
    if (idType !== undefined) {
      updates.push('id_type = ?');
      params.push(idType || null);
    }
    if (idNumber !== undefined) {
      updates.push('id_number = ?');
      params.push(idNumber || null);
    }
    if (idExpiry !== undefined) {
      updates.push('id_expiry = ?');
      params.push(idExpiry || null);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address || null);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes || null);
    }
    if (isVip !== undefined) {
      updates.push('is_vip = ?');
      params.push(isVip);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    params.push(uuid);

    await pool.query(`UPDATE customers SET ${updates.join(', ')} WHERE uuid = ?`, params);

    // Log audit
    await logAudit(
      req.user.id,
      'UPDATE',
      'customers',
      oldCustomer.id,
      {
        fullName: oldCustomer.full_name,
        phone: oldCustomer.phone,
        email: oldCustomer.email,
        idType: oldCustomer.id_type,
        idNumber: oldCustomer.id_number,
        isVip: oldCustomer.is_vip
      },
      { fullName, phone, email, idType, idNumber, isVip },
      ipAddress,
      'info'
    );

    res.json({
      success: true,
      message: 'Customer updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Block customer
 */
const blockCustomer = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { reason } = req.body;
    const ipAddress = getClientIp(req);

    // Get existing customer
    const [customers] = await pool.query('SELECT * FROM customers WHERE uuid = ?', [uuid]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const customer = customers[0];

    if (customer.is_blocked) {
      return res.status(400).json({
        success: false,
        message: 'Customer is already blocked.'
      });
    }

    await pool.query(
      'UPDATE customers SET is_blocked = TRUE, block_reason = ? WHERE uuid = ?',
      [reason || null, uuid]
    );

    // Log audit with warning severity
    await logAudit(
      req.user.id,
      'BLOCK',
      'customers',
      customer.id,
      { isBlocked: false },
      { isBlocked: true, blockReason: reason },
      ipAddress,
      'warning'
    );

    res.json({
      success: true,
      message: 'Customer blocked successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unblock customer
 */
const unblockCustomer = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const ipAddress = getClientIp(req);

    // Get existing customer
    const [customers] = await pool.query('SELECT * FROM customers WHERE uuid = ?', [uuid]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const customer = customers[0];

    if (!customer.is_blocked) {
      return res.status(400).json({
        success: false,
        message: 'Customer is not blocked.'
      });
    }

    await pool.query(
      'UPDATE customers SET is_blocked = FALSE, block_reason = NULL WHERE uuid = ?',
      [uuid]
    );

    // Log audit
    await logAudit(
      req.user.id,
      'UNBLOCK',
      'customers',
      customer.id,
      { isBlocked: true, blockReason: customer.block_reason },
      { isBlocked: false, blockReason: null },
      ipAddress,
      'info'
    );

    res.json({
      success: true,
      message: 'Customer unblocked successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get customer transactions
 */
const getCustomerTransactions = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      status
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get customer
    const [customers] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [uuid]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const customerId = customers[0].id;

    let query = `
      SELECT
        t.uuid,
        t.transaction_number,
        t.customer_name,
        t.amount_in,
        t.amount_out,
        t.exchange_rate,
        t.profit,
        t.commission,
        t.notes,
        t.status,
        t.transaction_date,
        t.created_at,
        ci.code as currency_in_code,
        ci.symbol as currency_in_symbol,
        co.code as currency_out_code,
        co.symbol as currency_out_symbol,
        u.full_name as employee_name
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      WHERE t.customer_id = ? AND t.deleted_at IS NULL
    `;

    const params = [customerId];

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
        customerName: t.customer_name,
        currencyIn: {
          code: t.currency_in_code,
          symbol: t.currency_in_symbol
        },
        currencyOut: {
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
        employeeName: t.employee_name,
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
 * Get customer statistics
 */
const getCustomerStats = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    // Get customer
    const [customers] = await pool.query('SELECT * FROM customers WHERE uuid = ?', [uuid]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const customer = customers[0];

    // Get detailed statistics
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_transactions,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_transactions,
        SUM(CASE WHEN status = 'completed' THEN amount_in ELSE 0 END) as total_volume_in,
        SUM(CASE WHEN status = 'completed' THEN amount_out ELSE 0 END) as total_volume_out,
        SUM(CASE WHEN status = 'completed' THEN profit ELSE 0 END) as total_profit,
        MIN(transaction_date) as first_transaction_date,
        MAX(transaction_date) as last_transaction_date
      FROM transactions
      WHERE customer_id = ? AND deleted_at IS NULL
    `, [customer.id]);

    // Get currency breakdown
    const [currencyBreakdown] = await pool.query(`
      SELECT
        ci.code as currency_in,
        co.code as currency_out,
        COUNT(*) as transaction_count,
        SUM(amount_in) as total_in,
        SUM(amount_out) as total_out
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      WHERE t.customer_id = ? AND t.deleted_at IS NULL AND t.status = 'completed'
      GROUP BY ci.code, co.code
      ORDER BY transaction_count DESC
    `, [customer.id]);

    // Get monthly activity (last 12 months)
    const [monthlyActivity] = await pool.query(`
      SELECT
        DATE_FORMAT(transaction_date, '%Y-%m') as month,
        COUNT(*) as transaction_count,
        SUM(amount_in) as total_volume
      FROM transactions
      WHERE customer_id = ?
        AND deleted_at IS NULL
        AND status = 'completed'
        AND transaction_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
      ORDER BY month DESC
    `, [customer.id]);

    const s = stats[0];

    res.json({
      success: true,
      data: {
        customer: {
          uuid: customer.uuid,
          fullName: customer.full_name,
          isVip: Boolean(customer.is_vip),
          isBlocked: Boolean(customer.is_blocked),
          memberSince: customer.created_at
        },
        overview: {
          totalTransactions: s.total_transactions || 0,
          completedTransactions: s.completed_transactions || 0,
          cancelledTransactions: s.cancelled_transactions || 0,
          totalVolumeIn: parseDecimal(s.total_volume_in) || 0,
          totalVolumeOut: parseDecimal(s.total_volume_out) || 0,
          totalProfit: parseDecimal(s.total_profit) || 0,
          firstTransactionDate: s.first_transaction_date,
          lastTransactionDate: s.last_transaction_date
        },
        currencyBreakdown: currencyBreakdown.map(cb => ({
          currencyPair: `${cb.currency_in}/${cb.currency_out}`,
          transactionCount: cb.transaction_count,
          totalIn: parseDecimal(cb.total_in),
          totalOut: parseDecimal(cb.total_out)
        })),
        monthlyActivity: monthlyActivity.map(ma => ({
          month: ma.month,
          transactionCount: ma.transaction_count,
          totalVolume: parseDecimal(ma.total_volume)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update customers (block/unblock/VIP status)
 */
const bulkUpdateCustomers = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { uuids, action, reason } = req.body;
    const ipAddress = getClientIp(req);

    if (!Array.isArray(uuids) || uuids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer UUIDs array is required.'
      });
    }

    if (uuids.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 customers can be updated at once.'
      });
    }

    const validActions = ['block', 'unblock', 'setVip', 'removeVip'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action. Valid actions: ${validActions.join(', ')}`
      });
    }

    await connection.beginTransaction();

    // Get customers
    const placeholders = uuids.map(() => '?').join(',');
    const [customers] = await connection.query(
      `SELECT id, uuid, full_name, is_blocked, is_vip FROM customers WHERE uuid IN (${placeholders})`,
      uuids
    );

    if (customers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'No customers found with the provided UUIDs.'
      });
    }

    const results = [];
    const errors = [];

    for (const customer of customers) {
      try {
        let updateQuery = '';
        let updateParams = [];
        let oldValues = {};
        let newValues = {};

        switch (action) {
          case 'block':
            if (customer.is_blocked) {
              errors.push({ uuid: customer.uuid, error: 'Already blocked' });
              continue;
            }
            updateQuery = 'UPDATE customers SET is_blocked = TRUE, block_reason = ? WHERE id = ?';
            updateParams = [reason || null, customer.id];
            oldValues = { isBlocked: false };
            newValues = { isBlocked: true, blockReason: reason };
            break;

          case 'unblock':
            if (!customer.is_blocked) {
              errors.push({ uuid: customer.uuid, error: 'Not blocked' });
              continue;
            }
            updateQuery = 'UPDATE customers SET is_blocked = FALSE, block_reason = NULL WHERE id = ?';
            updateParams = [customer.id];
            oldValues = { isBlocked: true };
            newValues = { isBlocked: false };
            break;

          case 'setVip':
            if (customer.is_vip) {
              errors.push({ uuid: customer.uuid, error: 'Already VIP' });
              continue;
            }
            updateQuery = 'UPDATE customers SET is_vip = TRUE WHERE id = ?';
            updateParams = [customer.id];
            oldValues = { isVip: false };
            newValues = { isVip: true };
            break;

          case 'removeVip':
            if (!customer.is_vip) {
              errors.push({ uuid: customer.uuid, error: 'Not VIP' });
              continue;
            }
            updateQuery = 'UPDATE customers SET is_vip = FALSE WHERE id = ?';
            updateParams = [customer.id];
            oldValues = { isVip: true };
            newValues = { isVip: false };
            break;
        }

        await connection.query(updateQuery, updateParams);

        results.push({
          uuid: customer.uuid,
          fullName: customer.full_name,
          action
        });
      } catch (err) {
        errors.push({ uuid: customer.uuid, error: err.message });
      }
    }

    await connection.commit();

    // Log bulk audit
    await logAudit(
      req.user.id,
      'BULK_UPDATE',
      'customers',
      null,
      null,
      { action, count: results.length, customers: results.map(r => r.uuid) },
      ipAddress,
      action === 'block' ? 'warning' : 'info'
    );

    res.json({
      success: true,
      message: `${results.length} customer(s) updated successfully.`,
      data: {
        updated: results,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Delete customer (soft delete or check for transactions)
 */
const deleteCustomer = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const ipAddress = getClientIp(req);

    // Get customer
    const [customers] = await pool.query('SELECT * FROM customers WHERE uuid = ?', [uuid]);

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const customer = customers[0];

    // Check for associated transactions
    const [transactions] = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE customer_id = ? AND deleted_at IS NULL',
      [customer.id]
    );

    if (transactions[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer with ${transactions[0].count} associated transaction(s). Consider blocking the customer instead.`
      });
    }

    // Delete customer (no transactions associated)
    await pool.query('DELETE FROM customers WHERE uuid = ?', [uuid]);

    // Log audit with critical severity
    await logAudit(
      req.user.id,
      'DELETE',
      'customers',
      customer.id,
      {
        fullName: customer.full_name,
        phone: customer.phone,
        email: customer.email
      },
      null,
      ipAddress,
      'critical'
    );

    res.json({
      success: true,
      message: 'Customer deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  blockCustomer,
  unblockCustomer,
  bulkUpdateCustomers,
  getCustomerTransactions,
  getCustomerStats,
  deleteCustomer
};
