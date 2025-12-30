/**
 * Scheduled Report Routes
 * Routes for managing scheduled report configurations
 */
const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();
const scheduledReportController = require('../controllers/scheduledReportController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /scheduled-reports:
 *   post:
 *     summary: Create a new scheduled report (admin only)
 *     tags: [Scheduled Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - reportType
 *               - scheduleType
 *               - scheduleTime
 *               - recipients
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 description: Name of the scheduled report
 *               reportType:
 *                 type: string
 *                 enum: [daily, monthly, profit_loss, transactions]
 *                 description: Type of report to generate
 *               scheduleType:
 *                 type: string
 *                 enum: [daily, weekly]
 *                 description: Schedule frequency
 *               scheduleDay:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 description: Day of week for weekly schedules (0=Sunday, 6=Saturday)
 *               scheduleTime:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
 *                 description: Time to run the report (HH:MM or HH:MM:SS)
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: List of email addresses to receive the report
 *               exportFormat:
 *                 type: string
 *                 enum: [xlsx, csv, pdf]
 *                 default: xlsx
 *                 description: Format for the exported report
 *               filters:
 *                 type: object
 *                 description: Optional filters for the report
 *     responses:
 *       201:
 *         description: Scheduled report created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/',
  authorize('admin'),
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('reportType')
      .notEmpty()
      .withMessage('Report type is required')
      .isIn(['daily', 'monthly', 'profit_loss', 'transactions'])
      .withMessage('Report type must be one of: daily, monthly, profit_loss, transactions'),
    body('scheduleType')
      .notEmpty()
      .withMessage('Schedule type is required')
      .isIn(['daily', 'weekly'])
      .withMessage('Schedule type must be either daily or weekly'),
    body('scheduleDay')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Schedule day must be between 0 (Sunday) and 6 (Saturday)'),
    body('scheduleTime')
      .notEmpty()
      .withMessage('Schedule time is required')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
      .withMessage('Schedule time must be in HH:MM or HH:MM:SS format'),
    body('recipients')
      .isArray({ min: 1 })
      .withMessage('Recipients must be a non-empty array'),
    body('recipients.*')
      .isEmail()
      .withMessage('Each recipient must be a valid email address'),
    body('exportFormat')
      .optional()
      .isIn(['xlsx', 'csv', 'pdf'])
      .withMessage('Export format must be xlsx, csv, or pdf'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object')
  ],
  validate,
  scheduledReportController.createSchedule
);

/**
 * @swagger
 * /scheduled-reports:
 *   get:
 *     summary: List all scheduled reports
 *     tags: [Scheduled Reports]
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
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of scheduled reports with pagination
 */
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  validate,
  scheduledReportController.listSchedules
);

/**
 * @swagger
 * /scheduled-reports/{uuid}:
 *   get:
 *     summary: Get a scheduled report by UUID
 *     tags: [Scheduled Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scheduled report details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:uuid',
  [
    param('uuid')
      .isUUID()
      .withMessage('Invalid schedule UUID')
  ],
  validate,
  scheduledReportController.getSchedule
);

/**
 * @swagger
 * /scheduled-reports/{uuid}:
 *   put:
 *     summary: Update a scheduled report (admin only)
 *     tags: [Scheduled Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               reportType:
 *                 type: string
 *                 enum: [daily, monthly, profit_loss, transactions]
 *               scheduleType:
 *                 type: string
 *                 enum: [daily, weekly]
 *               scheduleDay:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *               scheduleTime:
 *                 type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *               exportFormat:
 *                 type: string
 *                 enum: [xlsx, csv, pdf]
 *               filters:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Scheduled report updated successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:uuid',
  authorize('admin'),
  [
    param('uuid')
      .isUUID()
      .withMessage('Invalid schedule UUID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('reportType')
      .optional()
      .isIn(['daily', 'monthly', 'profit_loss', 'transactions'])
      .withMessage('Invalid report type'),
    body('scheduleType')
      .optional()
      .isIn(['daily', 'weekly'])
      .withMessage('Schedule type must be daily or weekly'),
    body('scheduleDay')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage('Schedule day must be between 0 and 6'),
    body('scheduleTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
      .withMessage('Invalid time format'),
    body('recipients')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Recipients must be a non-empty array'),
    body('recipients.*')
      .optional()
      .isEmail()
      .withMessage('Each recipient must be a valid email'),
    body('exportFormat')
      .optional()
      .isIn(['xlsx', 'csv', 'pdf'])
      .withMessage('Invalid export format'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  validate,
  scheduledReportController.updateSchedule
);

/**
 * @swagger
 * /scheduled-reports/{uuid}:
 *   delete:
 *     summary: Delete a scheduled report (admin only)
 *     tags: [Scheduled Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Scheduled report deleted successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:uuid',
  authorize('admin'),
  [
    param('uuid')
      .isUUID()
      .withMessage('Invalid schedule UUID')
  ],
  validate,
  scheduledReportController.deleteSchedule
);

/**
 * @swagger
 * /scheduled-reports/{uuid}/run:
 *   post:
 *     summary: Manually trigger a scheduled report
 *     tags: [Scheduled Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report executed successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Report execution failed
 */
router.post(
  '/:uuid/run',
  [
    param('uuid')
      .isUUID()
      .withMessage('Invalid schedule UUID')
  ],
  validate,
  scheduledReportController.runNow
);

/**
 * @swagger
 * /scheduled-reports/{uuid}/history:
 *   get:
 *     summary: Get execution history for a scheduled report
 *     tags: [Scheduled Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *     responses:
 *       200:
 *         description: Execution history
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:uuid/history',
  [
    param('uuid')
      .isUUID()
      .withMessage('Invalid schedule UUID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  validate,
  scheduledReportController.getScheduleHistory
);

module.exports = router;
