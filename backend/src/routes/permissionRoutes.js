/**
 * Permission Routes
 * Admin-only routes for managing role permissions
 */
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const permissionController = require('../controllers/permissionController');

// All routes require authentication and admin role
router.use(authenticate, authorize('admin'));

// Get all permissions
router.get(
  '/',
  permissionController.getAllPermissions
);

// Get all roles with user counts
router.get(
  '/roles',
  permissionController.getRoles
);

// Get permission matrix (all roles with their permissions)
router.get(
  '/matrix',
  permissionController.getPermissionMatrix
);

// Get permissions for a specific role
router.get(
  '/roles/:role',
  permissionController.getRolePermissions
);

// Update permissions for a role
router.put(
  '/roles/:role',
  [
    body('permissionIds').isArray().withMessage('permissionIds must be an array'),
    body('permissionIds.*').isInt({ min: 1 }).withMessage('Invalid permission ID')
  ],
  validate,
  permissionController.updateRolePermissions
);

module.exports = router;
