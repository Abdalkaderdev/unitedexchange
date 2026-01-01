/**
 * Audit Log Controller
 * View and search audit trail / activity logs
 */
const { pool } = require('../config/database');
const { parseDecimal } = require('../utils/helpers');

/**
 * Get audit logs with filters and pagination
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      resourceType,
      resourceId,
      userId,
      severity,
      startDate,
      endDate,
      search
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT
        a.*,
        u.full_name as user_name,
        u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ' AND a.action = ?';
      params.push(action);
    }

    if (resourceType) {
      query += ' AND a.resource_type = ?';
      params.push(resourceType);
    }

    if (resourceId) {
      query += ' AND a.resource_id = ?';
      params.push(resourceId);
    }

    if (userId) {
      query += ' AND u.uuid = ?';
      params.push(userId);
    }

    if (severity) {
      query += ' AND a.severity = ?';
      params.push(severity);
    }

    if (startDate) {
      query += ' AND DATE(a.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(a.created_at) <= ?';
      params.push(endDate);
    }

    if (search) {
      query += ' AND (a.action LIKE ? OR a.resource_type LIKE ? OR u.full_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    // Get paginated results
    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [logs] = await pool.query(query, params);

    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        user: log.user_id ? {
          id: log.user_id,
          fullName: log.user_name,
          username: log.username
        } : null,
        oldValues: log.old_values ? (typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values) : null,
        newValues: log.new_values ? (typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values) : null,
        ipAddress: log.ip_address,
        severity: log.severity,
        createdAt: log.created_at
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
 * Get single audit log entry
 */
const getAuditLog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [logs] = await pool.query(`
      SELECT
        a.*,
        u.full_name as user_name,
        u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `, [id]);

    if (logs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found.'
      });
    }

    const log = logs[0];

    res.json({
      success: true,
      data: {
        id: log.id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        user: log.user_id ? {
          id: log.user_id,
          fullName: log.user_name,
          username: log.username
        } : null,
        oldValues: log.old_values ? (typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values) : null,
        newValues: log.new_values ? (typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values) : null,
        ipAddress: log.ip_address,
        severity: log.severity,
        createdAt: log.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit history for a specific resource
 */
const getResourceHistory = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [logs] = await pool.query(`
      SELECT
        a.*,
        u.full_name as user_name,
        u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.resource_type = ? AND a.resource_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [type, id, parseInt(limit), offset]);

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM audit_logs WHERE resource_type = ? AND resource_id = ?',
      [type, id]
    );

    res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        user: log.user_id ? {
          fullName: log.user_name,
          username: log.username
        } : null,
        oldValues: log.old_values ? (typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values) : null,
        newValues: log.new_values ? (typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values) : null,
        severity: log.severity,
        createdAt: log.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit log statistics
 */
const getAuditStats = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;

    // Actions by type
    const [actionStats] = await pool.query(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `, [parseInt(days)]);

    // By resource type
    const [resourceStats] = await pool.query(`
      SELECT resource_type, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY resource_type
      ORDER BY count DESC
    `, [parseInt(days)]);

    // By severity
    const [severityStats] = await pool.query(`
      SELECT severity, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY severity
    `, [parseInt(days)]);

    // Daily activity
    const [dailyStats] = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [parseInt(days)]);

    res.json({
      success: true,
      data: {
        byAction: actionStats,
        byResource: resourceStats,
        bySeverity: severityStats,
        daily: dailyStats
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLog,
  getResourceHistory,
  getAuditStats
};
