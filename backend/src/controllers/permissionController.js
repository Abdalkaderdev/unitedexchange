/**
 * Permission Controller
 * Manages permissions and role assignments
 */
const { pool } = require('../config/database');
const { clearPermissionCache } = require('../middleware/auth');

/**
 * Get all permissions grouped by category
 */
const getAllPermissions = async (req, res, next) => {
  try {
    const [permissions] = await pool.query(`
      SELECT id, code, name, description, category
      FROM permissions
      ORDER BY category, code
    `);

    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        permissions,
        grouped
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get permissions for a specific role
 */
const getRolePermissions = async (req, res, next) => {
  try {
    const { role } = req.params;

    const validRoles = ['admin', 'manager', 'teller', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const [permissions] = await pool.query(`
      SELECT p.id, p.code, p.name, p.description, p.category
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ?
      ORDER BY p.category, p.code
    `, [role]);

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get permission matrix (all roles with their permissions)
 */
const getPermissionMatrix = async (req, res, next) => {
  try {
    // Get all permissions
    const [permissions] = await pool.query(`
      SELECT id, code, name, description, category
      FROM permissions
      ORDER BY category, code
    `);

    // Get all role permissions
    const [rolePerms] = await pool.query(`
      SELECT role, permission_id
      FROM role_permissions
    `);

    // Build matrix
    const roles = ['admin', 'manager', 'teller', 'viewer'];
    const matrix = {};

    for (const role of roles) {
      matrix[role] = rolePerms
        .filter(rp => rp.role === role)
        .map(rp => rp.permission_id);
    }

    res.json({
      success: true,
      data: {
        permissions,
        roles,
        matrix
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update permissions for a role
 */
const updateRolePermissions = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { role } = req.params;
    const { permissionIds } = req.body;

    const validRoles = ['manager', 'teller', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify admin permissions'
      });
    }

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: 'permissionIds must be an array'
      });
    }

    await connection.beginTransaction();

    // Delete existing permissions for role
    await connection.query(
      'DELETE FROM role_permissions WHERE role = ?',
      [role]
    );

    // Insert new permissions
    if (permissionIds.length > 0) {
      const values = permissionIds.map(id => [role, id]);
      await connection.query(
        'INSERT INTO role_permissions (role, permission_id) VALUES ?',
        [values]
      );
    }

    await connection.commit();

    // Clear permission cache
    clearPermissionCache();

    // Log audit
    const { logAudit } = require('../utils/audit');
    const ipAddress = req.ip || req.connection?.remoteAddress;
    await logAudit(
      req.user.id,
      'UPDATE',
      'role_permissions',
      null,
      { role },
      { permissionIds },
      ipAddress,
      'warning'
    );

    res.json({
      success: true,
      message: `Permissions updated for role: ${role}`,
      data: { role, permissionCount: permissionIds.length }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

/**
 * Get all available roles
 */
const getRoles = async (req, res, next) => {
  try {
    const roles = [
      { id: 'admin', name: 'Administrator', description: 'Full system access', editable: false },
      { id: 'manager', name: 'Manager', description: 'Manage operations and reports', editable: true },
      { id: 'teller', name: 'Teller', description: 'Handle transactions and customers', editable: true },
      { id: 'viewer', name: 'Viewer', description: 'View-only access', editable: true }
    ];

    // Get user count per role
    const [counts] = await pool.query(`
      SELECT role, COUNT(*) as count
      FROM users
      WHERE is_active = 1
      GROUP BY role
    `);

    const countsMap = counts.reduce((acc, c) => {
      acc[c.role] = c.count;
      return acc;
    }, {});

    const rolesWithCounts = roles.map(r => ({
      ...r,
      userCount: countsMap[r.id] || 0
    }));

    res.json({
      success: true,
      data: rolesWithCounts
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPermissions,
  getRolePermissions,
  getPermissionMatrix,
  updateRolePermissions,
  getRoles
};
