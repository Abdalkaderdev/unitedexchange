/**
 * Cash Drawer Routes
 * Cash drawer management with role-based access control
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const cashDrawerController = require('../controllers/cashDrawerController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /cash-drawers:
 *   get:
 *     summary: Get all cash drawers with balances
 *     tags: [Cash Drawers]
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
 *         description: List of cash drawers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 drawers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CashDrawer'
 */
router.get(
  '/',
  [
    query('active').optional().isBoolean().withMessage('Active must be boolean')
  ],
  validate,
  cashDrawerController.getDrawers
);

/**
 * @swagger
 * /cash-drawers/alerts:
 *   get:
 *     summary: Get low balance alerts
 *     tags: [Cash Drawers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Low balance alerts
 */
router.get('/alerts', cashDrawerController.getLowBalanceAlerts);

/**
 * @swagger
 * /cash-drawers/{uuid}:
 *   get:
 *     summary: Get single cash drawer with balances
 *     tags: [Cash Drawers]
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
 *         description: Cash drawer details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:uuid', cashDrawerController.getDrawer);

/**
 * @swagger
 * /cash-drawers:
 *   post:
 *     summary: Create new cash drawer (admin only)
 *     tags: [Cash Drawers]
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               location:
 *                 type: string
 *                 maxLength: 100
 *               lowBalanceAlert:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Cash drawer created
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/',
  authorize('admin'),
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be 2-50 characters'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Location must be max 100 characters'),
    body('lowBalanceAlert')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Low balance alert must be a positive number')
  ],
  validate,
  cashDrawerController.createDrawer
);

/**
 * @swagger
 * /cash-drawers/{uuid}:
 *   put:
 *     summary: Update cash drawer (admin only)
 *     tags: [Cash Drawers]
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
 *               location:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               lowBalanceAlert:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cash drawer updated
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:uuid',
  authorize('admin'),
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be 2-50 characters'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Location must be max 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be boolean'),
    body('lowBalanceAlert')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Low balance alert must be a positive number')
  ],
  validate,
  cashDrawerController.updateDrawer
);

/**
 * @swagger
 * /cash-drawers/{uuid}/deposit:
 *   post:
 *     summary: Deposit cash into drawer
 *     tags: [Cash Drawers]
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
 *               - currencyId
 *               - amount
 *             properties:
 *               currencyId:
 *                 type: integer
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deposit successful
 */
router.post(
  '/:uuid/deposit',
  [
    body('currencyId')
      .isInt({ min: 1 })
      .withMessage('Valid currency ID is required'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters')
  ],
  validate,
  cashDrawerController.deposit
);

/**
 * @swagger
 * /cash-drawers/{uuid}/withdraw:
 *   post:
 *     summary: Withdraw cash from drawer
 *     tags: [Cash Drawers]
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
 *               - currencyId
 *               - amount
 *             properties:
 *               currencyId:
 *                 type: integer
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdrawal successful
 *       400:
 *         description: Insufficient balance
 */
router.post(
  '/:uuid/withdraw',
  [
    body('currencyId')
      .isInt({ min: 1 })
      .withMessage('Valid currency ID is required'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters')
  ],
  validate,
  cashDrawerController.withdraw
);

/**
 * @swagger
 * /cash-drawers/{uuid}/adjust:
 *   post:
 *     summary: Adjust drawer balance (admin only)
 *     tags: [Cash Drawers]
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
 *               - currencyId
 *               - newBalance
 *               - reason
 *             properties:
 *               currencyId:
 *                 type: integer
 *               newBalance:
 *                 type: number
 *                 minimum: 0
 *               reason:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Balance adjusted
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/:uuid/adjust',
  authorize('admin'),
  [
    body('currencyId')
      .isInt({ min: 1 })
      .withMessage('Valid currency ID is required'),
    body('newBalance')
      .isFloat({ min: 0 })
      .withMessage('New balance must be a non-negative number'),
    body('reason')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Reason must be 5-500 characters')
  ],
  validate,
  cashDrawerController.adjust
);

/**
 * @swagger
 * /cash-drawers/{uuid}/history:
 *   get:
 *     summary: Get drawer transaction history
 *     tags: [Cash Drawers]
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: currencyId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, withdrawal, adjustment, transaction_in, transaction_out]
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
 *         description: Transaction history
 */
router.get(
  '/:uuid/history',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('currencyId').optional().isInt({ min: 1 }).withMessage('Invalid currency ID'),
    query('type').optional().isIn(['deposit', 'withdrawal', 'adjustment', 'transaction_in', 'transaction_out']).withMessage('Invalid type'),
    query('startDate').optional().isDate().withMessage('Invalid start date'),
    query('endDate').optional().isDate().withMessage('Invalid end date')
  ],
  validate,
  cashDrawerController.getDrawerHistory
);

/**
 * @swagger
 * /cash-drawers/{uuid}/reconcile:
 *   post:
 *     summary: Reconcile drawer balance
 *     tags: [Cash Drawers]
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
 *               - currencyId
 *               - actualBalance
 *             properties:
 *               currencyId:
 *                 type: integer
 *               actualBalance:
 *                 type: number
 *                 minimum: 0
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reconciliation recorded
 */
router.post(
  '/:uuid/reconcile',
  [
    body('currencyId')
      .isInt({ min: 1 })
      .withMessage('Valid currency ID is required'),
    body('actualBalance')
      .isFloat({ min: 0 })
      .withMessage('Actual balance must be a non-negative number'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters')
  ],
  validate,
  cashDrawerController.reconcile
);

/**
 * @swagger
 * /cash-drawers/{id}/status:
 *   get:
 *     summary: Get drawer status for closing (balance snapshot)
 *     tags: [Cash Drawers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Drawer status retrieved
 */
router.get('/:id/status', cashDrawerController.getDrawerStatus);

/**
 * @swagger
 * /cash-drawers/{id}/close:
 *   post:
 *     summary: Submit drawer closing report
 *     tags: [Cash Drawers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actualBalances
 *             properties:
 *               actualBalances:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Drawer closed successfully
 */
router.post(
  '/:drawerId/close',
  [
    body('actualBalances').isArray().withMessage('Actual balances must be an array'),
    body('notes').optional().isString()
  ],
  validate,
  cashDrawerController.submitClosing
);

module.exports = router;
