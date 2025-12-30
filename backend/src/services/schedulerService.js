/**
 * Scheduler Service
 * Handles scheduling and execution of automated reports
 * Uses setTimeout/setInterval for scheduling (no external dependencies)
 */
const { pool } = require('../config/database');
const emailService = require('./emailService');
const exportService = require('./exportService');
const logger = require('../utils/logger');
const { parseDecimal } = require('../utils/helpers');

// Store active schedules in memory
const activeSchedules = new Map();

// Scheduler check interval (check every minute)
const SCHEDULER_INTERVAL = 60 * 1000;

// Main scheduler interval reference
let schedulerInterval = null;

/**
 * Initialize the scheduler service
 * Loads all active schedules from database and starts the scheduler
 */
const initScheduler = async () => {
  try {
    logger.info('Initializing scheduler service...');

    // Load all active schedules
    const schedules = await loadActiveSchedules();
    logger.info(`Loaded ${schedules.length} active schedules`);

    // Start the main scheduler interval
    if (!schedulerInterval) {
      schedulerInterval = setInterval(runScheduledReports, SCHEDULER_INTERVAL);
      logger.info('Scheduler service started');
    }

    return true;
  } catch (error) {
    logger.error('Failed to initialize scheduler service', { error: error.message });
    return false;
  }
};

/**
 * Stop the scheduler service
 */
const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Scheduler service stopped');
  }

  // Clear all active schedule timeouts
  for (const [id, timeoutId] of activeSchedules) {
    clearTimeout(timeoutId);
  }
  activeSchedules.clear();
};

/**
 * Load all active schedules from database
 * @returns {Promise<Array>} Array of active schedules
 */
const loadActiveSchedules = async () => {
  const [schedules] = await pool.query(`
    SELECT * FROM scheduled_reports WHERE is_active = TRUE
  `);
  return schedules;
};

/**
 * Schedule a new report
 * @param {object} config - Schedule configuration
 * @returns {Promise<object>} Created schedule
 */
