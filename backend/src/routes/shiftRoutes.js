/**
 * Shift Routes
 * Employee shift management with role-based access control
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /shifts:
 *   get:
 *     summary: Get shifts list with filters
 *     tags: [Shifts]
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
 *         name: employeeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, abandoned]
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
 *         description: List of shifts with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 shifts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shift'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('employeeId').optional().isUUID().withMessage('Invalid employee ID'),
    query('status').optional().isIn(['active', 'completed', 'abandoned']).withMessage('Invalid status'),
    query('startDate').optional().isDate().withMessage('Invalid start date'),
    query('endDate').optional().isDate().withMessage('Invalid end date')
  ],
  validate,
  shiftController.getShifts
);

/**
 * @swagger
 * /shifts/active:
 *   get:
 *     summary: Get current user's active shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active shift details or null if none
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 shift:
 *                   $ref: '#/components/schemas/Shift'
 */
router.get('/active', shiftController.getActiveShift);

/**
 * @swagger
 * /shifts/start:
 *   post:
 *     summary: Start a new shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               drawerId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional cash drawer to assign
 *               openingBalances:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     currencyId:
 *                       type: integer
 *                     amount:
 *                       type: number
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Shift started
 *       400:
 *         description: Already has active shift
 */
router.post(
  '/start',
  [
    body('drawerId').optional().isUUID().withMessage('Invalid drawer ID'),
    body('openingBalances')
      .optional()
      .isArray()
      .withMessage('Opening balances must be an array'),
    body('openingBalances.*.currencyId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid currency ID required'),
    body('openingBalances.*.amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Amount must be non-negative'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters')
  ],
  validate,
  shiftController.startShift
);

/**
 * @swagger
 * /shifts/{uuid}:
 *   get:
 *     summary: Get shift details
 *     tags: [Shifts]
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
 *         description: Shift details with transactions summary
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:uuid', shiftController.getShiftDetails);

/**
 * @swagger
 * /shifts/{uuid}/end:
 *   post:
 *     summary: End a shift
 *     tags: [Shifts]
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
 *               closingBalances:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     currencyId:
 *                       type: integer
 *                     amount:
 *                       type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shift ended
 *       400:
 *         description: Shift already ended
 *       403:
 *         description: Not your shift
 */
router.post(
  '/:uuid/end',
  [
    body('closingBalances')
      .optional()
      .isArray()
      .withMessage('Closing balances must be an array'),
    body('closingBalances.*.currencyId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid currency ID required'),
    body('closingBalances.*.amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Amount must be non-negative'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters')
  ],
  validate,
  shiftController.endShift
);

/**
 * @swagger
 * /shifts/{uuid}/handover:
 *   post:
 *     summary: Handover shift to another employee
 *     tags: [Shifts]
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
 *               - toEmployeeUuid
 *             properties:
 *               toEmployeeUuid:
 *                 type: string
 *                 format: uuid
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shift handed over
 *       400:
 *         description: Invalid handover target
 */
router.post(
  '/:uuid/handover',
  [
    body('toEmployeeUuid')
      .isUUID()
      .withMessage('Valid employee UUID required'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters')
  ],
  validate,
  shiftController.handoverShift
);

/**
 * @swagger
 * /shifts/{uuid}/abandon:
 *   post:
 *     summary: Abandon shift (admin only)
 *     tags: [Shifts]
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
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Shift abandoned
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/:uuid/abandon',
  authorize('admin'),
  [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be max 500 characters')
  ],
  validate,
  shiftController.abandonShift
);

module.exports = router;
