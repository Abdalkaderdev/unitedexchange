/**
 * Transaction Routes
 * Production-ready with soft deletes and role-based access control
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const receiptController = require('../controllers/receiptController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const importController = require('../controllers/importController');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /transactions/import:
 *   post:
 *     summary: Bulk import transactions from CSV
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import summary
 */
router.post(
  '/import',
  authorize('admin'), // Restrict to admins for safety
  upload.single('file'),
  importController.importTransactions
);

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Get transactions with filters and pagination
 *     tags: [Transactions]
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
 *       - in: query
 *         name: includeDeleted
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of transactions with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('startDate').optional().isDate().withMessage('Invalid start date format'),
    query('endDate').optional().isDate().withMessage('Invalid end date format'),
    query('status').optional().isIn(['completed', 'cancelled', 'all']).withMessage('Invalid status'),
    query('includeDeleted').optional().isBoolean().withMessage('includeDeleted must be boolean')
  ],
  validate,
  transactionController.getTransactions
);

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Create new transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currencyInId
 *               - currencyOutId
 *               - amountIn
 *               - amountOut
 *               - exchangeRate
 *             properties:
 *               customerId:
 *                 type: string
 *                 format: uuid
 *                 description: Existing customer UUID
 *               customerName:
 *                 type: string
 *                 description: Required if customerId not provided
 *               customerPhone:
 *                 type: string
 *               customerIdType:
 *                 type: string
 *                 enum: [passport, national_id, driver_license, other]
 *               customerIdNumber:
 *                 type: string
 *               currencyInId:
 *                 type: integer
 *               currencyOutId:
 *                 type: integer
 *               amountIn:
 *                 type: number
 *               amountOut:
 *                 type: number
 *               exchangeRate:
 *                 type: number
 *               marketRate:
 *                 type: number
 *               commission:
 *                 type: number
 *                 default: 0
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaction created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('customerId')
      .optional()
      .isUUID()
      .withMessage('Customer ID must be a valid UUID'),
    body('customerName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Customer name must be 2-100 characters'),
    body('customerPhone')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Phone number must be max 20 characters'),
    body('customerIdType')
      .optional()
      .isIn(['passport', 'national_id', 'driver_license', 'other'])
      .withMessage('Invalid ID type'),
    body('customerIdNumber')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('ID number must be max 50 characters'),
    body('currencyInId').isInt({ min: 1 }).withMessage('Valid currency in ID is required'),
    body('currencyOutId').isInt({ min: 1 }).withMessage('Valid currency out ID is required'),
    body('amountIn')
      .isFloat({ min: 0.01 })
      .withMessage('Amount in must be a positive number'),
    body('amountOut')
      .isFloat({ min: 0.01 })
      .withMessage('Amount out must be a positive number'),
    body('exchangeRate')
      .isFloat({ min: 0.000001 })
      .withMessage('Exchange rate must be a positive number'),
    body('marketRate')
      .optional()
      .isFloat({ min: 0.000001 })
      .withMessage('Market rate must be a positive number'),
    body('commission')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Commission must be non-negative'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters')
  ],
  validate,
  (req, res, next) => {
    if (!req.body.customerId && !req.body.customerName) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'customerName', message: 'Either customerId or customerName is required' }]
      });
    }
    next();
  },
  transactionController.createTransaction
);

