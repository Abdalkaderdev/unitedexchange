/**
 * Cash Drawer Controller
 * Manages cash drawers, balances, deposits, withdrawals, and reconciliation
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');

/**
 * Get all cash drawers
 */
const getDrawers = async (req, res, next) => {
  try {
    const { active } = req.query;

    let query = `
      SELECT
        d.*,
        u.full_name as created_by_name
      FROM cash_drawers d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (active !== undefined) {
      query += ' AND d.is_active = ?';
      params.push(active === 'true');
    }

    query += ' ORDER BY d.name ASC';

    const [drawers] = await pool.query(query, params);

    // Get balances for each drawer
    const drawersWithBalances = await Promise.all(
      drawers.map(async (drawer) => {
        const [balances] = await pool.query(`
          SELECT
            b.balance,
            c.id as currency_id,
            c.code as currency_code,
            c.symbol as currency_symbol
          FROM cash_drawer_balances b
          JOIN currencies c ON b.currency_id = c.id
          WHERE b.drawer_id = ?
          ORDER BY c.code
        `, [drawer.id]);

        return {
          uuid: drawer.uuid,
          name: drawer.name,
          location: drawer.location,
          isActive: drawer.is_active,
          lowBalanceAlert: parseDecimal(drawer.low_balance_alert),
          balances: balances.map(b => ({
            currencyId: b.currency_id,
            currencyCode: b.currency_code,
            currencySymbol: b.currency_symbol,
            balance: parseDecimal(b.balance)
          })),
          createdBy: drawer.created_by_name,
          createdAt: drawer.created_at
        };
      })
    );

    res.json({
      success: true,
      data: drawersWithBalances
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single drawer with balances
 */
const getDrawer = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    const [drawers] = await pool.query(`
      SELECT d.*, u.full_name as created_by_name
      FROM cash_drawers d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.uuid = ?
    `, [uuid]);

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found.'
      });
    }

    const drawer = drawers[0];

    // Get balances
    const [balances] = await pool.query(`
      SELECT
        b.*,
        c.code as currency_code,
        c.symbol as currency_symbol,
        c.name as currency_name
      FROM cash_drawer_balances b
      JOIN currencies c ON b.currency_id = c.id
      WHERE b.drawer_id = ?
      ORDER BY c.code
    `, [drawer.id]);

    // Get recent transactions
    const [recentTransactions] = await pool.query(`
      SELECT
        t.*,
        c.code as currency_code,
        u.full_name as performed_by_name
      FROM cash_drawer_transactions t
      JOIN currencies c ON t.currency_id = c.id
      JOIN users u ON t.performed_by = u.id
      WHERE t.drawer_id = ?
      ORDER BY t.created_at DESC
      LIMIT 20
    `, [drawer.id]);

    res.json({
      success: true,
      data: {
        uuid: drawer.uuid,
        name: drawer.name,
        location: drawer.location,
        isActive: drawer.is_active,
        lowBalanceAlert: parseDecimal(drawer.low_balance_alert),
        balances: balances.map(b => ({
          currencyId: b.currency_id,
          currencyCode: b.currency_code,
          currencySymbol: b.currency_symbol,
          currencyName: b.currency_name,
          balance: parseDecimal(b.balance),
          lastUpdated: b.last_updated
        })),
        recentTransactions: recentTransactions.map(t => ({
          uuid: t.uuid,
          type: t.type,
          currencyCode: t.currency_code,
          amount: parseDecimal(t.amount),
          balanceBefore: parseDecimal(t.balance_before),
          balanceAfter: parseDecimal(t.balance_after),
          notes: t.notes,
          performedBy: t.performed_by_name,
          createdAt: t.created_at
        })),
        createdBy: drawer.created_by_name,
        createdAt: drawer.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new cash drawer
 */
const createDrawer = async (req, res, next) => {
  try {
    const { name, location, lowBalanceAlert } = req.body;
    const ipAddress = getClientIp(req);
    const uuid = uuidv4();

    const [result] = await pool.query(
      `INSERT INTO cash_drawers (uuid, name, location, low_balance_alert, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [uuid, name, location || null, lowBalanceAlert || 1000, req.user.id]
    );

    await logAudit(
      req.user.id,
      'CREATE',
      'cash_drawers',
      result.insertId,
      null,
      { uuid, name, location },
      ipAddress,
      'info'
    );

    res.status(201).json({
      success: true,
      message: 'Cash drawer created successfully.',
      data: { uuid, name, location }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update cash drawer
 */
const updateDrawer = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { name, location, isActive, lowBalanceAlert } = req.body;
    const ipAddress = getClientIp(req);

    const [drawers] = await pool.query(
      'SELECT * FROM cash_drawers WHERE uuid = ?',
      [uuid]
    );

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found.'
      });
    }

    const drawer = drawers[0];
    const updates = [];
    const params = [];
    const oldValues = {};
    const newValues = {};

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
      oldValues.name = drawer.name;
      newValues.name = name;
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
      oldValues.location = drawer.location;
      newValues.location = location;
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive);
      oldValues.isActive = drawer.is_active;
      newValues.isActive = isActive;
    }
    if (lowBalanceAlert !== undefined) {
      updates.push('low_balance_alert = ?');
      params.push(lowBalanceAlert);
      oldValues.lowBalanceAlert = drawer.low_balance_alert;
      newValues.lowBalanceAlert = lowBalanceAlert;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    params.push(uuid);
    await pool.query(
      `UPDATE cash_drawers SET ${updates.join(', ')} WHERE uuid = ?`,
      params
    );

    await logAudit(
      req.user.id,
      'UPDATE',
      'cash_drawers',
      drawer.id,
      oldValues,
      newValues,
      ipAddress,
      'info'
    );

    res.json({
      success: true,
      message: 'Cash drawer updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deposit cash into drawer
 */
const deposit = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { currencyId, amount, notes } = req.body;
    const ipAddress = getClientIp(req);

    const [drawers] = await pool.query(
      'SELECT * FROM cash_drawers WHERE uuid = ? AND is_active = TRUE',
      [uuid]
    );

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found or not active.'
      });
    }

    const drawer = drawers[0];
    const parsedAmount = parseDecimal(amount);

    // Get current balance
    const [balances] = await pool.query(
      'SELECT * FROM cash_drawer_balances WHERE drawer_id = ? AND currency_id = ?',
      [drawer.id, currencyId]
    );

    const currentBalance = balances.length > 0 ? parseDecimal(balances[0].balance) : 0;
    const newBalance = currentBalance + parsedAmount;

    // Update or insert balance
    if (balances.length > 0) {
      await pool.query(
        'UPDATE cash_drawer_balances SET balance = ?, last_updated_by = ? WHERE id = ?',
        [newBalance, req.user.id, balances[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cash_drawer_balances (drawer_id, currency_id, balance, last_updated_by) VALUES (?, ?, ?, ?)',
        [drawer.id, currencyId, newBalance, req.user.id]
      );
    }

    // Log transaction
    const transactionUuid = uuidv4();
    await pool.query(
      `INSERT INTO cash_drawer_transactions
       (uuid, drawer_id, currency_id, type, amount, balance_before, balance_after, notes, performed_by)
       VALUES (?, ?, ?, 'deposit', ?, ?, ?, ?, ?)`,
      [transactionUuid, drawer.id, currencyId, parsedAmount, currentBalance, newBalance, notes || null, req.user.id]
    );

    await logAudit(
      req.user.id,
      'CASH_DEPOSIT',
      'cash_drawer_transactions',
      transactionUuid,
      { balance: currentBalance },
      { balance: newBalance, amount: parsedAmount },
      ipAddress,
      'info'
    );

    res.json({
      success: true,
      message: 'Deposit successful.',
      data: {
        transactionUuid,
        amount: parsedAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Withdraw cash from drawer
 */
const withdraw = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { currencyId, amount, notes } = req.body;
    const ipAddress = getClientIp(req);

    const [drawers] = await pool.query(
      'SELECT * FROM cash_drawers WHERE uuid = ? AND is_active = TRUE',
      [uuid]
    );

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found or not active.'
      });
    }

    const drawer = drawers[0];
    const parsedAmount = parseDecimal(amount);

    // Get current balance
    const [balances] = await pool.query(
      'SELECT * FROM cash_drawer_balances WHERE drawer_id = ? AND currency_id = ?',
      [drawer.id, currencyId]
    );

    const currentBalance = balances.length > 0 ? parseDecimal(balances[0].balance) : 0;

    if (currentBalance < parsedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance in drawer.'
      });
    }

    const newBalance = currentBalance - parsedAmount;

    // Update balance
    await pool.query(
      'UPDATE cash_drawer_balances SET balance = ?, last_updated_by = ? WHERE drawer_id = ? AND currency_id = ?',
      [newBalance, req.user.id, drawer.id, currencyId]
    );

    // Log transaction
    const transactionUuid = uuidv4();
    await pool.query(
      `INSERT INTO cash_drawer_transactions
       (uuid, drawer_id, currency_id, type, amount, balance_before, balance_after, notes, performed_by)
       VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, ?, ?)`,
      [transactionUuid, drawer.id, currencyId, parsedAmount, currentBalance, newBalance, notes || null, req.user.id]
    );

    await logAudit(
      req.user.id,
      'CASH_WITHDRAWAL',
      'cash_drawer_transactions',
      transactionUuid,
      { balance: currentBalance },
      { balance: newBalance, amount: parsedAmount },
      ipAddress,
      'warning'
    );

    res.json({
      success: true,
      message: 'Withdrawal successful.',
      data: {
        transactionUuid,
        amount: parsedAmount,
        balanceBefore: currentBalance,
        balanceAfter: newBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Adjust drawer balance (for corrections)
 */
const adjust = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { currencyId, newBalance, reason } = req.body;
    const ipAddress = getClientIp(req);

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for adjustments.'
      });
    }

    const [drawers] = await pool.query(
      'SELECT * FROM cash_drawers WHERE uuid = ?',
      [uuid]
    );

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found.'
      });
    }

    const drawer = drawers[0];
    const parsedNewBalance = parseDecimal(newBalance);

    // Get current balance
    const [balances] = await pool.query(
      'SELECT * FROM cash_drawer_balances WHERE drawer_id = ? AND currency_id = ?',
      [drawer.id, currencyId]
    );

    const currentBalance = balances.length > 0 ? parseDecimal(balances[0].balance) : 0;
    const adjustmentAmount = parsedNewBalance - currentBalance;

    // Update or insert balance
    if (balances.length > 0) {
      await pool.query(
        'UPDATE cash_drawer_balances SET balance = ?, last_updated_by = ? WHERE id = ?',
        [parsedNewBalance, req.user.id, balances[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cash_drawer_balances (drawer_id, currency_id, balance, last_updated_by) VALUES (?, ?, ?, ?)',
        [drawer.id, currencyId, parsedNewBalance, req.user.id]
      );
    }

    // Log transaction
    const transactionUuid = uuidv4();
    await pool.query(
      `INSERT INTO cash_drawer_transactions
       (uuid, drawer_id, currency_id, type, amount, balance_before, balance_after, notes, performed_by)
       VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, ?)`,
      [transactionUuid, drawer.id, currencyId, adjustmentAmount, currentBalance, parsedNewBalance, reason, req.user.id]
    );

    await logAudit(
      req.user.id,
      'CASH_ADJUSTMENT',
      'cash_drawer_transactions',
      transactionUuid,
      { balance: currentBalance },
      { balance: parsedNewBalance, adjustment: adjustmentAmount, reason },
      ipAddress,
      'critical'
    );

    res.json({
      success: true,
      message: 'Balance adjusted successfully.',
      data: {
        transactionUuid,
        adjustment: adjustmentAmount,
        balanceBefore: currentBalance,
        balanceAfter: parsedNewBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get drawer transaction history
 */
const getDrawerHistory = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { page = 1, limit = 50, currencyId, type, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [drawers] = await pool.query(
      'SELECT id FROM cash_drawers WHERE uuid = ?',
      [uuid]
    );

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found.'
      });
    }

    const drawerId = drawers[0].id;

    let query = `
      SELECT
        t.*,
        c.code as currency_code,
        c.symbol as currency_symbol,
        u.full_name as performed_by_name
      FROM cash_drawer_transactions t
      JOIN currencies c ON t.currency_id = c.id
      JOIN users u ON t.performed_by = u.id
      WHERE t.drawer_id = ?
    `;
    const params = [drawerId];

    if (currencyId) {
      query += ' AND t.currency_id = ?';
      params.push(currencyId);
    }
    if (type) {
      query += ' AND t.type = ?';
      params.push(type);
    }
    if (startDate) {
      query += ' AND DATE(t.created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(t.created_at) <= ?';
      params.push(endDate);
    }

    // Count
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [transactions] = await pool.query(query, params);

    res.json({
      success: true,
      data: transactions.map(t => ({
        uuid: t.uuid,
        type: t.type,
        currencyCode: t.currency_code,
        currencySymbol: t.currency_symbol,
        amount: parseDecimal(t.amount),
        balanceBefore: parseDecimal(t.balance_before),
        balanceAfter: parseDecimal(t.balance_after),
        referenceType: t.reference_type,
        referenceId: t.reference_id,
        notes: t.notes,
        performedBy: t.performed_by_name,
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
 * Reconcile drawer balance
 */
const reconcile = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { currencyId, actualBalance, notes } = req.body;
    const ipAddress = getClientIp(req);

    const [drawers] = await pool.query(
      'SELECT * FROM cash_drawers WHERE uuid = ?',
      [uuid]
    );

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found.'
      });
    }

    const drawer = drawers[0];

    // Get expected balance
    const [balances] = await pool.query(
      'SELECT balance FROM cash_drawer_balances WHERE drawer_id = ? AND currency_id = ?',
      [drawer.id, currencyId]
    );

    const expectedBalance = balances.length > 0 ? parseDecimal(balances[0].balance) : 0;
    const parsedActualBalance = parseDecimal(actualBalance);
    const difference = parsedActualBalance - expectedBalance;

    let status = 'balanced';
    if (difference > 0) status = 'over';
    if (difference < 0) status = 'short';

    const reconciliationUuid = uuidv4();

    await pool.query(
      `INSERT INTO cash_drawer_reconciliations
       (uuid, drawer_id, currency_id, expected_balance, actual_balance, difference, status, notes, reconciled_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reconciliationUuid, drawer.id, currencyId, expectedBalance, parsedActualBalance, difference, status, notes || null, req.user.id]
    );

    // If there's a difference, create an adjustment
    if (difference !== 0) {
      // Update balance to actual
      await pool.query(
        'UPDATE cash_drawer_balances SET balance = ?, last_updated_by = ? WHERE drawer_id = ? AND currency_id = ?',
        [parsedActualBalance, req.user.id, drawer.id, currencyId]
      );

      // Log adjustment transaction
      const adjustmentUuid = uuidv4();
      await pool.query(
        `INSERT INTO cash_drawer_transactions
         (uuid, drawer_id, currency_id, type, amount, balance_before, balance_after, reference_type, reference_id, notes, performed_by)
         VALUES (?, ?, ?, 'adjustment', ?, ?, ?, 'reconciliation', ?, ?, ?)`,
        [adjustmentUuid, drawer.id, currencyId, difference, expectedBalance, parsedActualBalance, reconciliationUuid, `Reconciliation: ${status}`, req.user.id]
      );
    }

    await logAudit(
      req.user.id,
      'CASH_RECONCILIATION',
      'cash_drawer_reconciliations',
      reconciliationUuid,
      { expectedBalance },
      { actualBalance: parsedActualBalance, difference, status },
      ipAddress,
      status !== 'balanced' ? 'warning' : 'info'
    );

    res.json({
      success: true,
      message: 'Reconciliation completed.',
      data: {
        uuid: reconciliationUuid,
        expectedBalance,
        actualBalance: parsedActualBalance,
        difference,
        status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get low balance alerts
 */
const getLowBalanceAlerts = async (req, res, next) => {
  try {
    const [alerts] = await pool.query(`
      SELECT
        d.uuid as drawer_uuid,
        d.name as drawer_name,
        d.low_balance_alert as threshold,
        c.id as currency_id,
        c.code as currency_code,
        c.symbol as currency_symbol,
        b.balance
      FROM cash_drawer_balances b
      JOIN cash_drawers d ON b.drawer_id = d.id
      JOIN currencies c ON b.currency_id = c.id
      WHERE d.is_active = TRUE
        AND c.is_active = TRUE
        AND b.balance < d.low_balance_alert
      ORDER BY b.balance ASC
    `);

    res.json({
      success: true,
      data: alerts.map(a => ({
        drawerUuid: a.drawer_uuid,
        drawerName: a.drawer_name,
        currencyId: a.currency_id,
        currencyCode: a.currency_code,
        currencySymbol: a.currency_symbol,
        balance: parseDecimal(a.balance),
        threshold: parseDecimal(a.threshold)
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get drawer status
 */
const getDrawerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [drawers] = await pool.query(`
      SELECT
        d.*,
        u.full_name as assigned_to_name
      FROM cash_drawers d
      LEFT JOIN users u ON d.assigned_to = u.id
      WHERE (d.id = ? OR d.uuid = ?) AND d.is_active = TRUE
    `, [id, id]);

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found.'
      });
    }

    const drawer = drawers[0];

    // Get balances
    const [balances] = await pool.query(`
      SELECT
        c.id as currency_id,
        c.code as currency_code,
        c.symbol as currency_symbol,
        b.balance
      FROM cash_drawer_balances b
      JOIN currencies c ON b.currency_id = c.id
      WHERE b.drawer_id = ? AND c.is_active = TRUE
      ORDER BY c.code
    `, [drawer.id]);

    res.json({
      success: true,
      data: {
        uuid: drawer.uuid,
        name: drawer.name,
        assignedTo: drawer.assigned_to_name,
        isActive: drawer.is_active,
        lowBalanceAlert: parseDecimal(drawer.low_balance_alert),
        balances: balances.map(b => ({
          currencyId: b.currency_id,
          currencyCode: b.currency_code,
          currencySymbol: b.currency_symbol,
          balance: parseDecimal(b.balance)
        })),
        createdAt: drawer.created_at,
        updatedAt: drawer.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit end-of-day closing for a drawer
 */
const submitClosing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actualBalances, notes } = req.body;
    const userId = req.user.id;

    const [drawers] = await pool.query(
      'SELECT * FROM cash_drawers WHERE (id = ? OR uuid = ?) AND is_active = TRUE',
      [id, id]
    );

    if (drawers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cash drawer not found.'
      });
    }

    const drawer = drawers[0];
    const closingUuid = require('uuid').v4();

    // Insert closing record
    await pool.query(`
      INSERT INTO drawer_closings
      (uuid, drawer_id, closed_by, actual_balances, notes, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [closingUuid, drawer.id, userId, JSON.stringify(actualBalances || {}), notes || null]);

    res.json({
      success: true,
      message: 'Drawer closing submitted successfully.',
      data: { uuid: closingUuid }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDrawers,
  getDrawer,
  createDrawer,
  updateDrawer,
  deposit,
  withdraw,
  adjust,
  getDrawerHistory,
  reconcile,
  getLowBalanceAlerts,
  getDrawerStatus,
  submitClosing
};
