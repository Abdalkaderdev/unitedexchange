/**
 * Customer Routes
 * Production-ready with validation and role-based access control
 */
const express = require('express');
const { body, query, param } = require('express-validator');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Get all customers with search and pagination
 *     tags: [Customers]
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, phone, email, or ID number
 *       - in: query
 *         name: isVip
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isBlocked
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [full_name, created_at, total_transactions, total_volume]
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *     responses:
 *       200:
 *         description: List of customers with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 customers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Customer'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search must be max 100 characters'),
    query('isVip').optional().isIn(['true', 'false']).withMessage('isVip must be true or false'),
    query('isBlocked').optional().isIn(['true', 'false']).withMessage('isBlocked must be true or false'),
    query('sortBy').optional().isIn(['full_name', 'created_at', 'total_transactions', 'total_volume']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['ASC', 'DESC', 'asc', 'desc']).withMessage('Sort order must be ASC or DESC')
  ],
  validate,
  customerController.getCustomers
);

/**
 * @swagger
 * /customers/{uuid}:
 *   get:
 *     summary: Get single customer
 *     tags: [Customers]
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
 *         description: Customer details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:uuid',
  [
    param('uuid').isUUID().withMessage('Invalid customer ID')
  ],
  validate,
  customerController.getCustomer
);

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               idType:
 *                 type: string
 *                 enum: [passport, national_id, driver_license, other]
 *               idNumber:
 *                 type: string
 *               idExpiry:
 *                 type: string
 *                 format: date
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *               isVip:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Customer created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('fullName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be 2-100 characters'),
    body('phone')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Phone must be max 20 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Invalid email format'),
    body('idType')
      .optional()
      .isIn(['passport', 'national_id', 'driver_license', 'other'])
      .withMessage('Invalid ID type'),
    body('idNumber')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('ID number must be max 50 characters'),
    body('idExpiry')
      .optional()
      .isDate()
      .withMessage('Invalid expiry date format'),
    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Address must be max 500 characters'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes must be max 1000 characters'),
    body('isVip')
      .optional()
      .isBoolean()
      .withMessage('isVip must be a boolean')
  ],
  validate,
  customerController.createCustomer
);

/**
 * @swagger
 * /customers/{uuid}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
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
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               idType:
 *                 type: string
 *               idNumber:
 *                 type: string
 *               idExpiry:
 *                 type: string
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *               isVip:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Customer updated
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:uuid',
  [
    param('uuid').isUUID().withMessage('Invalid customer ID'),
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be 2-100 characters'),
    body('phone')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Phone must be max 20 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Invalid email format'),
    body('idType')
      .optional()
      .isIn(['passport', 'national_id', 'driver_license', 'other', ''])
      .withMessage('Invalid ID type'),
    body('idNumber')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('ID number must be max 50 characters'),
    body('idExpiry')
      .optional()
      .isDate()
      .withMessage('Invalid expiry date format'),
    body('address')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Address must be max 500 characters'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes must be max 1000 characters'),
    body('isVip')
      .optional()
      .isBoolean()
      .withMessage('isVip must be a boolean')
  ],
  validate,
  customerController.updateCustomer
);

/**
 * @swagger
 * /customers/{uuid}/block:
 *   post:
 *     summary: Block customer (admin only)
 *     tags: [Customers]
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
 *                 maxLength: 255
 *     responses:
 *       200:
 *         description: Customer blocked
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:uuid/block',
  authorize('admin'),
  [
    param('uuid').isUUID().withMessage('Invalid customer ID'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Block reason must be max 255 characters')
  ],
  validate,
  customerController.blockCustomer
);

/**
 * @swagger
 * /customers/{uuid}/unblock:
 *   post:
 *     summary: Unblock customer (admin only)
 *     tags: [Customers]
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
 *         description: Customer unblocked
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:uuid/unblock',
  authorize('admin'),
  [
    param('uuid').isUUID().withMessage('Invalid customer ID')
  ],
  validate,
  customerController.unblockCustomer
);

/**
 * @swagger
 * /customers/{uuid}/transactions:
 *   get:
 *     summary: Get customer transactions
 *     tags: [Customers]
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
 *           enum: [completed, cancelled, all]
 *     responses:
 *       200:
 *         description: Customer transactions
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:uuid/transactions',
  [
    param('uuid').isUUID().withMessage('Invalid customer ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('startDate').optional().isDate().withMessage('Invalid start date format'),
    query('endDate').optional().isDate().withMessage('Invalid end date format'),
    query('status').optional().isIn(['completed', 'cancelled', 'all']).withMessage('Invalid status')
  ],
  validate,
  customerController.getCustomerTransactions
);

/**
 * @swagger
 * /customers/{uuid}/stats:
 *   get:
 *     summary: Get customer statistics
 *     tags: [Customers]
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
 *         description: Customer statistics
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:uuid/stats',
  [
    param('uuid').isUUID().withMessage('Invalid customer ID')
  ],
  validate,
  customerController.getCustomerStats
);

/**
 * @swagger
 * /customers/{uuid}:
 *   delete:
 *     summary: Delete customer (admin only)
 *     tags: [Customers]
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
 *         description: Customer deleted
 *       400:
 *         description: Cannot delete customer with transactions
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:uuid',
  authorize('admin'),
  [
    param('uuid').isUUID().withMessage('Invalid customer ID')
  ],
  validate,
  customerController.deleteCustomer
);

module.exports = router;