/**
 * @swagger
 * /transactions/{uuid}:
 *   get:
 *     summary: Get single transaction
 *     tags: [Transactions]
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
 *         description: Transaction details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:uuid', transactionController.getTransaction);

/**
 * @swagger
 * /transactions/{uuid}:
 *   put:
 *     summary: Update transaction (editable fields only)
 *     tags: [Transactions]
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
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *               customerIdType:
 *                 type: string
 *                 enum: [passport, national_id, driver_license, other]
 *               customerIdNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, bank_transfer, cheque, other]
 *               referenceNumber:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction updated
 *       400:
 *         description: Cannot update cancelled transaction or validation error
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:uuid',
  [
    body('customerName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Customer name must be 2-100 characters'),
    body('customerPhone')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Phone number must be max 20 characters'),
    body('customerIdType')
      .optional()
      .isIn(['passport', 'national_id', 'driver_license', 'other', ''])
      .withMessage('Invalid ID type'),
    body('customerIdNumber')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('ID number must be max 50 characters'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes must be max 500 characters'),
    body('paymentMethod')
      .optional()
      .isIn(['cash', 'card', 'bank_transfer', 'cheque', 'other'])
      .withMessage('Invalid payment method'),
    body('referenceNumber')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Reference number must be max 100 characters')
  ],
  validate,
  transactionController.updateTransaction
);

/**
 * @swagger
 * /transactions/{uuid}/receipt:
 *   get:
 *     summary: Get transaction receipt PDF
 *     tags: [Transactions]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [customer, internal]
 *           default: customer
 *         description: Receipt type - internal includes profit/commission
 *       - in: query
 *         name: download
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           enum: [en, ar, ku]
 *           default: en
 *     responses:
 *       200:
 *         description: PDF receipt
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:uuid/receipt',
  [
    query('type')
      .optional()
      .isIn(['customer', 'internal'])
      .withMessage('Type must be "customer" or "internal"'),
    query('download')
      .optional()
      .isIn(['true', 'false'])
      .withMessage('Download must be "true" or "false"'),
    query('lang')
      .optional()
      .isIn(['en', 'ar', 'ku'])
      .withMessage('Language must be "en", "ar", or "ku"')
  ],
  validate,
  receiptController.getReceipt
);

/**
 * @swagger
 * /transactions/{uuid}/receipt/email:
 *   post:
 *     summary: Email transaction receipt
 *     tags: [Transactions]
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
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               type:
 *                 type: string
 *                 enum: [customer, internal]
 *                 default: customer
 *               lang:
 *                 type: string
 *                 enum: [en, ar, ku]
 *                 default: en
 *     responses:
 *       200:
 *         description: Receipt sent
 *       400:
 *         description: Invalid email
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:uuid/receipt/email',
  [
    body('email')
      .isEmail()
      .withMessage('Valid email address is required'),
    body('type')
      .optional()
      .isIn(['customer', 'internal'])
      .withMessage('Type must be "customer" or "internal"'),
    body('lang')
      .optional()
      .isIn(['en', 'ar', 'ku'])
      .withMessage('Language must be "en", "ar", or "ku"')
  ],
  validate,
  receiptController.emailReceipt
);

/**
 * @swagger
 * /transactions/{uuid}/receipt/history:
 *   get:
 *     summary: Get receipt action history
 *     tags: [Transactions]
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
 *         description: Receipt history
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:uuid/receipt/history', receiptController.getReceiptHistory);

/**
 * @swagger
 * /transactions/{uuid}/receipt/log:
 *   post:
 *     summary: Log a receipt action (view, download, print)
 *     tags: [Transactions]
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
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [view, download, print]
 *               type:
 *                 type: string
 *                 enum: [customer, internal]
 *                 default: customer
 *               lang:
 *                 type: string
 *                 enum: [en, ar, ku]
 *                 default: en
 *     responses:
 *       200:
 *         description: Action logged
 */
router.post(
  '/:uuid/receipt/log',
  [
    body('action')
      .isIn(['view', 'download', 'print'])
      .withMessage('Action must be "view", "download", or "print"'),
    body('type')
      .optional()
      .isIn(['customer', 'internal'])
      .withMessage('Type must be "customer" or "internal"'),
    body('lang')
      .optional()
      .isIn(['en', 'ar', 'ku'])
      .withMessage('Language must be "en", "ar", or "ku"')
  ],
  validate,
  receiptController.logReceiptAction
);

/**
 * @swagger
 * /transactions/{uuid}/cancel:
 *   post:
 *     summary: Cancel transaction
 *     tags: [Transactions]
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
 *         description: Transaction cancelled
 *       400:
 *         description: Transaction already cancelled
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/:uuid/cancel',
  [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be max 500 characters')
  ],
  validate,
  transactionController.cancelTransaction
);

/**
 * @swagger
 * /transactions/{uuid}:
 *   delete:
 *     summary: Soft delete transaction (admin only)
 *     tags: [Transactions]
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
 *         description: Transaction deleted
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:uuid',
  authorize('admin'),
  [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be max 500 characters')
  ],
  validate,
  transactionController.deleteTransaction
);

module.exports = router;
