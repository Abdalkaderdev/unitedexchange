/**
 * Currency Routes
 * Production-ready with exchange rate history tracking
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const currencyController = require('../controllers/currencyController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /currencies:
 *   get:
 *     summary: Get all currencies
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of currencies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 currencies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Currency'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', currencyController.getCurrencies);

/**
 * @swagger
 * /currencies:
 *   post:
 *     summary: Create new currency (admin only)
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - symbol
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 3
 *                 example: EUR
 *               name:
 *                 type: string
 *                 example: Euro
 *               name_ar:
 *                 type: string
 *                 example: يورو
 *               name_ku:
 *                 type: string
 *                 example: یۆرۆ
 *               symbol:
 *                 type: string
 *                 example: €
 *     responses:
 *       201:
 *         description: Currency created
 *       400:
 *         description: Validation error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/',
  authorize('admin'),
  [
    body('code')
      .trim()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency code must be exactly 3 characters'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Currency name must be 2-50 characters'),
    body('symbol')
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage('Symbol must be 1-10 characters')
  ],
  validate,
  currencyController.createCurrency
);

/**
 * @swagger
 * /currencies/{id}:
 *   put:
 *     summary: Update currency (admin only)
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Currency ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               symbol:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Currency updated
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  authorize('admin'),
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Currency name must be 2-50 characters'),
    body('symbol')
      .optional()
      .trim()
      .isLength({ min: 1, max: 10 })
      .withMessage('Symbol must be 1-10 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  validate,
  currencyController.updateCurrency
);

/**
 * @swagger
 * /currencies/rates:
 *   get:
 *     summary: Get current exchange rates
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exchange rates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 rates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fromCurrency:
 *                         type: string
 *                       toCurrency:
 *                         type: string
 *                       buyRate:
 *                         type: number
 *                       sellRate:
 *                         type: number
 */
router.get('/rates', currencyController.getExchangeRates);

/**
 * @swagger
 * /currencies/rates:
 *   post:
 *     summary: Set exchange rate (admin only)
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromCurrencyId
 *               - toCurrencyId
 *               - buyRate
 *               - sellRate
 *             properties:
 *               fromCurrencyId:
 *                 type: integer
 *               toCurrencyId:
 *                 type: integer
 *               buyRate:
 *                 type: number
 *               sellRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Rate updated
 *       400:
 *         description: Validation error
 */
router.post(
  '/rates',
  authorize('admin'),
  [
    body('fromCurrencyId').isInt({ min: 1 }).withMessage('Valid from currency ID is required'),
    body('toCurrencyId').isInt({ min: 1 }).withMessage('Valid to currency ID is required'),
    body('buyRate')
      .isFloat({ min: 0.000001 })
      .withMessage('Buy rate must be a positive number'),
    body('sellRate')
      .isFloat({ min: 0.000001 })
      .withMessage('Sell rate must be a positive number')
  ],
  validate,
  currencyController.setExchangeRate
);

/**
 * @swagger
 * /currencies/rates/history:
 *   get:
 *     summary: Get exchange rate history
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromCurrencyId
 *         schema:
 *           type: integer
 *         description: Filter by source currency
 *       - in: query
 *         name: toCurrencyId
 *         schema:
 *           type: integer
 *         description: Filter by target currency
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
 *     responses:
 *       200:
 *         description: Rate history with pagination
 */
router.get(
  '/rates/history',
  [
    query('fromCurrencyId').optional().isInt({ min: 1 }).withMessage('Invalid from currency ID'),
    query('toCurrencyId').optional().isInt({ min: 1 }).withMessage('Invalid to currency ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  validate,
  currencyController.getExchangeRateHistory
);

module.exports = router;
