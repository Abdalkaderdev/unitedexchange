/**
 * Report Routes
 * Production-ready with daily closing reports, exports, and role-based access control
 */
const express = require('express');
const { query, body } = require('express-validator');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /reports/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     todayTransactions:
 *                       type: integer
 *                     todayVolume:
 *                       type: number
 *                     monthlyTransactions:
 *                       type: integer
 *                     monthlyVolume:
 *                       type: number
 */
router.get('/dashboard', reportController.getDashboardStats);

/**
 * @swagger
 * /reports/dashboard/charts:
 *   get:
 *     summary: Get dashboard chart data
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard chart data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     dailyTrend:
 *                       type: array
 *                       description: Daily transaction volume and profit for past 7 days
 *                     profitByCurrency:
 *                       type: array
 *                       description: Profit breakdown by currency
 *                     transactionsByCurrencyPair:
 *                       type: array
 *                       description: Transaction distribution by currency pair
 */
router.get('/dashboard/charts', reportController.getDashboardCharts);

/**
 * @swagger
 * /reports/leaderboard:
 *   get:
 *     summary: Get employee leaderboard
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, month, year, all]
 *           default: month
 *     responses:
 *       200:
 *         description: Leaderboard data
 */
router.get('/leaderboard', reportController.getLeaderboard);

/**
 * @swagger
 * /reports/daily:
 *   get:
 *     summary: Get daily report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Report date (defaults to today)
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by employee
 *     responses:
 *       200:
 *         description: Daily report data
 */
router.get(
  '/daily',
  [
    query('date').optional().isDate().withMessage('Invalid date format (YYYY-MM-DD)'),
    query('employeeId').optional().isUUID().withMessage('Invalid employee ID')
  ],
  validate,
  reportController.getDailyReport
);

/**
 * @swagger
 * /reports/monthly:
 *   get:
 *     summary: Get monthly report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2100
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Monthly report data
 */
router.get(
  '/monthly',
  [
    query('year')
      .optional()
      .isInt({ min: 2020, max: 2100 })
      .withMessage('Year must be between 2020 and 2100'),
    query('month')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Month must be between 1 and 12'),
    query('employeeId').optional().isUUID().withMessage('Invalid employee ID')
  ],
  validate,
  reportController.getMonthlyReport
);

/**
 * @swagger
 * /reports/closing:
 *   post:
 *     summary: Generate daily closing report (admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date for closing report (defaults to today)
 *     responses:
 *       201:
 *         description: Closing report generated
 *       400:
 *         description: Report already exists for date
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/closing',
  authorize('admin'),
  [
    body('date').optional().isDate().withMessage('Invalid date format (YYYY-MM-DD)')
  ],
  validate,
  reportController.generateDailyClosing
);

/**
 * @swagger
 * /reports/closing:
 *   get:
 *     summary: Get daily closing report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: uuid
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Daily closing report
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/closing',
  [
    query('date').optional().isDate().withMessage('Invalid date format (YYYY-MM-DD)'),
    query('uuid').optional().isUUID().withMessage('Invalid UUID')
  ],
  validate,
  reportController.getDailyClosing
);

/**
 * @swagger
 * /reports/closings:
 *   get:
 *     summary: List all daily closing reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of closing reports with pagination
 */
router.get(
  '/closings',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month')
  ],
  validate,
  reportController.listDailyClosings
);

/**
 * @swagger
 * /reports/daily/export:
 *   get:
 *     summary: Export daily report in Excel, CSV, or PDF format
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx, csv, pdf]
 *           default: xlsx
 *     responses:
 *       200:
 *         description: File download
 */
router.get(
  '/daily/export',
  [
    query('date').optional().isDate().withMessage('Invalid date format (YYYY-MM-DD)'),
    query('format').optional().isIn(['xlsx', 'csv', 'pdf']).withMessage('Format must be xlsx, csv, or pdf')
  ],
  validate,
  reportController.exportDailyReport
);

