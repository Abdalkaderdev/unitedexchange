/**
 * Audit Log Routes
 * Admin/Manager access only
 */
const express = require('express');
const { query, param } = require('express-validator');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication and admin/manager role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: Get audit logs with filters
 *     tags: [Audit]
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
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [info, warning, error, critical]
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of audit logs with pagination
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('action').optional().isString(),
    query('resourceType').optional().isString(),
    query('userId').optional().isUUID(),
    query('severity').optional().isIn(['info', 'warning', 'error', 'critical']),
    query('startDate').optional().isDate(),
    query('endDate').optional().isDate(),
    query('search').optional().isString()
  ],
  validate,
  auditController.getAuditLogs
);

/**
 * @swagger
 * /audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/stats',
  [
    query('days').optional().isInt({ min: 1, max: 90 }).withMessage('Days must be 1-90')
  ],
  validate,
  auditController.getAuditStats
);

/**
 * @swagger
 * /audit-logs/resource/{type}/{id}:
 *   get:
 *     summary: Get audit history for a specific resource
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/resource/:type/:id',
  [
    param('type').isString().withMessage('Resource type required'),
    param('id').isInt({ min: 1 }).withMessage('Resource ID required'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  auditController.getResourceHistory
);

/**
 * @swagger
 * /audit-logs/{id}:
 *   get:
 *     summary: Get single audit log entry
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Valid ID required')
  ],
  validate,
  auditController.getAuditLog
);

module.exports = router;