const scheduleReport = async (config) => {
  const {
    uuid,
    name,
    reportType,
    scheduleType,
    scheduleDay,
    scheduleTime,
    recipients,
    exportFormat,
    filters,
    createdBy
  } = config;

  // Calculate next run time
  const nextRunAt = calculateNextRunTime(scheduleType, scheduleDay, scheduleTime);

  // Insert into database
  const [result] = await pool.query(`
    INSERT INTO scheduled_reports
      (uuid, name, report_type, schedule_type, schedule_day, schedule_time, recipients, export_format, filters, created_by, next_run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    uuid,
    name,
    reportType,
    scheduleType,
    scheduleDay,
    scheduleTime,
    JSON.stringify(recipients),
    exportFormat || 'xlsx',
    filters ? JSON.stringify(filters) : null,
    createdBy,
    nextRunAt
  ]);

  logger.info('Scheduled report created', { uuid, name, nextRunAt });

  return {
    id: result.insertId,
    uuid,
    name,
    nextRunAt
  };
};

/**
 * Cancel a scheduled report
 * @param {string} uuid - Schedule UUID
 * @returns {Promise<boolean>} Success status
 */
const cancelSchedule = async (uuid) => {
  // Get the schedule ID
  const [schedules] = await pool.query(
    'SELECT id FROM scheduled_reports WHERE uuid = ?',
    [uuid]
  );

  if (schedules.length === 0) {
    return false;
  }

  const scheduleId = schedules[0].id;

  // Remove from active schedules if present
  if (activeSchedules.has(scheduleId)) {
    clearTimeout(activeSchedules.get(scheduleId));
    activeSchedules.delete(scheduleId);
  }

  // Deactivate in database
  await pool.query(
    'UPDATE scheduled_reports SET is_active = FALSE WHERE uuid = ?',
    [uuid]
  );

  logger.info('Scheduled report cancelled', { uuid });

  return true;
};

/**
 * List all schedules
 * @param {object} options - Filter options
 * @returns {Promise<Array>} Array of schedules
 */
const listSchedules = async (options = {}) => {
  const { page = 1, limit = 20, isActive = null } = options;
  const offset = (page - 1) * limit;

  let query = `
    SELECT
      sr.*,
      u.full_name as created_by_name
    FROM scheduled_reports sr
    JOIN users u ON sr.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (isActive !== null) {
    query += ' AND sr.is_active = ?';
    params.push(isActive);
  }

  query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [schedules] = await pool.query(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM scheduled_reports WHERE 1=1';
  const countParams = [];

  if (isActive !== null) {
    countQuery += ' AND is_active = ?';
    countParams.push(isActive);
  }

  const [countResult] = await pool.query(countQuery, countParams);
  const total = countResult[0].total;

  return {
    schedules,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Run all scheduled reports that are due
 */
const runScheduledReports = async () => {
  try {
    const now = new Date();

    // Find all schedules that are due to run
    const [dueSchedules] = await pool.query(`
      SELECT * FROM scheduled_reports
      WHERE is_active = TRUE
        AND next_run_at <= ?
    `, [now]);

    for (const schedule of dueSchedules) {
      await executeScheduledReport(schedule);
    }
  } catch (error) {
    logger.error('Error running scheduled reports', { error: error.message });
  }
};

/**
 * Execute a single scheduled report
 * @param {object} schedule - Schedule object from database
 */
const executeScheduledReport = async (schedule) => {
  const startTime = Date.now();

  try {
    logger.info('Executing scheduled report', {
      uuid: schedule.uuid,
      name: schedule.name,
      reportType: schedule.report_type
    });

    // Generate the report data
    const reportData = await generateReportData(
      schedule.report_type,
      schedule.filters ? JSON.parse(schedule.filters) : {}
    );

    // Export the report
    const fileBuffer = await exportReport(
      schedule.report_type,
      reportData,
      schedule.export_format
    );

    // Get recipients
    const recipients = JSON.parse(schedule.recipients);

    // Send email with report
    const emailResult = await emailService.sendReportEmail(
      recipients,
      schedule.report_type,
      reportData,
      schedule.export_format,
      fileBuffer
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || 'Failed to send email');
    }

    // Calculate next run time
    const nextRunAt = calculateNextRunTime(
      schedule.schedule_type,
      schedule.schedule_day,
      schedule.schedule_time
    );

    // Update schedule in database
    await pool.query(`
      UPDATE scheduled_reports
      SET last_run_at = NOW(), next_run_at = ?
      WHERE id = ?
    `, [nextRunAt, schedule.id]);

    const duration = Date.now() - startTime;
    logger.info('Scheduled report executed successfully', {
      uuid: schedule.uuid,
      name: schedule.name,
      duration: `${duration}ms`,
      nextRunAt
    });

  } catch (error) {
    logger.error('Failed to execute scheduled report', {
      uuid: schedule.uuid,
      name: schedule.name,
      error: error.message
    });

    // Send failure notification to recipients
    try {
      const recipients = JSON.parse(schedule.recipients);
      await emailService.sendScheduleNotification(
        recipients,
        schedule.name,
        'failed',
        { error: error.message }
      );
    } catch (notifyError) {
      logger.error('Failed to send failure notification', {
        error: notifyError.message
      });
    }
  }
};

/**
 * Manually run a scheduled report
 * @param {string} uuid - Schedule UUID
 * @returns {Promise<object>} Run result
 */
const runScheduleNow = async (uuid) => {
  const [schedules] = await pool.query(
    'SELECT * FROM scheduled_reports WHERE uuid = ?',
    [uuid]
  );

  if (schedules.length === 0) {
    throw new Error('Schedule not found');
  }

  const schedule = schedules[0];
  await executeScheduledReport(schedule);

  return {
    success: true,
    message: 'Report executed successfully'
  };
};

/**
 * Calculate the next run time for a schedule
 * @param {string} scheduleType - 'daily' or 'weekly'
 * @param {number|null} scheduleDay - Day of week for weekly (0-6, where 0 is Sunday)
 * @param {string} scheduleTime - Time in HH:MM:SS format
 * @returns {Date} Next run time
 */
const calculateNextRunTime = (scheduleType, scheduleDay, scheduleTime) => {
  const now = new Date();
  const [hours, minutes, seconds] = scheduleTime.split(':').map(Number);

  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, seconds || 0, 0);

  if (scheduleType === 'daily') {
    // If the time has already passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (scheduleType === 'weekly') {
    const targetDay = scheduleDay !== null ? scheduleDay : 1; // Default to Monday
    const currentDay = now.getDay();
    let daysUntilTarget = targetDay - currentDay;

    if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
      daysUntilTarget += 7;
    }

    nextRun.setDate(nextRun.getDate() + daysUntilTarget);
  }

  return nextRun;
};

/**
 * Generate report data based on report type
 * @param {string} reportType - Type of report
 * @param {object} filters - Report filters
 * @returns {Promise<object>} Report data
 */
const generateReportData = async (reportType, filters = {}) => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  switch (reportType) {
    case 'daily':
      return await generateDailyReportData(filters.date || today);

    case 'monthly':
      return await generateMonthlyReportData(
        filters.year || currentYear,
        filters.month || currentMonth
      );

    case 'profit_loss':
      return await generateProfitLossReportData(
        filters.startDate,
        filters.endDate
      );

    case 'transactions':
      return await generateTransactionsReportData(filters);

    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
};

/**
 * Generate daily report data
 * @param {string} date - Report date
 * @returns {Promise<object>} Report data
 */
const generateDailyReportData = async (date) => {
  const [transactions] = await pool.query(`
    SELECT
      t.uuid,
      t.customer_name,
      t.amount_in,
      t.amount_out,
      t.exchange_rate,
      t.profit,
      t.commission,
      t.status,
      t.transaction_date as created_at,
      ci.code as currency_in_code,
      co.code as currency_out_code,
      u.full_name as employee_name
    FROM transactions t
    JOIN currencies ci ON t.currency_in_id = ci.id
    JOIN currencies co ON t.currency_out_id = co.id
    JOIN users u ON t.employee_id = u.id
    WHERE DATE(t.transaction_date) = ?
      AND t.deleted_at IS NULL
      AND t.status = 'completed'
    ORDER BY t.transaction_date DESC
  `, [date]);

  const [totals] = await pool.query(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(profit), 0) as total_profit,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(amount_in), 0) as total_in
    FROM transactions
    WHERE DATE(transaction_date) = ?
      AND deleted_at IS NULL
      AND status = 'completed'
  `, [date]);

  return {
    date,
    transactions,
    summary: {
      totalTransactions: totals[0].transaction_count,
      totalProfit: parseDecimal(totals[0].total_profit),
      totalCommission: parseDecimal(totals[0].total_commission),
      totalVolume: parseDecimal(totals[0].total_in)
    }
  };
};

/**
 * Generate monthly report data
 * @param {number} year - Report year
 * @param {number} month - Report month
 * @returns {Promise<object>} Report data
 */
const generateMonthlyReportData = async (year, month) => {
  const [dailyBreakdown] = await pool.query(`
    SELECT
      DATE(transaction_date) as date,
      COUNT(*) as transaction_count,
      COALESCE(SUM(profit), 0) as profit,
      COALESCE(SUM(amount_in), 0) as volume
    FROM transactions
    WHERE YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?
      AND deleted_at IS NULL
      AND status = 'completed'
    GROUP BY DATE(transaction_date)
    ORDER BY date
  `, [year, month]);

  const [totals] = await pool.query(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(profit), 0) as total_profit,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(amount_in), 0) as total_volume
    FROM transactions
    WHERE YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?
      AND deleted_at IS NULL
      AND status = 'completed'
  `, [year, month]);

  return {
    year,
    month,
    dailyBreakdown,
    summary: {
      totalTransactions: totals[0].transaction_count,
      totalProfit: parseDecimal(totals[0].total_profit),
      totalCommission: parseDecimal(totals[0].total_commission),
      totalVolume: parseDecimal(totals[0].total_volume)
    }
  };
};

