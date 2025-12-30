/**
 * Compliance Controller
 * Manages compliance rules, alerts, and suspicious activity reports
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');

/**
 * Get all compliance rules
 */
const getRules = async (req, res, next) => {
  try {
    const { active } = req.query;

    let query = `
      SELECT r.*, c.code as currency_code, u.full_name as created_by_name
      FROM compliance_rules r
      LEFT JOIN currencies c ON r.currency_id = c.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (active !== undefined) {
      query += ' AND r.is_active = ?';
      params.push(active === 'true');
    }

    query += ' ORDER BY r.priority ASC, r.created_at DESC';

    const [rules] = await pool.query(query, params);

    res.json({
      success: true,
      data: rules.map(r => ({
        uuid: r.uuid,
        name: r.name,
        description: r.description,
        ruleType: r.rule_type,
        currency: r.currency_code || 'All',
        thresholdAmount: parseDecimal(r.threshold_amount),
        thresholdCount: r.threshold_count,
        timeWindowHours: r.time_window_hours,
        action: r.action,
        isActive: r.is_active,
        priority: r.priority,
        createdBy: r.created_by_name,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new compliance rule
 */
const createRule = async (req, res, next) => {
  try {
    const { name, description, ruleType, currencyId, thresholdAmount, thresholdCount, timeWindowHours, action, priority } = req.body;
    const ipAddress = getClientIp(req);
    const uuid = uuidv4();

    const [result] = await pool.query(
      `INSERT INTO compliance_rules
       (uuid, name, description, rule_type, currency_id, threshold_amount, threshold_count, time_window_hours, action, priority, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, name, description || null, ruleType, currencyId || null, thresholdAmount || null, thresholdCount || null, timeWindowHours || 24, action, priority || 0, req.user.id]
    );

    await logAudit(req.user.id, 'CREATE', 'compliance_rules', result.insertId, null, { uuid, name, ruleType, action }, ipAddress, 'info');

    res.status(201).json({
      success: true,
      message: 'Compliance rule created successfully.',
      data: { uuid, name, ruleType, action }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update compliance rule
 */
const updateRule = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { name, description, thresholdAmount, thresholdCount, timeWindowHours, action, priority, isActive } = req.body;
    const ipAddress = getClientIp(req);

    const [rules] = await pool.query('SELECT * FROM compliance_rules WHERE uuid = ?', [uuid]);
    if (rules.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }

    const rule = rules[0];
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (thresholdAmount !== undefined) { updates.push('threshold_amount = ?'); params.push(thresholdAmount); }
    if (thresholdCount !== undefined) { updates.push('threshold_count = ?'); params.push(thresholdCount); }
    if (timeWindowHours !== undefined) { updates.push('time_window_hours = ?'); params.push(timeWindowHours); }
    if (action !== undefined) { updates.push('action = ?'); params.push(action); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(uuid);
    await pool.query(`UPDATE compliance_rules SET ${updates.join(', ')} WHERE uuid = ?`, params);

    await logAudit(req.user.id, 'UPDATE', 'compliance_rules', rule.id, { name: rule.name }, { name, action }, ipAddress, 'info');

    res.json({ success: true, message: 'Rule updated successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle rule active status
 */
const toggleRule = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const ipAddress = getClientIp(req);

    const [rules] = await pool.query('SELECT * FROM compliance_rules WHERE uuid = ?', [uuid]);
    if (rules.length === 0) {
      return res.status(404).json({ success: false, message: 'Rule not found.' });
    }

    const rule = rules[0];
    const newStatus = !rule.is_active;

    await pool.query('UPDATE compliance_rules SET is_active = ? WHERE uuid = ?', [newStatus, uuid]);

    await logAudit(req.user.id, 'UPDATE', 'compliance_rules', rule.id, { isActive: rule.is_active }, { isActive: newStatus }, ipAddress, 'warning');

    res.json({ success: true, message: `Rule ${newStatus ? 'enabled' : 'disabled'} successfully.`, data: { isActive: newStatus } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get compliance alerts
 */
const getAlerts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, severity, alertType, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT
        a.*,
        r.name as rule_name,
        t.uuid as transaction_uuid,
        t.transaction_number,
        c.uuid as customer_uuid,
        c.full_name as customer_name,
        u.full_name as reviewed_by_name
      FROM compliance_alerts a
      LEFT JOIN compliance_rules r ON a.rule_id = r.id
      LEFT JOIN transactions t ON a.transaction_id = t.id
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN users u ON a.reviewed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND a.status = ?'; params.push(status); }
    if (severity) { query += ' AND a.severity = ?'; params.push(severity); }
    if (alertType) { query += ' AND a.alert_type = ?'; params.push(alertType); }
    if (startDate) { query += ' AND DATE(a.created_at) >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND DATE(a.created_at) <= ?'; params.push(endDate); }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [alerts] = await pool.query(query, params);

    res.json({
      success: true,
      data: alerts.map(a => ({
        uuid: a.uuid,
        ruleName: a.rule_name,
        alertType: a.alert_type,
        severity: a.severity,
        description: a.description,
        details: a.details ? JSON.parse(a.details) : null,
        transaction: a.transaction_uuid ? { uuid: a.transaction_uuid, number: a.transaction_number } : null,
        customer: a.customer_uuid ? { uuid: a.customer_uuid, name: a.customer_name } : null,
        status: a.status,
        reviewedBy: a.reviewed_by_name,
        reviewedAt: a.reviewed_at,
        reviewNotes: a.review_notes,
        createdAt: a.created_at
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Review an alert
 */
const reviewAlert = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { status, notes } = req.body;
    const ipAddress = getClientIp(req);

    const [alerts] = await pool.query('SELECT * FROM compliance_alerts WHERE uuid = ?', [uuid]);
    if (alerts.length === 0) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const alert = alerts[0];

    await pool.query(
      'UPDATE compliance_alerts SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE uuid = ?',
      [status, notes || null, req.user.id, uuid]
    );

    await logAudit(req.user.id, 'ALERT_REVIEW', 'compliance_alerts', alert.id, { status: alert.status }, { status, notes }, ipAddress, 'info');

    res.json({ success: true, message: 'Alert reviewed successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Check transaction against compliance rules
 * Called internally during transaction creation
 */
const checkTransaction = async (transaction, customerId) => {
  const alerts = [];

  try {
    // Get active rules
    const [rules] = await pool.query(
      'SELECT * FROM compliance_rules WHERE is_active = TRUE ORDER BY priority ASC'
    );

    for (const rule of rules) {
      let shouldAlert = false;
      let description = '';
      let severity = 'medium';

      switch (rule.rule_type) {
        case 'transaction_limit':
          if (rule.threshold_amount && transaction.amountIn >= rule.threshold_amount) {
            shouldAlert = true;
            description = `Transaction amount (${transaction.amountIn}) exceeds threshold (${rule.threshold_amount})`;
            severity = transaction.amountIn >= rule.threshold_amount * 2 ? 'high' : 'medium';
          }
          break;

        case 'daily_limit':
          if (customerId && rule.threshold_amount) {
            const [dailyTotal] = await pool.query(`
              SELECT COALESCE(SUM(amount_in), 0) as total
              FROM transactions
              WHERE customer_id = ? AND DATE(transaction_date) = CURDATE() AND status = 'completed' AND deleted_at IS NULL
            `, [customerId]);

            const newTotal = parseFloat(dailyTotal[0].total) + transaction.amountIn;
            if (newTotal >= rule.threshold_amount) {
              shouldAlert = true;
              description = `Customer daily total (${newTotal}) exceeds threshold (${rule.threshold_amount})`;
              severity = 'high';
            }
          }
          break;

        case 'velocity':
          if (customerId && rule.threshold_count) {
            const [transactionCount] = await pool.query(`
              SELECT COUNT(*) as count
              FROM transactions
              WHERE customer_id = ? AND transaction_date >= DATE_SUB(NOW(), INTERVAL ? HOUR) AND status = 'completed'
            `, [customerId, rule.time_window_hours || 24]);

            if (transactionCount[0].count >= rule.threshold_count) {
              shouldAlert = true;
              description = `Customer has ${transactionCount[0].count + 1} transactions in ${rule.time_window_hours}h (threshold: ${rule.threshold_count})`;
              severity = 'medium';
            }
          }
          break;

        case 'id_required':
          if (rule.threshold_amount && transaction.amountIn >= rule.threshold_amount) {
            if (!transaction.customerIdNumber) {
              shouldAlert = true;
              description = `Customer ID required for transactions over ${rule.threshold_amount}`;
              severity = 'low';
            }
          }
          break;
      }

      if (shouldAlert) {
        alerts.push({
          ruleId: rule.id,
          alertType: rule.rule_type === 'transaction_limit' ? 'large_transaction' :
                     rule.rule_type === 'daily_limit' ? 'daily_limit_exceeded' :
                     rule.rule_type === 'velocity' ? 'velocity_exceeded' : 'id_missing',
          severity,
          description,
          action: rule.action
        });
      }
    }

    return alerts;
  } catch (error) {
    console.error('Compliance check error:', error);
    return [];
  }
};

/**
 * Create compliance alert
 */
const createAlert = async (alertData, transactionId, customerId) => {
  try {
    const uuid = uuidv4();
    await pool.query(
      `INSERT INTO compliance_alerts (uuid, rule_id, transaction_id, customer_id, alert_type, severity, description, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, alertData.ruleId, transactionId, customerId, alertData.alertType, alertData.severity, alertData.description, JSON.stringify(alertData.details || {})]
    );

    // Update customer risk profile if customer exists
    if (customerId) {
      await pool.query(`
        INSERT INTO customer_risk_profiles (customer_id, total_alerts, last_alert_date)
        VALUES (?, 1, NOW())
        ON DUPLICATE KEY UPDATE
          total_alerts = total_alerts + 1,
          last_alert_date = NOW(),
          risk_score = LEAST(risk_score + 10, 100)
      `, [customerId]);
    }

    return uuid;
  } catch (error) {
    console.error('Create alert error:', error);
    return null;
  }
};

/**
 * Get customer risk profile
 */
const getCustomerRiskProfile = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    const [customers] = await pool.query('SELECT id, full_name FROM customers WHERE uuid = ?', [uuid]);
    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const customer = customers[0];

    const [profiles] = await pool.query(`
      SELECT p.*, u.full_name as reviewed_by_name
      FROM customer_risk_profiles p
      LEFT JOIN users u ON p.reviewed_by = u.id
      WHERE p.customer_id = ?
    `, [customer.id]);

    const profile = profiles[0] || { risk_score: 0, risk_level: 'low', total_alerts: 0, total_sars: 0 };

    // Get recent alerts
    const [recentAlerts] = await pool.query(`
      SELECT uuid, alert_type, severity, description, status, created_at
      FROM compliance_alerts
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [customer.id]);

    // Get transaction stats
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount_in), 0) as total_volume,
        COALESCE(AVG(amount_in), 0) as avg_transaction
      FROM transactions
      WHERE customer_id = ? AND status = 'completed' AND deleted_at IS NULL
    `, [customer.id]);

    res.json({
      success: true,
      data: {
        customer: { uuid, name: customer.full_name },
        riskScore: profile.risk_score,
        riskLevel: profile.risk_level,
        totalAlerts: profile.total_alerts,
        totalSARs: profile.total_sars,
        lastAlertDate: profile.last_alert_date,
        lastReviewDate: profile.last_review_date,
        reviewedBy: profile.reviewed_by_name,
        notes: profile.notes,
        stats: {
          totalTransactions: stats[0].total_transactions,
          totalVolume: parseDecimal(stats[0].total_volume),
          avgTransaction: parseDecimal(stats[0].avg_transaction)
        },
        recentAlerts: recentAlerts.map(a => ({
          uuid: a.uuid,
          type: a.alert_type,
          severity: a.severity,
          description: a.description,
          status: a.status,
          createdAt: a.created_at
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Suspicious Activity Report
 */
const createSAR = async (req, res, next) => {
  try {
    const { customerUuid, alertUuids, transactionUuids, description, riskLevel } = req.body;
    const ipAddress = getClientIp(req);

    let customerId = null;
    if (customerUuid) {
      const [customers] = await pool.query('SELECT id FROM customers WHERE uuid = ?', [customerUuid]);
      if (customers.length > 0) customerId = customers[0].id;
    }

    const uuid = uuidv4();

    await pool.query(
      `INSERT INTO suspicious_activity_reports (uuid, customer_id, alert_ids, transaction_ids, description, risk_level, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, customerId, JSON.stringify(alertUuids || []), JSON.stringify(transactionUuids || []), description, riskLevel, req.user.id]
    );

    // Update customer risk profile
    if (customerId) {
      await pool.query(`
        UPDATE customer_risk_profiles
        SET total_sars = total_sars + 1, risk_level = 'high', risk_score = LEAST(risk_score + 30, 100)
        WHERE customer_id = ?
      `, [customerId]);
    }

    await logAudit(req.user.id, 'CREATE_SAR', 'suspicious_activity_reports', uuid, null, { customerUuid, riskLevel }, ipAddress, 'critical');

    res.status(201).json({
      success: true,
      message: 'SAR created successfully.',
      data: { uuid }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get SARs list
 */
const getSARs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, riskLevel } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT
        s.*,
        c.uuid as customer_uuid,
        c.full_name as customer_name,
        cb.full_name as created_by_name,
        sb.full_name as submitted_by_name
      FROM suspicious_activity_reports s
      LEFT JOIN customers c ON s.customer_id = c.id
      JOIN users cb ON s.created_by = cb.id
      LEFT JOIN users sb ON s.submitted_by = sb.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND s.status = ?'; params.push(status); }
    if (riskLevel) { query += ' AND s.risk_level = ?'; params.push(riskLevel); }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [sars] = await pool.query(query, params);

    res.json({
      success: true,
      data: sars.map(s => ({
        uuid: s.uuid,
        customer: s.customer_uuid ? { uuid: s.customer_uuid, name: s.customer_name } : null,
        description: s.description,
        riskLevel: s.risk_level,
        status: s.status,
        createdBy: s.created_by_name,
        submittedBy: s.submitted_by_name,
        submittedAt: s.submitted_at,
        createdAt: s.created_at
      })),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get compliance dashboard stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [pendingAlerts] = await pool.query(
      'SELECT COUNT(*) as count FROM compliance_alerts WHERE status = "pending"'
    );

    const [alertsBySeverity] = await pool.query(`
      SELECT severity, COUNT(*) as count
      FROM compliance_alerts
      WHERE status = 'pending'
      GROUP BY severity
    `);

    const [recentAlerts] = await pool.query(`
      SELECT uuid, alert_type, severity, description, created_at
      FROM compliance_alerts
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const [openSARs] = await pool.query(
      'SELECT COUNT(*) as count FROM suspicious_activity_reports WHERE status IN ("draft", "submitted", "under_review")'
    );

    const [highRiskCustomers] = await pool.query(
      'SELECT COUNT(*) as count FROM customer_risk_profiles WHERE risk_level = "high"'
    );

    res.json({
      success: true,
      data: {
        pendingAlerts: pendingAlerts[0].count,
        alertsBySeverity: alertsBySeverity.reduce((acc, row) => {
          acc[row.severity] = row.count;
          return acc;
        }, {}),
        openSARs: openSARs[0].count,
        highRiskCustomers: highRiskCustomers[0].count,
        recentAlerts: recentAlerts.map(a => ({
          uuid: a.uuid,
          type: a.alert_type,
          severity: a.severity,
          description: a.description,
          createdAt: a.created_at
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRules,
  createRule,
  updateRule,
  toggleRule,
  getAlerts,
  reviewAlert,
  checkTransaction,
  createAlert,
  getCustomerRiskProfile,
  createSAR,
  getSARs,
  getDashboardStats
};
