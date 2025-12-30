/**
 * Compliance Routes
 * KYC and compliance management with admin-only access
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const complianceController = require('../controllers/complianceController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /compliance/dashboard:
 *   get:
 *     summary: Get compliance dashboard statistics
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Compliance dashboard statistics
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
 *                     pendingAlerts:
 *                       type: integer
 *                     openSARs:
 *                       type: integer
 *                     highRiskCustomers:
 *                       type: integer
 */
router.get('/dashboard', complianceController.getDashboardStats);

/**
 * @swagger
 * /compliance/rules:
 *   get:
 *     summary: Get all compliance rules
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of compliance rules
 */
router.get(
  '/rules',
  [query('active').optional().isBoolean().withMessage('Active must be boolean')],
  validate,
  complianceController.getRules
);

/**
 * @swagger
 * /compliance/rules:
 *   post:
 *     summary: Create new compliance rule (admin only)
 *     tags: [Compliance]
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
 *               - ruleType
 *               - action
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               ruleType:
 *                 type: string
 *                 enum: [transaction_limit, daily_limit, customer_limit, id_required, velocity]
 *               currencyId:
 *                 type: integer
 *               thresholdAmount:
 *                 type: number
 *               thresholdCount:
 *                 type: integer
 *               timeWindowHours:
 *                 type: integer
 *               action:
 *                 type: string
 *                 enum: [flag, block, require_approval, require_id]
 *               priority:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Rule created
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/rules',
  authorize('admin'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description max 500 chars'),
    body('ruleType').isIn(['transaction_limit', 'daily_limit', 'customer_limit', 'id_required', 'velocity']).withMessage('Invalid rule type'),
    body('currencyId').optional().isInt({ min: 1 }).withMessage('Invalid currency ID'),
    body('thresholdAmount').optional().isFloat({ min: 0 }).withMessage('Threshold must be non-negative'),
    body('thresholdCount').optional().isInt({ min: 1 }).withMessage('Count must be positive'),
    body('timeWindowHours').optional().isInt({ min: 1, max: 720 }).withMessage('Time window must be 1-720 hours'),
    body('action').isIn(['flag', 'block', 'require_approval', 'require_id']).withMessage('Invalid action'),
    body('priority').optional().isInt({ min: 0 }).withMessage('Priority must be non-negative')
  ],
  validate,
  complianceController.createRule
);

/**
 * @swagger
 * /compliance/rules/{uuid}:
 *   put:
 *     summary: Update compliance rule (admin only)
 *     tags: [Compliance]
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
 *               thresholdAmount:
 *                 type: number
 *               action:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Rule updated
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/rules/:uuid',
  authorize('admin'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('thresholdAmount').optional().isFloat({ min: 0 }).withMessage('Threshold must be non-negative'),
    body('action').optional().isIn(['flag', 'block', 'require_approval', 'require_id']).withMessage('Invalid action'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
  ],
  validate,
  complianceController.updateRule
);

/**
 * @swagger
 * /compliance/rules/{uuid}/toggle:
 *   post:
 *     summary: Toggle rule active status (admin only)
 *     tags: [Compliance]
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
 *         description: Rule status toggled
 */
router.post('/rules/:uuid/toggle', authorize('admin'), complianceController.toggleRule);

/**
 * @swagger
 * /compliance/alerts:
 *   get:
 *     summary: Get compliance alerts with filters
 *     tags: [Compliance]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, escalated, resolved, false_positive]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
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
 *     responses:
 *       200:
 *         description: List of compliance alerts with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 alerts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ComplianceAlert'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get(
  '/alerts',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('status').optional().isIn(['pending', 'reviewed', 'escalated', 'resolved', 'false_positive']).withMessage('Invalid status'),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    query('alertType').optional().isString().withMessage('Invalid alert type'),
    query('startDate').optional().isDate().withMessage('Invalid start date'),
    query('endDate').optional().isDate().withMessage('Invalid end date')
  ],
  validate,
  complianceController.getAlerts
);

/**
 * @swagger
 * /compliance/alerts/{uuid}/review:
 *   post:
 *     summary: Review a compliance alert
 *     tags: [Compliance]
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [reviewed, escalated, resolved, false_positive]
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Alert reviewed
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/alerts/:uuid/review',
  [
    body('status').isIn(['reviewed', 'escalated', 'resolved', 'false_positive']).withMessage('Invalid status'),
    body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes max 1000 chars')
  ],
  validate,
  complianceController.reviewAlert
);

/**
 * @swagger
 * /compliance/customers/{uuid}/risk:
 *   get:
 *     summary: Get customer risk profile
 *     tags: [Compliance]
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
 *         description: Customer risk profile
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/customers/:uuid/risk', complianceController.getCustomerRiskProfile);

/**
 * @swagger
 * /compliance/sars:
 *   get:
 *     summary: Get Suspicious Activity Reports list
 *     tags: [Compliance]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, submitted, under_review, closed]
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *     responses:
 *       200:
 *         description: List of SARs with pagination
 */
router.get(
  '/sars',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('status').optional().isIn(['draft', 'submitted', 'under_review', 'closed']).withMessage('Invalid status'),
    query('riskLevel').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid risk level')
  ],
  validate,
  complianceController.getSARs
);

/**
 * @swagger
 * /compliance/sars:
 *   post:
 *     summary: Create new Suspicious Activity Report
 *     tags: [Compliance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - riskLevel
 *             properties:
 *               customerUuid:
 *                 type: string
 *                 format: uuid
 *               alertUuids:
 *                 type: array
 *                 items:
 *                   type: string
 *               transactionUuids:
 *                 type: array
 *                 items:
 *                   type: string
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *               riskLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *     responses:
 *       201:
 *         description: SAR created
 *       400:
 *         description: Validation error
 */
router.post(
  '/sars',
  [
    body('customerUuid').optional().isUUID().withMessage('Invalid customer UUID'),
    body('alertUuids').optional().isArray().withMessage('Alert UUIDs must be array'),
    body('transactionUuids').optional().isArray().withMessage('Transaction UUIDs must be array'),
    body('description').trim().isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 chars'),
    body('riskLevel').isIn(['low', 'medium', 'high']).withMessage('Invalid risk level')
  ],
  validate,
  complianceController.createSAR
);

module.exports = router;