/**
 * Generate profit/loss report data
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @returns {Promise<object>} Report data
 */
const generateProfitLossReportData = async (startDate, endDate) => {
  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const [dailyData] = await pool.query(`
    SELECT
      DATE(transaction_date) as date,
      COUNT(*) as transactions,
      COALESCE(SUM(profit), 0) as profit,
      COALESCE(SUM(commission), 0) as commission,
      COALESCE(SUM(amount_in), 0) as revenue
    FROM transactions
    WHERE transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      AND deleted_at IS NULL
      AND status = 'completed'
    GROUP BY DATE(transaction_date)
    ORDER BY date
  `, [start, end]);

  const totalProfit = dailyData.reduce((sum, d) => sum + parseFloat(d.profit), 0);
  const totalCommission = dailyData.reduce((sum, d) => sum + parseFloat(d.commission), 0);
  const totalRevenue = dailyData.reduce((sum, d) => sum + parseFloat(d.revenue), 0);
  const totalTransactions = dailyData.reduce((sum, d) => sum + parseInt(d.transactions), 0);

  return {
    startDate: start,
    endDate: end,
    dailyData,
    summary: {
      totalTransactions,
      totalRevenue: parseDecimal(totalRevenue),
      totalProfit: parseDecimal(totalProfit),
      totalCommission: parseDecimal(totalCommission),
      netProfit: parseDecimal(totalProfit + totalCommission)
    }
  };
};

