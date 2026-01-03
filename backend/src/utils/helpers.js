/**
 * Helper Utilities
 * Production-ready utility functions with enhanced audit logging
 */
const { pool } = require('../config/database');

/**
 * Log an audit entry with comprehensive information
 * @param {number|null} userId - User ID (null for anonymous actions)
 * @param {string} action - Action type (LOGIN, LOGOUT, CREATE, UPDATE, DELETE, RATE_CHANGE, etc.)
 * @param {string} resourceType - Table or resource name
 * @param {string|number|null} resourceId - ID of affected record
 * @param {object|null} oldValues - Previous values (for updates)
 * @param {object|null} newValues - New values
 * @param {string|null} ipAddress - Client IP
 * @param {string} severity - 'info', 'warning', or 'critical'
 */
const logAudit = async (
  userId,
  action,
  resourceType,
  resourceId,
  oldValues,
  newValues,
  ipAddress,
  severity = 'info',
  connection = null
) => {
  try {
    const db = connection || pool;
    await db.query(
      `INSERT INTO audit_logs
       (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, severity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        resourceType,
        resourceId ? String(resourceId) : null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        severity
      ]
    );
  } catch (error) {
    // Don't throw - audit logging should not break main operations
    console.error('Audit log error:', error.message);
  }
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown';
};

/**
 * Format date to MySQL datetime string
 */
const formatDate = (date) => {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Format date for display
 */
const formatDisplayDate = (date, locale = 'en-US') => {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Calculate profit from exchange transaction
 * Uses precise decimal arithmetic to avoid floating point issues
 * @param {number} amountIn - Amount received from customer
 * @param {number} marketRate - Current market rate
 * @param {number} appliedRate - Rate applied to transaction
 * @returns {number} Calculated profit
 */
const calculateProfit = (amountIn, marketRate, appliedRate) => {
  // Convert to cents/smallest unit to avoid floating point issues
  const amountInCents = Math.round(amountIn * 100);
  const rateSpread = appliedRate - marketRate;
  const profitCents = Math.round(amountInCents * rateSpread);
  return profitCents / 100;
};

/**
 * Safely parse decimal values
 */
const parseDecimal = (value, decimals = 2) => {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : parseFloat(num.toFixed(decimals));
};

/**
 * Generate transaction number
 * Format: TXN + YYYYMMDD + 4-digit sequence
 */
const generateTransactionNumber = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const [rows] = await pool.query(
    `SELECT MAX(CAST(SUBSTRING(transaction_number, 12) AS UNSIGNED)) as last_num
     FROM transactions
     WHERE transaction_number LIKE ?`,
    [`TXN${datePrefix}%`]
  );

  const nextNum = (rows[0]?.last_num || 0) + 1;
  return `TXN${datePrefix}${String(nextNum).padStart(4, '0')}`;
};

/**
 * Sanitize user input for logging (remove sensitive data)
 */
const sanitizeForLog = (data) => {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'ssn'];
  const sanitized = { ...data };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

/**
 * Validate that a value is a positive decimal
 */
const isPositiveDecimal = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
};

/**
 * Convert amount between currencies using rate
 */
const convertAmount = (amount, rate, decimals = 2) => {
  const result = parseFloat(amount) * parseFloat(rate);
  return parseFloat(result.toFixed(decimals));
};

module.exports = {
  logAudit,
  getClientIp,
  formatDate,
  formatDisplayDate,
  calculateProfit,
  parseDecimal,
  generateTransactionNumber,
  sanitizeForLog,
  isPositiveDecimal,
  convertAmount
};
