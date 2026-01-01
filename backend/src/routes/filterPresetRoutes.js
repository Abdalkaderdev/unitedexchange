/**
 * Filter Preset Routes
 */
const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const filterPresetController = require('../controllers/filterPresetController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /filter-presets:
 *   get:
 *     summary: Get user's filter presets
 *     tags: [Filter Presets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of filter presets
 */
router.get(
  '/',
  [
    query('resourceType').optional().isString().withMessage('Invalid resource type')
  ],
  validate,
  filterPresetController.getPresets
);

/**
 * @swagger
 * /filter-presets:
 *   post:
 *     summary: Create a new filter preset
 *     tags: [Filter Presets]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100 chars)'),
    body('resourceType').trim().isLength({ min: 1, max: 50 }).withMessage('Resource type is required'),
    body('filters').isObject().withMessage('Filters must be an object'),
    body('isDefault').optional().isBoolean().withMessage('isDefault must be boolean')
  ],
  validate,
  filterPresetController.createPreset
);

/**
 * @swagger
 * /filter-presets/{uuid}:
 *   put:
 *     summary: Update a filter preset
 *     tags: [Filter Presets]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/:uuid',
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name max 100 chars'),
    body('filters').optional().isObject().withMessage('Filters must be an object'),
    body('isDefault').optional().isBoolean().withMessage('isDefault must be boolean')
  ],
  validate,
  filterPresetController.updatePreset
);

/**
 * @swagger
 * /filter-presets/{uuid}:
 *   delete:
 *     summary: Delete a filter preset
 *     tags: [Filter Presets]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:uuid', filterPresetController.deletePreset);

module.exports = router;