/**
 * @swagger
 * /reports/monthly/export:
 *   get:
 *     summary: Export monthly report in Excel, CSV, or PDF format
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx, csv, pdf]
 *           default: xlsx
 *     responses:
 *       200:
 *         description: File download
 */
router.get(
  '/monthly/export',
  [
    query('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Invalid year'),
    query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
    query('format').optional().isIn(['xlsx', 'csv', 'pdf']).withMessage('Format must be xlsx, csv, or pdf')
  ],
  validate,
  reportController.exportMonthlyReport
);

/**
 * @swagger
 * /reports/profit-loss:
 *   get:
 *     summary: Get profit/loss report with breakdowns
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: employeeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: currencyId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Profit/loss report data
 */
router.get(
  '/profit-loss',
  [
    query('startDate').optional().isDate().withMessage('Invalid start date'),
    query('endDate').optional().isDate().withMessage('Invalid end date'),
    query('employeeId').optional().isUUID().withMessage('Invalid employee ID'),
    query('currencyId').optional().isUUID().withMessage('Invalid currency ID')
  ],
  validate,
  reportController.getProfitLossReport
);

/**
 * @swagger
 * /reports/profit-loss/export:
 *   get:
 *     summary: Export profit/loss report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx, csv, pdf]
 *     responses:
 *       200:
 *         description: File download
 */
router.get(
  '/profit-loss/export',
  [
    query('startDate').optional().isDate().withMessage('Invalid start date'),
    query('endDate').optional().isDate().withMessage('Invalid end date'),
    query('format').optional().isIn(['xlsx', 'csv', 'pdf']).withMessage('Invalid format')
  ],
  validate,
  reportController.exportProfitLossReport
);

/**
 * @swagger
 * /reports/transactions/export:
 *   get:
 *     summary: Export transactions
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [completed, cancelled]
 *       - in: query
 *         name: currencyId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx, csv, pdf]
 *     responses:
 *       200:
 *         description: File download
 */
router.get(
  '/transactions/export',
  [
    query('startDate').optional().isDate().withMessage('Invalid start date'),
    query('endDate').optional().isDate().withMessage('Invalid end date'),
    query('status').optional().isIn(['completed', 'cancelled']).withMessage('Invalid status'),
    query('currencyId').optional().isUUID().withMessage('Invalid currency ID'),
    query('format').optional().isIn(['xlsx', 'csv', 'pdf']).withMessage('Invalid format')
  ],
  validate,
  reportController.exportTransactions
);

/**
 * @swagger
 * /reports/custom:
 *   post:
 *     summary: Generate custom report with flexible grouping and metrics
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               groupBy:
 *                 type: string
 *                 enum: [day, week, month, employee, currency_in, currency_out]
 *               metrics:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [transaction_count, total_profit, total_commission, total_amount_in, total_amount_out, avg_profit, avg_exchange_rate]
 *               filters:
 *                 type: object
 *                 properties:
 *                   employeeId:
 *                     type: string
 *                   currencyId:
 *                     type: string
 *                   minAmount:
 *                     type: number
 *                   maxAmount:
 *                     type: number
 *     responses:
 *       200:
 *         description: Custom report data
 */
router.post(
  '/custom',
  [
    body('startDate').optional().isDate().withMessage('Invalid start date'),
    body('endDate').optional().isDate().withMessage('Invalid end date'),
    body('groupBy').optional().isIn(['day', 'week', 'month', 'employee', 'currency_in', 'currency_out']).withMessage('Invalid groupBy'),
    body('metrics').optional().isArray().withMessage('Metrics must be an array'),
    body('filters').optional().isObject().withMessage('Filters must be an object')
  ],
  validate,
  reportController.generateCustomReport
);

/**
 * @swagger
 * /reports/custom/export:
 *   post:
 *     summary: Export custom report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [xlsx, csv, pdf]
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: File download
 */
router.post(
  '/custom/export',
  [
    body('format').optional().isIn(['xlsx', 'csv', 'pdf']).withMessage('Invalid format'),
    body('startDate').optional().isDate(),
    body('endDate').optional().isDate()
  ],
  validate,
  reportController.exportCustomReport
);

module.exports = router;
