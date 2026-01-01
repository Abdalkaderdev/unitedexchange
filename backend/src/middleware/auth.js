/**
 * Authentication Middleware
 * Production-ready with access token verification and role-based access control
 */
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const { pool } = require('../config/database');

/**
 * Authenticate user via JWT access token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      // Use access token secret for verification
      const decoded = jwt.verify(token, jwtConfig.accessToken.secret);

      // Verify token type
      if (decoded.type !== 'access') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type.'
        });
      }

      // Verify user still exists and is active
      const [users] = await pool.query(
        'SELECT id, uuid, username, email, full_name, role, is_active FROM users WHERE uuid = ?',
        [decoded.uuid]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'User not found.'
        });
      }

      const user = users[0];

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated.'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

/**
 * Permission cache to avoid repeated DB queries
 * Cache permissions for 5 minutes
 */
let permissionCache = {};
let permissionCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load role permissions into cache
 */
const loadPermissions = async () => {
  const now = Date.now();
  if (permissionCache && Object.keys(permissionCache).length > 0 && (now - permissionCacheTime) < CACHE_TTL) {
    return permissionCache;
  }

  try {
    const [rows] = await pool.query(`
      SELECT rp.role, p.code
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
    `);

    const cache = {};
    for (const row of rows) {
      if (!cache[row.role]) {
        cache[row.role] = new Set();
      }
      cache[row.role].add(row.code);
    }

    permissionCache = cache;
    permissionCacheTime = now;
    return cache;
  } catch (error) {
    console.error('Error loading permissions:', error);
    return permissionCache; // Return stale cache on error
  }
};

/**
 * Clear permission cache (call when permissions are updated)
 */
const clearPermissionCache = () => {
  permissionCache = {};
  permissionCacheTime = 0;
};

/**
 * Require specific permission(s) to access a route
 * @param {...string} permissions - Permission codes required (any one must match)
 */
const requirePermission = (...permissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.'
      });
    }

    // Admin always has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const cache = await loadPermissions();
      const userPermissions = cache[req.user.role] || new Set();

      // Check if user has any of the required permissions
      const hasPermission = permissions.some(p => userPermissions.has(p));

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Required permission not granted.'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions.'
      });
    }
  };
};

/**
 * Get all permissions for a user's role
 */
const getUserPermissions = async (role) => {
  const cache = await loadPermissions();
  return Array.from(cache[role] || []);
};

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  getUserPermissions,
  clearPermissionCache
};
