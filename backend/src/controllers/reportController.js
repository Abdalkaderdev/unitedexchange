/**
 * Report Controller
 * Production-ready with daily closing reports, soft delete filters, and comprehensive summaries
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');
const exportService = require('../services/exportService');

/**
 * Get daily report with transaction details
 * Excludes soft-deleted transactions
 */
const getDailyReport = async (req, res, next) => {
  try {
    const { date, employeeId } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT
        t.id,
        t.uuid,
        t.customer_name,
        t.amount_in,
        t.amount_out,
        t.exchange_rate,
        t.profit,
        t.commission,
        t.status,
        t.transaction_date,
        ci.code as currency_in_code,
        ci.symbol as currency_in_symbol,
        co.code as currency_out_code,
        co.symbol as currency_out_symbol,
        u.full_name as employee_name
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      WHERE DATE(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;

    const params = [reportDate];

    if (employeeId) {
      query += ' AND u.uuid = ?';
      params.push(employeeId);
    }

    query += ' ORDER BY t.transaction_date DESC';

    const [transactions] = await pool.query(query, params);

    // Calculate summary - exclude soft-deleted and cancelled
    let summaryQuery = `
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(t.profit), 0) as total_profit,
        COALESCE(SUM(t.commission), 0) as total_commission,
        ci.code as currency_code,
        COALESCE(SUM(t.amount_in), 0) as total_in,
        COALESCE(SUM(t.amount_out), 0) as total_out
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      WHERE DATE(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;

    const summaryParams = [reportDate];

    if (employeeId) {
      summaryQuery += ' AND t.employee_id = (SELECT id FROM users WHERE uuid = ?)';
      summaryParams.push(employeeId);
    }

    summaryQuery += ' GROUP BY ci.code';

    const [summary] = await pool.query(summaryQuery, summaryParams);

    // Get total profit for the day
    let totalProfitQuery = `
      SELECT
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(commission), 0) as total_commission,
        COUNT(*) as total_count
      FROM transactions
      WHERE DATE(transaction_date) = ?
        AND deleted_at IS NULL
        AND status = 'completed'
    `;

    const totalProfitParams = [reportDate];

    if (employeeId) {
      totalProfitQuery += ' AND employee_id = (SELECT id FROM users WHERE uuid = ?)';
      totalProfitParams.push(employeeId);
    }

    const [totalProfit] = await pool.query(totalProfitQuery, totalProfitParams);

    // Get cancelled transactions count for the day
    const [cancelledCount] = await pool.query(`
      SELECT COUNT(*) as count FROM transactions
      WHERE DATE(transaction_date) = ? AND status = 'cancelled' AND deleted_at IS NULL
    `, [reportDate]);

    res.json({
      success: true,
      data: {
        date: reportDate,
        transactions: transactions.map(t => ({
          uuid: t.uuid,
          customerName: t.customer_name,
          currencyIn: { code: t.currency_in_code, symbol: t.currency_in_symbol },
          currencyOut: { code: t.currency_out_code, symbol: t.currency_out_symbol },
          amountIn: parseDecimal(t.amount_in),
          amountOut: parseDecimal(t.amount_out),
          exchangeRate: parseDecimal(t.exchange_rate, 6),
          profit: parseDecimal(t.profit),
          commission: parseDecimal(t.commission),
          status: t.status,
          transactionDate: t.transaction_date,
          employeeName: t.employee_name
        })),
        summary: {
          totalTransactions: totalProfit[0].total_count,
          cancelledTransactions: cancelledCount[0].count,
          totalProfit: parseDecimal(totalProfit[0].total_profit),
          totalCommission: parseDecimal(totalProfit[0].total_commission),
          byCurrency: summary.map(s => ({
            currency: s.currency_code,
            totalIn: parseDecimal(s.total_in),
            totalOut: parseDecimal(s.total_out),
            count: parseInt(s.total_transactions)
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get monthly report with daily breakdown
 * Excludes soft-deleted transactions
 */
const getMonthlyReport = async (req, res, next) => {
  try {
    const { year, month, employeeId } = req.query;

    const reportYear = year || new Date().getFullYear();
    const reportMonth = month || (new Date().getMonth() + 1);

    let dailyQuery = `
      SELECT
        DATE(t.transaction_date) as date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.profit), 0) as daily_profit,
        COALESCE(SUM(t.commission), 0) as daily_commission,
        COALESCE(SUM(t.amount_in), 0) as total_in,
        COALESCE(SUM(t.amount_out), 0) as total_out
      FROM transactions t
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;

    const params = [reportYear, reportMonth];

    if (employeeId) {
      dailyQuery += ' AND t.employee_id = (SELECT id FROM users WHERE uuid = ?)';
      params.push(employeeId);
    }

    dailyQuery += ' GROUP BY DATE(t.transaction_date) ORDER BY date';

    const [dailySummary] = await pool.query(dailyQuery, params);

    // Monthly totals
    let monthlyQuery = `
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(t.profit), 0) as total_profit,
        COALESCE(SUM(t.commission), 0) as total_commission,
        COALESCE(SUM(t.amount_in), 0) as total_in,
        COALESCE(SUM(t.amount_out), 0) as total_out
      FROM transactions t
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;

    const monthlyParams = [reportYear, reportMonth];

    if (employeeId) {
      monthlyQuery += ' AND t.employee_id = (SELECT id FROM users WHERE uuid = ?)';
      monthlyParams.push(employeeId);
    }

    const [monthlyTotals] = await pool.query(monthlyQuery, monthlyParams);

    // By currency breakdown
    let currencyQuery = `
      SELECT
        ci.code as currency_in,
        co.code as currency_out,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.amount_in), 0) as total_in,
        COALESCE(SUM(t.amount_out), 0) as total_out,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;

    const currencyParams = [reportYear, reportMonth];

    if (employeeId) {
      currencyQuery += ' AND t.employee_id = (SELECT id FROM users WHERE uuid = ?)';
      currencyParams.push(employeeId);
    }

    currencyQuery += ' GROUP BY ci.code, co.code ORDER BY transaction_count DESC';

    const [currencyBreakdown] = await pool.query(currencyQuery, currencyParams);

    // Top employees
    let employeeQuery = `
      SELECT
        u.uuid,
        u.full_name,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.profit), 0) as total_profit
      FROM transactions t
      JOIN users u ON t.employee_id = u.id
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY u.id
      ORDER BY transaction_count DESC
    `;

    const [employeeStats] = await pool.query(employeeQuery, [reportYear, reportMonth]);

    res.json({
      success: true,
      data: {
        year: parseInt(reportYear),
        month: parseInt(reportMonth),
        summary: {
          totalTransactions: monthlyTotals[0]?.total_transactions || 0,
          totalProfit: parseDecimal(monthlyTotals[0]?.total_profit || 0),
          totalCommission: parseDecimal(monthlyTotals[0]?.total_commission || 0),
          totalIn: parseDecimal(monthlyTotals[0]?.total_in || 0),
          totalOut: parseDecimal(monthlyTotals[0]?.total_out || 0)
        },
        dailyBreakdown: dailySummary.map(d => ({
          date: d.date,
          transactionCount: parseInt(d.transaction_count),
          profit: parseDecimal(d.daily_profit),
          commission: parseDecimal(d.daily_commission),
          totalIn: parseDecimal(d.total_in),
          totalOut: parseDecimal(d.total_out)
        })),
        currencyBreakdown: currencyBreakdown.map(c => ({
          currencyIn: c.currency_in,
          currencyOut: c.currency_out,
          transactionCount: parseInt(c.transaction_count),
          totalIn: parseDecimal(c.total_in),
          totalOut: parseDecimal(c.total_out),
          profit: parseDecimal(c.profit)
        })),
        employeeStats: employeeStats.map(e => ({
          uuid: e.uuid,
          fullName: e.full_name,
          transactionCount: parseInt(e.transaction_count),
          totalProfit: parseDecimal(e.total_profit)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard statistics
 * Excludes soft-deleted transactions
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Today's stats - exclude soft-deleted
    const [todayStats] = await pool.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(commission), 0) as total_commission
      FROM transactions
      WHERE DATE(transaction_date) = ?
        AND deleted_at IS NULL
        AND status = 'completed'
    `, [today]);

    // This month's stats - exclude soft-deleted
    const [monthStats] = await pool.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(commission), 0) as total_commission
      FROM transactions
      WHERE YEAR(transaction_date) = ? AND MONTH(transaction_date) = ?
        AND deleted_at IS NULL
        AND status = 'completed'
    `, [currentYear, currentMonth]);

    // Recent transactions - exclude soft-deleted
    const [recentTransactions] = await pool.query(`
      SELECT
        t.uuid,
        t.customer_name,
        t.amount_in,
        t.amount_out,
        t.profit,
        t.status,
        t.transaction_date,
        ci.code as currency_in_code,
        co.code as currency_out_code,
        u.full_name as employee_name
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.transaction_date DESC
      LIMIT 10
    `);

    // Active currencies count
    const [currencyCount] = await pool.query(
      'SELECT COUNT(*) as count FROM currencies WHERE is_active = TRUE'
    );

    // Active users count
    const [userCount] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE'
    );

    res.json({
      success: true,
      data: {
        today: {
          transactionCount: todayStats[0].transaction_count,
          totalProfit: parseDecimal(todayStats[0].total_profit),
          totalCommission: parseDecimal(todayStats[0].total_commission)
        },
        thisMonth: {
          transactionCount: monthStats[0].transaction_count,
          totalProfit: parseDecimal(monthStats[0].total_profit),
          totalCommission: parseDecimal(monthStats[0].total_commission)
        },
        activeCurrencies: currencyCount[0].count,
        activeUsers: userCount[0].count,
        recentTransactions: recentTransactions.map(t => ({
          uuid: t.uuid,
          customerName: t.customer_name,
          amountIn: parseDecimal(t.amount_in),
          amountOut: parseDecimal(t.amount_out),
          profit: parseDecimal(t.profit),
          status: t.status,
          currencyInCode: t.currency_in_code,
          currencyOutCode: t.currency_out_code,
          employeeName: t.employee_name,
          transactionDate: t.transaction_date
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard chart data
 * Returns data for daily trend (7 days), profit by currency, and transactions by currency pair
 */
const getDashboardCharts = async (req, res, next) => {
  try {
    // Get daily transaction volume and profit for the past 7 days
    const [dailyTrend] = await pool.query(`
      SELECT
        DATE(t.transaction_date) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      WHERE t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY DATE(t.transaction_date)
      ORDER BY date ASC
    `);

    // Fill in missing days with zero values
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const existingData = dailyTrend.find(d => {
        const dDate = new Date(d.date).toISOString().split('T')[0];
        return dDate === dateStr;
      });
      last7Days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        transactions: existingData ? parseInt(existingData.transactions) : 0,
        profit: existingData ? parseDecimal(existingData.profit) : 0
      });
    }

    // Get profit by currency (currency in) for the current month
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [profitByCurrency] = await pool.query(`
      SELECT
        ci.code as currency,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY ci.id, ci.code
      ORDER BY profit DESC
      LIMIT 10
    `, [currentYear, currentMonth]);

    // Get transactions distribution by currency pair (currency in -> currency out)
    const [transactionsByCurrencyPair] = await pool.query(`
      SELECT
        CONCAT(ci.code, '/', co.code) as pair,
        COUNT(*) as value
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY ci.id, co.id, ci.code, co.code
      ORDER BY value DESC
      LIMIT 8
    `, [currentYear, currentMonth]);

    res.json({
      success: true,
      data: {
        dailyTrend: last7Days,
        profitByCurrency: profitByCurrency.map(c => ({
          name: c.currency,
          profit: parseDecimal(c.profit)
        })),
        transactionsByCurrencyPair: transactionsByCurrencyPair.map(p => ({
          name: p.pair,
          value: parseInt(p.value)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate daily closing report (end-of-day summary)
 * Admin only - creates a permanent record of the day's transactions
 */
const generateDailyClosing = async (req, res, next) => {
  try {
    const { date } = req.body;
    const reportDate = date || new Date().toISOString().split('T')[0];
    const ipAddress = getClientIp(req);

    // Check if report already exists
    const [existing] = await pool.query(
      'SELECT uuid FROM daily_closing_reports WHERE report_date = ?',
      [reportDate]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Daily closing report already exists for this date.',
        data: { existingReportUuid: existing[0].uuid }
      });
    }

    // Calculate totals for the day - only completed, non-deleted transactions
    const [totals] = await pool.query(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount_in), 0) as total_amount_in,
        COALESCE(SUM(amount_out), 0) as total_amount_out,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(commission), 0) as total_commission
      FROM transactions
      WHERE DATE(transaction_date) = ?
        AND deleted_at IS NULL
        AND status = 'completed'
    `, [reportDate]);

    // Count cancelled transactions
    const [cancelled] = await pool.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE DATE(transaction_date) = ? AND status = 'cancelled' AND deleted_at IS NULL
    `, [reportDate]);

    // Get currency breakdown
    const [currencyBreakdown] = await pool.query(`
      SELECT
        ci.code as currency_in,
        co.code as currency_out,
        COUNT(*) as count,
        COALESCE(SUM(t.amount_in), 0) as total_in,
        COALESCE(SUM(t.amount_out), 0) as total_out,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      WHERE DATE(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY ci.code, co.code
    `, [reportDate]);

    // Get employee breakdown
    const [employeeBreakdown] = await pool.query(`
      SELECT
        u.uuid,
        u.full_name,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.profit), 0) as total_profit
      FROM transactions t
      JOIN users u ON t.employee_id = u.id
      WHERE DATE(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY u.id
    `, [reportDate]);

    const uuid = uuidv4();
    const reportData = {
      currencyBreakdown: currencyBreakdown.map(c => ({
        pair: `${c.currency_in}/${c.currency_out}`,
        count: c.count,
        totalIn: parseDecimal(c.total_in),
        totalOut: parseDecimal(c.total_out),
        profit: parseDecimal(c.profit)
      })),
      employeeBreakdown: employeeBreakdown.map(e => ({
        uuid: e.uuid,
        name: e.full_name,
        transactionCount: e.transaction_count,
        profit: parseDecimal(e.total_profit)
      }))
    };

    // Insert daily closing report
    await pool.query(`
      INSERT INTO daily_closing_reports
        (uuid, report_date, total_transactions, cancelled_transactions,
         total_amount_in, total_amount_out, total_profit, total_commission,
         report_data, generated_by, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalized')
    `, [
      uuid,
      reportDate,
      totals[0].transaction_count,
      cancelled[0].count,
      parseDecimal(totals[0].total_amount_in),
      parseDecimal(totals[0].total_amount_out),
      parseDecimal(totals[0].total_profit),
      parseDecimal(totals[0].total_commission),
      JSON.stringify(reportData),
      req.user.id
    ]);

    // Log audit
    await logAudit(
      req.user.id,
      'DAILY_CLOSING',
      'daily_closing_reports',
      uuid,
      null,
      {
        reportDate,
        transactionCount: totals[0].transaction_count,
        totalProfit: parseDecimal(totals[0].total_profit)
      },
      ipAddress,
      'info'
    );

    res.status(201).json({
      success: true,
      message: 'Daily closing report generated successfully.',
      data: {
        uuid,
        reportDate,
        totalTransactions: totals[0].transaction_count,
        cancelledTransactions: cancelled[0].count,
        totalAmountIn: parseDecimal(totals[0].total_amount_in),
        totalAmountOut: parseDecimal(totals[0].total_amount_out),
        totalProfit: parseDecimal(totals[0].total_profit),
        totalCommission: parseDecimal(totals[0].total_commission),
        currencyBreakdown: reportData.currencyBreakdown,
        employeeBreakdown: reportData.employeeBreakdown,
        generatedBy: req.user.full_name,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get daily closing report by date or ID
 */
const getDailyClosing = async (req, res, next) => {
  try {
    const { date, id } = req.query;

    if (!date && !id) {
      return res.status(400).json({
        success: false,
        message: 'Either date or id is required.'
      });
    }

    let query = `
      SELECT
        r.*,
        u.full_name as generated_by_name
      FROM daily_closing_reports r
      JOIN users u ON r.generated_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (id) {
      query += ' AND r.id = ?';
      params.push(id);
    } else {
      query += ' AND r.report_date = ?';
      params.push(date);
    }

    const [reports] = await pool.query(query, params);

    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Daily closing report not found.'
      });
    }

    const r = reports[0];

    res.json({
      success: true,
      data: {
        id: r.id,
        reportDate: r.report_date,
        totalTransactions: r.total_transactions,
        cancelledTransactions: r.cancelled_transactions,
        totalAmountIn: parseDecimal(r.total_amount_in),
        totalAmountOut: parseDecimal(r.total_amount_out),
        totalProfit: parseDecimal(r.total_profit),
        totalCommission: parseDecimal(r.total_commission),
        reportData: JSON.parse(r.report_data || '{}'),
        status: r.status,
        generatedBy: r.generated_by_name,
        generatedAt: r.created_at,
        notes: r.notes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all daily closing reports with pagination
 */
const listDailyClosings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, year, month } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT
        r.id,
        r.report_date,
        r.total_transactions,
        r.cancelled_transactions,
        r.total_profit,
        r.total_commission,
        r.status,
        r.created_at,
        u.full_name as generated_by_name
      FROM daily_closing_reports r
      JOIN users u ON r.generated_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (year) {
      query += ' AND YEAR(r.report_date) = ?';
      params.push(parseInt(year));
    }
    if (month) {
      query += ' AND MONTH(r.report_date) = ?';
      params.push(parseInt(month));
    }

    // Count query
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY r.report_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [reports] = await pool.query(query, params);

    res.json({
      success: true,
      data: reports.map(r => ({
        id: r.id,
        reportDate: r.report_date,
        totalTransactions: r.total_transactions,
        cancelledTransactions: r.cancelled_transactions,
        totalProfit: parseDecimal(r.total_profit),
        totalCommission: parseDecimal(r.total_commission),
        status: r.status,
        generatedBy: r.generated_by_name,
        generatedAt: r.created_at
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
 * Export daily report in various formats
 */
const exportDailyReport = async (req, res, next) => {
  try {
    const { date, format = 'xlsx' } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    // Get transactions for the day
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
    `, [reportDate]);

    const exportData = exportService.formatTransactionsForExport(transactions);

    if (format === 'csv') {
      const csv = exportService.generateCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=daily-report-${reportDate}.csv`);
      return res.send(csv);
    } else if (format === 'pdf') {
      const pdf = await exportService.generatePDF(exportData, {
        title: `Daily Report - ${reportDate}`,
        subtitle: `Generated on ${new Date().toLocaleString()}`,
        columns: ['Date', 'Customer', 'From Currency', 'To Currency', 'Amount In', 'Amount Out', 'Profit']
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=daily-report-${reportDate}.pdf`);
      return res.send(pdf);
    } else {
      const excel = exportService.generateExcel(exportData, 'Daily Transactions');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=daily-report-${reportDate}.xlsx`);
      return res.send(excel);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Export monthly report in various formats
 */
const exportMonthlyReport = async (req, res, next) => {
  try {
    const { year, month, format = 'xlsx' } = req.query;
    const reportYear = year || new Date().getFullYear();
    const reportMonth = month || (new Date().getMonth() + 1);

    // Get daily breakdown
    const [dailyBreakdown] = await pool.query(`
      SELECT
        DATE(t.transaction_date) as date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.profit), 0) as profit,
        COALESCE(SUM(t.amount_in), 0) as volume
      FROM transactions t
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY DATE(t.transaction_date)
      ORDER BY date
    `, [reportYear, reportMonth]);

    // Get currency breakdown
    const [currencyBreakdown] = await pool.query(`
      SELECT
        ci.code as currency_code,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.amount_in), 0) as total_in,
        COALESCE(SUM(t.amount_out), 0) as total_out,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY ci.code
    `, [reportYear, reportMonth]);

    // Get employee breakdown
    const [employeeBreakdown] = await pool.query(`
      SELECT
        u.full_name as employee_name,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      JOIN users u ON t.employee_id = u.id
      WHERE YEAR(t.transaction_date) = ? AND MONTH(t.transaction_date) = ?
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY u.id
    `, [reportYear, reportMonth]);

    const reportData = {
      date: dailyBreakdown.map(d => ({
        Date: d.date,
        Transactions: d.transaction_count,
        Volume: parseDecimal(d.volume),
        Profit: parseDecimal(d.profit)
      })),
      totalTransactions: dailyBreakdown.reduce((sum, d) => sum + parseInt(d.transaction_count), 0),
      totalProfit: dailyBreakdown.reduce((sum, d) => sum + parseFloat(d.profit), 0),
      totalVolume: dailyBreakdown.reduce((sum, d) => sum + parseFloat(d.volume), 0),
      year: reportYear,
      month: reportMonth,
      dailyBreakdown: dailyBreakdown.map(d => ({
        date: d.date,
        transaction_count: d.transaction_count,
        volume: parseDecimal(d.volume),
        profit: parseDecimal(d.profit)
      })),
      currencyBreakdown: currencyBreakdown.map(c => ({
        currency_code: c.currency_code,
        transaction_count: c.transaction_count,
        total_in: parseDecimal(c.total_in),
        total_out: parseDecimal(c.total_out),
        profit: parseDecimal(c.profit)
      })),
      employeeBreakdown: employeeBreakdown.map(e => ({
        employee_name: e.employee_name,
        transaction_count: e.transaction_count,
        profit: parseDecimal(e.profit)
      }))
    };

    const exportData = exportService.formatMonthlyReportForExport(reportData);
    const filename = `monthly-report-${reportYear}-${String(reportMonth).padStart(2, '0')}`;

    if (format === 'csv') {
      const csv = exportService.generateCSV(exportData['Daily Breakdown']);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.send(csv);
    } else if (format === 'pdf') {
      const pdf = await exportService.generatePDF(exportData['Daily Breakdown'], {
        title: `Monthly Report - ${reportYear}/${reportMonth}`,
        summary: {
          'Total Transactions': reportData.totalTransactions,
          'Total Profit': reportData.totalProfit.toFixed(2),
          'Total Volume': reportData.totalVolume.toFixed(2)
        }
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
      return res.send(pdf);
    } else {
      const excel = exportService.generateExcel(exportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
      return res.send(excel);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get profit/loss report
 */
const getProfitLossReport = async (req, res, next) => {
  try {
    const { startDate, endDate, employeeId, currencyId } = req.query;

    // Default to current month
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    let baseQuery = `
      SELECT
        DATE(t.transaction_date) as date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.profit), 0) as profit,
        COALESCE(SUM(t.commission), 0) as commission,
        COALESCE(SUM(t.amount_in), 0) as revenue
      FROM transactions t
      WHERE t.transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;
    const params = [start, end];

    if (employeeId) {
      baseQuery += ' AND t.employee_id = (SELECT id FROM users WHERE uuid = ?)';
      params.push(employeeId);
    }

    if (currencyId) {
      baseQuery += ' AND t.currency_in_id = (SELECT id FROM currencies WHERE uuid = ?)';
      params.push(currencyId);
    }

    baseQuery += ' GROUP BY DATE(t.transaction_date) ORDER BY date';

    const [dailyData] = await pool.query(baseQuery, params);

    // Get currency breakdown
    let currencyQuery = `
      SELECT
        ci.code as currency_code,
        ci.id as currency_id,
        COUNT(CASE WHEN t.amount_in > t.amount_out THEN 1 END) as buy_count,
        COUNT(CASE WHEN t.amount_out > t.amount_in THEN 1 END) as sell_count,
        COALESCE(SUM(t.profit), 0) as total_profit
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      WHERE t.transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;
    const currencyParams = [start, end];

    if (employeeId) {
      currencyQuery += ' AND t.employee_id = (SELECT id FROM users WHERE uuid = ?)';
      currencyParams.push(employeeId);
    }

    currencyQuery += ' GROUP BY ci.id ORDER BY total_profit DESC';

    const [currencyData] = await pool.query(currencyQuery, currencyParams);

    // Get employee breakdown
    let employeeQuery = `
      SELECT
        u.uuid,
        u.full_name,
        COUNT(*) as transaction_count,
        COALESCE(SUM(t.profit), 0) as total_profit,
        COALESCE(SUM(t.commission), 0) as total_commission
      FROM transactions t
      JOIN users u ON t.employee_id = u.id
      WHERE t.transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY u.id
      ORDER BY total_profit DESC
    `;

    const [employeeData] = await pool.query(employeeQuery, [start, end]);

    // Calculate totals
    const totalRevenue = dailyData.reduce((sum, d) => sum + parseFloat(d.revenue), 0);
    const totalProfit = dailyData.reduce((sum, d) => sum + parseFloat(d.profit), 0);
    const totalCommission = dailyData.reduce((sum, d) => sum + parseFloat(d.commission), 0);
    const totalTransactions = dailyData.reduce((sum, d) => sum + parseInt(d.transaction_count), 0);

    res.json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        summary: {
          totalTransactions,
          totalRevenue: parseDecimal(totalRevenue),
          totalProfit: parseDecimal(totalProfit),
          totalCommission: parseDecimal(totalCommission),
          netProfit: parseDecimal(totalProfit + totalCommission),
          profitMargin: totalRevenue > 0 ? parseDecimal((totalProfit / totalRevenue) * 100) : 0
        },
        dailyProfitLoss: dailyData.map(d => ({
          date: d.date,
          transactions: parseInt(d.transaction_count),
          revenue: parseDecimal(d.revenue),
          profit: parseDecimal(d.profit),
          commission: parseDecimal(d.commission)
        })),
        currencyBreakdown: currencyData.map(c => ({
          currencyCode: c.currency_code,
          currencyUuid: c.currency_uuid,
          buyCount: parseInt(c.buy_count),
          sellCount: parseInt(c.sell_count),
          totalProfit: parseDecimal(c.total_profit)
        })),
        employeeBreakdown: employeeData.map(e => ({
          uuid: e.uuid,
          fullName: e.full_name,
          transactions: parseInt(e.transaction_count),
          profit: parseDecimal(e.total_profit),
          commission: parseDecimal(e.total_commission)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export profit/loss report
 */
const exportProfitLossReport = async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'xlsx' } = req.query;

    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const [dailyData] = await pool.query(`
      SELECT
        DATE(t.transaction_date) as date,
        COUNT(*) as transactions,
        COALESCE(SUM(t.profit), 0) as profit,
        COALESCE(SUM(t.commission), 0) as commission,
        COALESCE(SUM(t.amount_in), 0) as revenue
      FROM transactions t
      WHERE t.transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY DATE(t.transaction_date)
      ORDER BY date
    `, [start, end]);

    const [currencyData] = await pool.query(`
      SELECT
        ci.code as currency,
        COUNT(*) as transactions,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      WHERE t.transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
      GROUP BY ci.id
    `, [start, end]);

    const exportData = {
      'Daily P&L': dailyData.map(d => ({
        Date: d.date,
        Transactions: d.transactions,
        Revenue: parseDecimal(d.revenue),
        Profit: parseDecimal(d.profit),
        Commission: parseDecimal(d.commission)
      })),
      'By Currency': currencyData.map(c => ({
        Currency: c.currency,
        Transactions: c.transactions,
        Profit: parseDecimal(c.profit)
      }))
    };

    const filename = `profit-loss-${start}-to-${end}`;

    if (format === 'csv') {
      const csv = exportService.generateCSV(exportData['Daily P&L']);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.send(csv);
    } else if (format === 'pdf') {
      const pdf = await exportService.generatePDF(exportData['Daily P&L'], {
        title: `Profit & Loss Report`,
        subtitle: `${start} to ${end}`
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
      return res.send(pdf);
    } else {
      const excel = exportService.generateExcel(exportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
      return res.send(excel);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Export transactions
 */
const exportTransactions = async (req, res, next) => {
  try {
    const { startDate, endDate, status, currencyId, format = 'xlsx' } = req.query;

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
        t.notes,
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

    if (startDate) {
      query += ' AND t.transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND t.transaction_date <= DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(endDate);
    }
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (currencyId) {
      query += ' AND (t.currency_in_id = (SELECT id FROM currencies WHERE uuid = ?) OR t.currency_out_id = (SELECT id FROM currencies WHERE uuid = ?))';
      params.push(currencyId, currencyId);
    }

    query += ' ORDER BY t.transaction_date DESC LIMIT 10000';

    const [transactions] = await pool.query(query, params);
    const exportData = exportService.formatTransactionsForExport(transactions);

    const filename = `transactions-export-${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      const csv = exportService.generateCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.send(csv);
    } else if (format === 'pdf') {
      const pdf = await exportService.generatePDF(exportData, {
        title: 'Transaction Export',
        columns: ['Date', 'Customer', 'From Currency', 'To Currency', 'Amount In', 'Amount Out', 'Profit']
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
      return res.send(pdf);
    } else {
      const excel = exportService.generateExcel(exportData, 'Transactions');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
      return res.send(excel);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Custom report builder
 */
const generateCustomReport = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy, metrics, filters } = req.body;

    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    // Build SELECT clause based on requested metrics
    const availableMetrics = {
      transaction_count: 'COUNT(*) as transaction_count',
      total_profit: 'COALESCE(SUM(t.profit), 0) as total_profit',
      total_commission: 'COALESCE(SUM(t.commission), 0) as total_commission',
      total_amount_in: 'COALESCE(SUM(t.amount_in), 0) as total_amount_in',
      total_amount_out: 'COALESCE(SUM(t.amount_out), 0) as total_amount_out',
      avg_profit: 'COALESCE(AVG(t.profit), 0) as avg_profit',
      avg_exchange_rate: 'COALESCE(AVG(t.exchange_rate), 0) as avg_exchange_rate'
    };

    const selectedMetrics = (metrics || ['transaction_count', 'total_profit'])
      .filter(m => availableMetrics[m])
      .map(m => availableMetrics[m]);

    if (selectedMetrics.length === 0) {
      selectedMetrics.push(availableMetrics.transaction_count);
    }

    // Build GROUP BY clause
    const availableGroupings = {
      day: 'DATE(t.transaction_date)',
      week: 'YEARWEEK(t.transaction_date)',
      month: 'DATE_FORMAT(t.transaction_date, "%Y-%m")',
      employee: 'u.full_name',
      currency_in: 'ci.code',
      currency_out: 'co.code'
    };

    const groupByField = availableGroupings[groupBy] || availableGroupings.day;
    const groupByAlias = groupBy || 'day';

    let query = `
      SELECT
        ${groupByField} as ${groupByAlias},
        ${selectedMetrics.join(', ')}
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      WHERE t.transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;
    const params = [start, end];

    // Apply filters
    if (filters) {
      if (filters.employeeId) {
        query += ' AND u.uuid = ?';
        params.push(filters.employeeId);
      }
      if (filters.currencyId) {
        query += ' AND ci.id = ?';
        params.push(filters.currencyId);
      }
      if (filters.minAmount) {
        query += ' AND t.amount_in >= ?';
        params.push(filters.minAmount);
      }
      if (filters.maxAmount) {
        query += ' AND t.amount_in <= ?';
        params.push(filters.maxAmount);
      }
    }

    query += ` GROUP BY ${groupByField} ORDER BY ${groupByField}`;

    const [results] = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        startDate: start,
        endDate: end,
        groupBy: groupByAlias,
        metrics: metrics || ['transaction_count', 'total_profit'],
        results: results.map(r => {
          const row = { [groupByAlias]: r[groupByAlias] };
          Object.keys(r).forEach(key => {
            if (key !== groupByAlias) {
              row[key] = typeof r[key] === 'number' ? parseDecimal(r[key]) : r[key];
            }
          });
          return row;
        })
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export custom report
 */
const exportCustomReport = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy, metrics, filters, format = 'xlsx' } = req.body;

    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    // Build SELECT clause based on requested metrics
    const availableMetrics = {
      transaction_count: 'COUNT(*) as transaction_count',
      total_profit: 'COALESCE(SUM(t.profit), 0) as total_profit',
      total_commission: 'COALESCE(SUM(t.commission), 0) as total_commission',
      total_amount_in: 'COALESCE(SUM(t.amount_in), 0) as total_amount_in',
      total_amount_out: 'COALESCE(SUM(t.amount_out), 0) as total_amount_out',
      avg_profit: 'COALESCE(AVG(t.profit), 0) as avg_profit',
      avg_exchange_rate: 'COALESCE(AVG(t.exchange_rate), 0) as avg_exchange_rate'
    };

    const selectedMetrics = (metrics || ['transaction_count', 'total_profit'])
      .filter(m => availableMetrics[m])
      .map(m => availableMetrics[m]);

    if (selectedMetrics.length === 0) {
      selectedMetrics.push(availableMetrics.transaction_count);
    }

    // Build GROUP BY clause
    const availableGroupings = {
      day: 'DATE(t.transaction_date)',
      week: 'YEARWEEK(t.transaction_date)',
      month: 'DATE_FORMAT(t.transaction_date, "%Y-%m")',
      employee: 'u.full_name',
      currency_in: 'ci.code',
      currency_out: 'co.code'
    };

    const groupByField = availableGroupings[groupBy] || availableGroupings.day;
    const groupByAlias = groupBy || 'day';

    let query = `
      SELECT
        ${groupByField} as ${groupByAlias},
        ${selectedMetrics.join(', ')}
      FROM transactions t
      JOIN currencies ci ON t.currency_in_id = ci.id
      JOIN currencies co ON t.currency_out_id = co.id
      JOIN users u ON t.employee_id = u.id
      WHERE t.transaction_date BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
    `;
    const params = [start, end];

    // Apply filters
    if (filters) {
      if (filters.employeeId) {
        query += ' AND u.uuid = ?';
        params.push(filters.employeeId);
      }
      if (filters.currencyId) {
        query += ' AND ci.id = ?';
        params.push(filters.currencyId);
      }
      if (filters.minAmount) {
        query += ' AND t.amount_in >= ?';
        params.push(filters.minAmount);
      }
      if (filters.maxAmount) {
        query += ' AND t.amount_in <= ?';
        params.push(filters.maxAmount);
      }
    }

    query += ` GROUP BY ${groupByField} ORDER BY ${groupByField}`;

    const [results] = await pool.query(query, params);

    // Format data for export
    const formattedData = results.map(r => {
      const row = { [groupByAlias]: r[groupByAlias] };
      Object.keys(r).forEach(key => {
        if (key !== groupByAlias) {
          row[key] = typeof r[key] === 'number' ? parseDecimal(r[key]) : r[key];
        }
      });
      return row;
    });

    const filename = `custom-report-${start}-to-${end}`;

    if (format === 'csv') {
      const csv = exportService.generateCSV(formattedData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      return res.send(csv);
    } else if (format === 'pdf') {
      const pdf = await exportService.generatePDF(formattedData, {
        title: 'Custom Report',
        subtitle: `${start} to ${end}`
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);
      return res.send(pdf);
    } else {
      const excel = exportService.generateExcel(formattedData, 'Custom Report');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
      return res.send(excel);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get employee leaderboard (Top Profit & Top Transactions)
 */
const getLeaderboard = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    let dateCondition = '';
    const params = [];

    if (period === 'month') {
      dateCondition = 'AND YEAR(t.transaction_date) = YEAR(CURDATE()) AND MONTH(t.transaction_date) = MONTH(CURDATE())';
    } else if (period === 'today') {
      dateCondition = 'AND DATE(t.transaction_date) = CURDATE()';
    } else if (period === 'year') {
      dateCondition = 'AND YEAR(t.transaction_date) = YEAR(CURDATE())';
    }

    // Top Profit
    const [topProfit] = await pool.query(`
      SELECT
        u.full_name,
        COALESCE(SUM(t.profit), 0) as value,
        COUNT(*) as count
      FROM transactions t
      JOIN users u ON t.employee_id = u.id
      WHERE t.deleted_at IS NULL
        AND t.status = 'completed'
        ${dateCondition}
      GROUP BY u.id
      ORDER BY value DESC
      LIMIT 5
    `, params);

    // Most Active (Transaction Count)
    const [mostActive] = await pool.query(`
      SELECT
        u.full_name,
        COUNT(*) as value,
        COALESCE(SUM(t.profit), 0) as profit
      FROM transactions t
      JOIN users u ON t.employee_id = u.id
      WHERE t.deleted_at IS NULL
        AND t.status = 'completed'
        ${dateCondition}
      GROUP BY u.id
      ORDER BY value DESC
      LIMIT 5
    `, params);

    res.json({
      success: true,
      data: {
        period,
        topProfit: topProfit.map(e => ({
          name: e.full_name,
          value: parseDecimal(e.value),
          subValue: parseInt(e.count) + ' txns'
        })),
        mostActive: mostActive.map(e => ({
          name: e.full_name,
          value: parseInt(e.value),
          subValue: '$' + parseDecimal(e.profit)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDailyReport,
  getMonthlyReport,
  getDashboardStats,
  getDashboardCharts,
  generateDailyClosing,
  getDailyClosing,
  listDailyClosings,
  exportDailyReport,
  exportMonthlyReport,
  getProfitLossReport,
  exportProfitLossReport,
  exportTransactions,
  generateCustomReport,
  getLeaderboard,
  exportCustomReport,
};