/**
 * Generate transactions report data
 * @param {object} filters - Report filters
 * @returns {Promise<object>} Report data
 */
const generateTransactionsReportData = async (filters = {}) => {
  let query = `
    SELECT
      t.uuid,
      t.customer_name,
      t.amount_in,
      t.amount_out,
      t.exchange_rate,
      t.profit,
      t.commission,
      t.status,
      t.transaction_date as created_at,
      ci.code as currency_in_code,
      co.code as currency_out_code,
      u.full_name as employee_name
    FROM transactions t
    JOIN currencies ci ON t.currency_in_id = ci.id
    JOIN currencies co ON t.currency_out_id = co.id
    JOIN users u ON t.employee_id = u.id
    WHERE t.deleted_at IS NULL
  `;
  const params = [];

  if (filters.startDate) {
    query += ' AND t.transaction_date >= ?';
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ' AND t.transaction_date <= DATE_ADD(?, INTERVAL 1 DAY)';
    params.push(filters.endDate);
  }
  if (filters.status) {
    query += ' AND t.status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY t.transaction_date DESC LIMIT 10000';

  const [transactions] = await pool.query(query, params);

  const totalProfit = transactions.reduce((sum, t) => sum + parseFloat(t.profit || 0), 0);
  const totalVolume = transactions.reduce((sum, t) => sum + parseFloat(t.amount_in || 0), 0);

  return {
    transactions,
    summary: {
      totalTransactions: transactions.length,
      totalProfit: parseDecimal(totalProfit),
      totalVolume: parseDecimal(totalVolume)
    }
  };
};

/**
 * Export report data to specified format
 * @param {string} reportType - Type of report
 * @param {object} data - Report data
 * @param {string} format - Export format (xlsx, csv, pdf)
 * @returns {Promise<Buffer>} File buffer
 */
const exportReport = async (reportType, data, format) => {
  let exportData;

  switch (reportType) {
    case 'daily':
      exportData = exportService.formatTransactionsForExport(data.transactions);
      break;

    case 'monthly':
      exportData = exportService.formatMonthlyReportForExport({
        ...data,
        totalTransactions: data.summary.totalTransactions,
        totalProfit: data.summary.totalProfit,
        totalVolume: data.summary.totalVolume
      });
      break;

    case 'profit_loss':
      exportData = {
        'Daily P&L': data.dailyData.map(d => ({
          Date: d.date,
          Transactions: d.transactions,
          Revenue: parseDecimal(d.revenue),
          Profit: parseDecimal(d.profit),
          Commission: parseDecimal(d.commission)
        }))
      };
      break;

    case 'transactions':
      exportData = exportService.formatTransactionsForExport(data.transactions);
      break;

    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

  switch (format) {
    case 'csv':
      const csvData = Array.isArray(exportData) ? exportData : exportData[Object.keys(exportData)[0]];
      return Buffer.from(exportService.generateCSV(csvData));

    case 'pdf':
      const pdfData = Array.isArray(exportData) ? exportData : exportData[Object.keys(exportData)[0]];
      return await exportService.generatePDF(pdfData, {
        title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1).replace('_', ' ')} Report`,
        summary: data.summary
      });

    case 'xlsx':
    default:
      return exportService.generateExcel(exportData);
  }
};

/**
 * Update schedule's next run time
 * @param {string} uuid - Schedule UUID
 * @returns {Promise<Date>} New next run time
 */
const updateNextRunTime = async (uuid) => {
  const [schedules] = await pool.query(
    'SELECT * FROM scheduled_reports WHERE uuid = ?',
    [uuid]
  );

  if (schedules.length === 0) {
    throw new Error('Schedule not found');
  }

  const schedule = schedules[0];
  const nextRunAt = calculateNextRunTime(
    schedule.schedule_type,
    schedule.schedule_day,
    schedule.schedule_time
  );

  await pool.query(
    'UPDATE scheduled_reports SET next_run_at = ? WHERE uuid = ?',
    [nextRunAt, uuid]
  );

  return nextRunAt;
};

module.exports = {
  initScheduler,
  stopScheduler,
  scheduleReport,
  cancelSchedule,
  listSchedules,
  runScheduledReports,
  runScheduleNow,
  calculateNextRunTime,
  generateReportData,
  exportReport,
  updateNextRunTime
};
