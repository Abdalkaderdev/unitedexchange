/**
 * User Routes
 * Production-ready with role-based access control
 */
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /users/employees:
 *   get:
 *     summary: Get list of employees for filters (any authenticated user)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of employees (limited data)
 */
router.get('/employees', userController.getEmployeeList);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', authorize('admin'), userController.getUsers);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 pattern: ^[a-zA-Z0-9_]+$
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               role:
 *                 type: string
 *                 enum: [admin, employee]
 *                 default: employee
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error or user exists
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/',
  authorize('admin'),
  [
    body('username')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be 3-50 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('fullName')
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be 2-100 characters'),
    body('role')
      .optional()
      .isIn(['admin', 'employee'])
      .withMessage('Role must be admin or employee')
  ],
  validate,
  userController.createUser
);

/**
 * @swagger
 * /users/{uuid}:
 *   put:
 *     summary: Update user (admin only)
 *     tags: [Users]
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
 *               email:
 *                 type: string
 *                 format: email
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, employee]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:uuid',
  authorize('admin'),
  [
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('fullName')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be 2-100 characters'),
    body('role')
      .optional()
      .isIn(['admin', 'employee'])
      .withMessage('Role must be admin or employee'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  validate,
  userController.updateUser
);

/**
 * @swagger
 * /users/{uuid}/reset-password:
 *   put:
 *     summary: Reset user password (admin only)
 *     tags: [Users]
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
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:uuid/reset-password',
  authorize('admin'),
  [
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],
  validate,
  userController.resetUserPassword
);

module.exports = router;
