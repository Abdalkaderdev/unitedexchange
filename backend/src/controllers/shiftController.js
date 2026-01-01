/**
 * Shift Controller
 * Manages employee shifts with opening/closing balances and transaction tracking
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');

/**
 * Start a new shift
 */
const startShift = async (req, res, next) => {
  try {
    const { drawerId, openingBalances, notes } = req.body;
    const ipAddress = getClientIp(req);
    const employeeId = req.user.id;

    // Check if employee already has an active shift
    const [activeShifts] = await pool.query(
      'SELECT uuid FROM shifts WHERE employee_id = ? AND status = "active"',
      [employeeId]
    );

    if (activeShifts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active shift.',
        data: { activeShiftUuid: activeShifts[0].uuid }
      });
    }

    // Verify drawer exists if provided
    let drawerDbId = null;
    if (drawerId) {
      const [drawers] = await pool.query(
        'SELECT id FROM cash_drawers WHERE uuid = ? AND is_active = TRUE',
        [drawerId]
      );
      if (drawers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cash drawer not found or not active.'
        });
      }
      drawerDbId = drawers[0].id;
    }

    const uuid = uuidv4();

    // Create shift
    const [result] = await pool.query(
      `INSERT INTO shifts (uuid, employee_id, drawer_id, opening_notes)
       VALUES (?, ?, ?, ?)`,
      [uuid, employeeId, drawerDbId, notes || null]
    );

    const shiftId = result.insertId;

    // Create shift summary
    await pool.query(
      'INSERT INTO shift_summaries (shift_id) VALUES (?)',
      [shiftId]
    );

    // Record opening balances
    if (openingBalances && Array.isArray(openingBalances)) {
      for (const balance of openingBalances) {
        await pool.query(
          `INSERT INTO shift_balances (shift_id, currency_id, opening_balance)
           VALUES (?, ?, ?)`,
          [shiftId, balance.currencyId, parseDecimal(balance.amount)]
        );
      }
    }

    await logAudit(
      employeeId,
      'SHIFT_START',
      'shifts',
      shiftId,
      null,
      { uuid, drawerId, openingBalances },
      ipAddress,
      'info'
    );

    res.status(201).json({
      success: true,
      message: 'Shift started successfully.',
      data: {
        uuid,
        startTime: new Date().toISOString(),
        drawerId
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate expected balances for a shift
 * Opening balance + currency_in amounts - currency_out amounts + deposits - withdrawals
 */
const calculateExpectedBalances = async (shiftId, drawerId) => {
  const expectedBalances = {};

  // Get opening balances
  const [openingBalances] = await pool.query(
    'SELECT currency_id, opening_balance FROM shift_balances WHERE shift_id = ?',
    [shiftId]
  );

  for (const row of openingBalances) {
    expectedBalances[row.currency_id] = parseDecimal(row.opening_balance);
  }

  // Get transaction flows (currency_in adds, currency_out subtracts from drawer)
  const [transactionFlows] = await pool.query(`
    SELECT
      currency_in_id,
      currency_out_id,
      SUM(amount_in) as total_in,
      SUM(amount_out) as total_out
    FROM transactions
    WHERE shift_id = ? AND status = 'completed' AND deleted_at IS NULL
    GROUP BY currency_in_id, currency_out_id
  `, [shiftId]);

  for (const flow of transactionFlows) {
    // Currency coming IN (customer gives us) - adds to our drawer
    if (!expectedBalances[flow.currency_in_id]) {
      expectedBalances[flow.currency_in_id] = 0;
    }
    expectedBalances[flow.currency_in_id] += parseDecimal(flow.total_in);

    // Currency going OUT (we give customer) - subtracts from our drawer
    if (!expectedBalances[flow.currency_out_id]) {
      expectedBalances[flow.currency_out_id] = 0;
    }
    expectedBalances[flow.currency_out_id] -= parseDecimal(flow.total_out);
  }

  // Get drawer deposits/withdrawals if drawer is assigned
  if (drawerId) {
    const [drawerTransactions] = await pool.query(`
      SELECT
        currency_id,
        type,
        SUM(amount) as total
      FROM cash_drawer_transactions
      WHERE drawer_id = ? AND type IN ('deposit', 'withdrawal', 'adjustment')
        AND created_at >= (SELECT start_time FROM shifts WHERE id = ?)
      GROUP BY currency_id, type
    `, [drawerId, shiftId]);

    for (const tx of drawerTransactions) {
      if (!expectedBalances[tx.currency_id]) {
        expectedBalances[tx.currency_id] = 0;
      }
      if (tx.type === 'deposit') {
        expectedBalances[tx.currency_id] += parseDecimal(tx.total);
      } else if (tx.type === 'withdrawal') {
        expectedBalances[tx.currency_id] -= parseDecimal(tx.total);
      } else if (tx.type === 'adjustment') {
        // Adjustments can be positive or negative
        expectedBalances[tx.currency_id] += parseDecimal(tx.total);
      }
    }
  }

  return expectedBalances;
};

/**
 * Get expected balances for current shift
 */
const getExpectedBalances = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    const [shifts] = await pool.query(
      'SELECT * FROM shifts WHERE uuid = ? AND status = "active"',
      [uuid]
    );

    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active shift not found.'
      });
    }

    const shift = shifts[0];
    const expectedBalances = await calculateExpectedBalances(shift.id, shift.drawer_id);

    // Get currency details
    const currencyIds = Object.keys(expectedBalances);
    if (currencyIds.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const [currencies] = await pool.query(
      'SELECT id, code, symbol, name FROM currencies WHERE id IN (?)',
      [currencyIds]
    );

    const currencyMap = {};
    for (const c of currencies) {
      currencyMap[c.id] = c;
    }

    const result = currencyIds.map(currencyId => ({
      currencyId: parseInt(currencyId),
      currencyCode: currencyMap[currencyId]?.code,
      currencySymbol: currencyMap[currencyId]?.symbol,
      currencyName: currencyMap[currencyId]?.name,
      expectedBalance: expectedBalances[currencyId]
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End a shift with reconciliation
 */
const endShift = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { closingBalances, notes } = req.body;
    const ipAddress = getClientIp(req);

    const [shifts] = await pool.query(
      `SELECT s.*, u.full_name as employee_name
       FROM shifts s
       JOIN users u ON s.employee_id = u.id
       WHERE s.uuid = ? AND s.status = 'active'`,
      [uuid]
    );

    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active shift not found.'
      });
    }

    const shift = shifts[0];

    // Only the shift owner or admin can end the shift
    if (shift.employee_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only end your own shift.'
      });
    }

    // Calculate expected balances
    const expectedBalances = await calculateExpectedBalances(shift.id, shift.drawer_id);

    // Process closing balances and create reconciliation records
    const reconciliationResults = [];

    if (closingBalances && Array.isArray(closingBalances)) {
      for (const balance of closingBalances) {
        const currencyId = balance.currencyId;
        const actualBalance = parseDecimal(balance.amount);
        const expectedBalance = expectedBalances[currencyId] || 0;
        const difference = actualBalance - expectedBalance;

        // Determine status
        let status = 'balanced';
        if (difference > 0.01) status = 'over';
        else if (difference < -0.01) status = 'short';

        // Update or insert shift balance
        const [existingBalance] = await pool.query(
          'SELECT id FROM shift_balances WHERE shift_id = ? AND currency_id = ?',
          [shift.id, currencyId]
        );

        if (existingBalance.length > 0) {
          await pool.query(
            `UPDATE shift_balances
             SET closing_balance = ?, expected_closing = ?, difference = ?
             WHERE shift_id = ? AND currency_id = ?`,
            [actualBalance, expectedBalance, difference, shift.id, currencyId]
          );
        } else {
          await pool.query(
            `INSERT INTO shift_balances (shift_id, currency_id, opening_balance, closing_balance, expected_closing, difference)
             VALUES (?, ?, 0, ?, ?, ?)`,
            [shift.id, currencyId, actualBalance, expectedBalance, difference]
          );
        }

        // Create reconciliation record if drawer is assigned
        if (shift.drawer_id) {
          const reconciliationUuid = uuidv4();
          await pool.query(
            `INSERT INTO cash_drawer_reconciliations
             (uuid, drawer_id, currency_id, expected_balance, actual_balance, difference, status, notes, reconciled_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              reconciliationUuid,
              shift.drawer_id,
              currencyId,
              expectedBalance,
              actualBalance,
              difference,
              status,
              `Shift end reconciliation - Shift: ${uuid}`,
              req.user.id
            ]
          );
        }

        reconciliationResults.push({
          currencyId,
          expected: expectedBalance,
          actual: actualBalance,
          difference,
          status
        });
      }
    }

    // Update shift summary
    const [summaryStats] = await pool.query(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(commission), 0) as total_commission,
        COALESCE(SUM(amount_in), 0) as total_volume_in,
        COALESCE(SUM(amount_out), 0) as total_volume_out
      FROM transactions
      WHERE shift_id = ? AND status = 'completed' AND deleted_at IS NULL
    `, [shift.id]);

    const [cancelledCount] = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE shift_id = ? AND status = "cancelled"',
      [shift.id]
    );

    await pool.query(`
      UPDATE shift_summaries SET
        total_transactions = ?,
        total_profit = ?,
        total_commission = ?,
        cancelled_transactions = ?,
        total_volume_in = ?,
        total_volume_out = ?
      WHERE shift_id = ?
    `, [
      summaryStats[0].total_transactions,
      summaryStats[0].total_profit,
      summaryStats[0].total_commission,
      cancelledCount[0].count,
      summaryStats[0].total_volume_in,
      summaryStats[0].total_volume_out,
      shift.id
    ]);

    // End the shift
    await pool.query(
      `UPDATE shifts SET status = 'completed', end_time = NOW(), closing_notes = ? WHERE id = ?`,
      [notes || null, shift.id]
    );

    // Check for significant variances
    const hasVariance = reconciliationResults.some(r => Math.abs(r.difference) > 0.01);

    await logAudit(
      req.user.id,
      'SHIFT_END',
      'shifts',
      shift.id,
      { status: 'active' },
      { status: 'completed', closingBalances, reconciliation: reconciliationResults, hasVariance },
      ipAddress,
      hasVariance ? 'warning' : 'info'
    );

    res.json({
      success: true,
      message: 'Shift ended successfully.',
      data: {
        uuid,
        endTime: new Date().toISOString(),
        summary: {
          totalTransactions: summaryStats[0].total_transactions,
          totalProfit: parseDecimal(summaryStats[0].total_profit),
          totalCommission: parseDecimal(summaryStats[0].total_commission),
          cancelledTransactions: cancelledCount[0].count
        },
        reconciliation: reconciliationResults,
        hasVariance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active shift for current user
 */
const getActiveShift = async (req, res, next) => {
  try {
    const employeeId = req.query.employeeId ? null : req.user.id;

    let query = `
      SELECT
        s.*,
        d.uuid as drawer_uuid,
        d.name as drawer_name,
        u.full_name as employee_name
      FROM shifts s
      LEFT JOIN cash_drawers d ON s.drawer_id = d.id
      JOIN users u ON s.employee_id = u.id
      WHERE s.status = 'active'
    `;
    const params = [];

    if (employeeId) {
      query += ' AND s.employee_id = ?';
      params.push(employeeId);
    }

    const [shifts] = await pool.query(query, params);

    if (shifts.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No active shift found.'
      });
    }

    const shift = shifts[0];

    // Get balances
    const [balances] = await pool.query(`
      SELECT
        sb.*,
        c.code as currency_code,
        c.symbol as currency_symbol
      FROM shift_balances sb
      JOIN currencies c ON sb.currency_id = c.id
      WHERE sb.shift_id = ?
    `, [shift.id]);

    // Get current transaction stats
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(profit), 0) as total_profit
      FROM transactions
      WHERE shift_id = ? AND status = 'completed' AND deleted_at IS NULL
    `, [shift.id]);

    res.json({
      success: true,
      data: {
        uuid: shift.uuid,
        employeeName: shift.employee_name,
        drawer: shift.drawer_uuid ? {
          uuid: shift.drawer_uuid,
          name: shift.drawer_name
        } : null,
        startTime: shift.start_time,
        openingNotes: shift.opening_notes,
        balances: balances.map(b => ({
          currencyCode: b.currency_code,
          currencySymbol: b.currency_symbol,
          openingBalance: parseDecimal(b.opening_balance)
        })),
        currentStats: {
          transactionCount: stats[0].transaction_count,
          totalProfit: parseDecimal(stats[0].total_profit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get shifts list with filters
 */
const getShifts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, employeeId, status, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT
        s.*,
        d.uuid as drawer_uuid,
        d.name as drawer_name,
        u.uuid as employee_uuid,
        u.full_name as employee_name,
        ss.total_transactions,
        ss.total_profit,
        ss.cancelled_transactions
      FROM shifts s
      LEFT JOIN cash_drawers d ON s.drawer_id = d.id
      JOIN users u ON s.employee_id = u.id
      LEFT JOIN shift_summaries ss ON s.id = ss.shift_id
      WHERE 1=1
    `;
    const params = [];

    if (employeeId) {
      query += ' AND u.uuid = ?';
      params.push(employeeId);
    }
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (startDate) {
      query += ' AND DATE(s.start_time) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(s.start_time) <= ?';
      params.push(endDate);
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY s.start_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [shifts] = await pool.query(query, params);

    res.json({
      success: true,
      data: shifts.map(s => ({
        uuid: s.uuid,
        employee: {
          uuid: s.employee_uuid,
          fullName: s.employee_name
        },
        drawer: s.drawer_uuid ? {
          uuid: s.drawer_uuid,
          name: s.drawer_name
        } : null,
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status,
        summary: {
          totalTransactions: s.total_transactions || 0,
          totalProfit: parseDecimal(s.total_profit || 0),
          cancelledTransactions: s.cancelled_transactions || 0
        }
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
 * Get shift details
 */
const getShiftDetails = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    const [shifts] = await pool.query(`
      SELECT
        s.*,
        d.uuid as drawer_uuid,
        d.name as drawer_name,
        u.uuid as employee_uuid,
        u.full_name as employee_name,
        h.full_name as handover_to_name
      FROM shifts s
      LEFT JOIN cash_drawers d ON s.drawer_id = d.id
      JOIN users u ON s.employee_id = u.id
      LEFT JOIN users h ON s.handover_to = h.id
      WHERE s.uuid = ?
    `, [uuid]);

    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found.'
      });
    }

    const shift = shifts[0];

    // Get balances
    const [balances] = await pool.query(`
      SELECT
        sb.*,
        c.code as currency_code,
        c.symbol as currency_symbol,
        c.name as currency_name
      FROM shift_balances sb
      JOIN currencies c ON sb.currency_id = c.id
      WHERE sb.shift_id = ?
    `, [shift.id]);

    // Get summary
    const [summaries] = await pool.query(
      'SELECT * FROM shift_summaries WHERE shift_id = ?',
      [shift.id]
    );

    const summary = summaries[0] || {};

    // Get recent transactions
    const [transactions] = await pool.query(`
      SELECT
        t.uuid,
        t.customer_name,
        t.amount_in,
        t.amount_out,
        t.profit,
        t.status,
        t.transaction_date,
        ci.code as currency_in_code,
        co.code as currency_out_code
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      WHERE t.shift_id = ?
      ORDER BY t.transaction_date DESC
      LIMIT 50
    `, [shift.id]);

    res.json({
      success: true,
      data: {
        uuid: shift.uuid,
        employee: {
          uuid: shift.employee_uuid,
          fullName: shift.employee_name
        },
        drawer: shift.drawer_uuid ? {
          uuid: shift.drawer_uuid,
          name: shift.drawer_name
        } : null,
        startTime: shift.start_time,
        endTime: shift.end_time,
        status: shift.status,
        openingNotes: shift.opening_notes,
        closingNotes: shift.closing_notes,
        handover: shift.handover_to ? {
          toEmployee: shift.handover_to_name,
          notes: shift.handover_notes
        } : null,
        balances: balances.map(b => ({
          currencyCode: b.currency_code,
          currencySymbol: b.currency_symbol,
          currencyName: b.currency_name,
          openingBalance: parseDecimal(b.opening_balance),
          closingBalance: parseDecimal(b.closing_balance),
          expectedClosing: parseDecimal(b.expected_closing),
          difference: parseDecimal(b.difference)
        })),
        summary: {
          totalTransactions: summary.total_transactions || 0,
          totalProfit: parseDecimal(summary.total_profit || 0),
          totalCommission: parseDecimal(summary.total_commission || 0),
          cancelledTransactions: summary.cancelled_transactions || 0,
          totalVolumeIn: parseDecimal(summary.total_volume_in || 0),
          totalVolumeOut: parseDecimal(summary.total_volume_out || 0)
        },
        transactions: transactions.map(t => ({
          uuid: t.uuid,
          customerName: t.customer_name,
          currencyIn: t.currency_in_code,
          currencyOut: t.currency_out_code,
          amountIn: parseDecimal(t.amount_in),
          amountOut: parseDecimal(t.amount_out),
          profit: parseDecimal(t.profit),
          status: t.status,
          date: t.transaction_date
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handover shift to another employee
 */
const handoverShift = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { toEmployeeUuid, notes } = req.body;
    const ipAddress = getClientIp(req);

    const [shifts] = await pool.query(
      'SELECT * FROM shifts WHERE uuid = ? AND status = "active"',
      [uuid]
    );

    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active shift not found.'
      });
    }

    const shift = shifts[0];

    // Verify target employee
    const [employees] = await pool.query(
      'SELECT id, full_name FROM users WHERE uuid = ? AND is_active = TRUE',
      [toEmployeeUuid]
    );

    if (employees.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Target employee not found or not active.'
      });
    }

    const toEmployee = employees[0];

    // Check if target employee already has an active shift
    const [existingShifts] = await pool.query(
      'SELECT uuid FROM shifts WHERE employee_id = ? AND status = "active"',
      [toEmployee.id]
    );

    if (existingShifts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Target employee already has an active shift.'
      });
    }

    // Update current shift
    await pool.query(
      `UPDATE shifts SET handover_to = ?, handover_notes = ? WHERE id = ?`,
      [toEmployee.id, notes || null, shift.id]
    );

    // Create new shift for the target employee
    const newUuid = uuidv4();
    const [newShift] = await pool.query(
      `INSERT INTO shifts (uuid, employee_id, drawer_id, opening_notes)
       VALUES (?, ?, ?, ?)`,
      [newUuid, toEmployee.id, shift.drawer_id, `Handover from shift ${uuid}`]
    );

    // Create shift summary for new shift
    await pool.query(
      'INSERT INTO shift_summaries (shift_id) VALUES (?)',
      [newShift.insertId]
    );

    // Copy current balances as opening balances
    const [currentBalances] = await pool.query(
      'SELECT currency_id, opening_balance FROM shift_balances WHERE shift_id = ?',
      [shift.id]
    );

    for (const balance of currentBalances) {
      await pool.query(
        'INSERT INTO shift_balances (shift_id, currency_id, opening_balance) VALUES (?, ?, ?)',
        [newShift.insertId, balance.currency_id, balance.opening_balance]
      );
    }

    await logAudit(
      req.user.id,
      'SHIFT_HANDOVER',
      'shifts',
      shift.id,
      { employeeId: shift.employee_id },
      { handoverTo: toEmployee.id, newShiftUuid: newUuid },
      ipAddress,
      'info'
    );

    res.json({
      success: true,
      message: 'Shift handed over successfully.',
      data: {
        newShiftUuid: newUuid,
        handedOverTo: toEmployee.full_name
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Abandon shift (admin only)
 */
const abandonShift = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { reason } = req.body;
    const ipAddress = getClientIp(req);

    const [shifts] = await pool.query(
      'SELECT * FROM shifts WHERE uuid = ? AND status = "active"',
      [uuid]
    );

    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active shift not found.'
      });
    }

    const shift = shifts[0];

    await pool.query(
      `UPDATE shifts SET status = 'abandoned', end_time = NOW(), closing_notes = ? WHERE id = ?`,
      [reason || 'Abandoned by admin', shift.id]
    );

    await logAudit(
      req.user.id,
      'SHIFT_ABANDON',
      'shifts',
      shift.id,
      { status: 'active' },
      { status: 'abandoned', reason },
      ipAddress,
      'warning'
    );

    res.json({
      success: true,
      message: 'Shift marked as abandoned.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startShift,
  endShift,
  getActiveShift,
  getShifts,
  getShiftDetails,
  getExpectedBalances,
  handoverShift,
  abandonShift
};
