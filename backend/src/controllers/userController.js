const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logAudit, getClientIp } = require('../utils/helpers');

const getUsers = async (req, res, next) => {
  try {
    const { role, active } = req.query;

    let query = 'SELECT id, uuid, username, email, full_name, role, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (active !== undefined) {
      query += ' AND is_active = ?';
      params.push(active === 'true');
    }

    query += ' ORDER BY created_at DESC';

    const [users] = await pool.query(query, params);

    res.json({
      success: true,
      data: users.map(u => ({
        uuid: u.uuid,
        username: u.username,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        isActive: u.is_active,
        createdAt: u.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { username, email, password, fullName, role } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const uuid = uuidv4();

    const [result] = await pool.query(
      `INSERT INTO users (uuid, username, email, password, full_name, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuid, username, email, hashedPassword, fullName, role || 'employee']
    );

    // Log audit
    await logAudit(
      req.user.id,
      'CREATE',
      'users',
      result.insertId,
      null,
      { username, email, fullName, role: role || 'employee' },
      getClientIp(req)
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: {
        uuid,
        username,
        email,
        fullName,
        role: role || 'employee'
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { email, fullName, role, isActive } = req.body;

    // Get existing user
    const [users] = await pool.query('SELECT * FROM users WHERE uuid = ?', [uuid]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const oldUser = users[0];

    // Prevent deactivating own account
    if (req.user.uuid === uuid && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account.'
      });
    }

    // Build update query
    const updates = [];
    const params = [];

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (fullName !== undefined) {
      updates.push('full_name = ?');
      params.push(fullName);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    params.push(uuid);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE uuid = ?`, params);

    // Log audit
    await logAudit(
      req.user.id,
      'UPDATE',
      'users',
      oldUser.id,
      { email: oldUser.email, fullName: oldUser.full_name, role: oldUser.role, isActive: oldUser.is_active },
      { email, fullName, role, isActive },
      getClientIp(req)
    );

    res.json({
      success: true,
      message: 'User updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { newPassword } = req.body;

    const [users] = await pool.query('SELECT id FROM users WHERE uuid = ?', [uuid]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query('UPDATE users SET password = ? WHERE uuid = ?', [hashedPassword, uuid]);

    // Log audit
    await logAudit(req.user.id, 'PASSWORD_RESET', 'users', users[0].id, null, null, getClientIp(req));

    res.json({
      success: true,
      message: 'Password reset successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get employee list for report filters (any authenticated user)
 * Returns limited data: uuid and fullName only
 */
const getEmployeeList = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      'SELECT uuid, full_name FROM users WHERE is_active = TRUE ORDER BY full_name ASC'
    );

    res.json({
      success: true,
      data: users.map(u => ({
        uuid: u.uuid,
        fullName: u.full_name
      }))
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  getEmployeeList
};
