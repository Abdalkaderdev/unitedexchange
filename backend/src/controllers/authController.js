/**
 * Authentication Controller
 * Production-ready with refresh tokens, rate limiting integration, and comprehensive audit logging
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const jwtConfig = require('../config/jwt');
const { logAudit, getClientIp } = require('../utils/helpers');
const { recordFailedLogin, recordSuccessfulLogin } = require('../middleware/rateLimiter');

// Password hashing configuration
const BCRYPT_ROUNDS = 12; // Cost factor for bcrypt

/**
 * Generate access token (short-lived)
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      uuid: user.uuid,
      role: user.role,
      type: 'access'
    },
    jwtConfig.accessToken.secret,
    { expiresIn: jwtConfig.accessToken.expiresIn }
  );
};

/**
 * Generate refresh token (long-lived)
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash refresh token for storage
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Store refresh token in database
 */
const storeRefreshToken = async (userId, token, ipAddress, userAgent) => {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + jwtConfig.refreshToken.expiresInMs);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, ip_address, device_info, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, tokenHash, ipAddress, userAgent, expiresAt]
  );
};

/**
 * Revoke all refresh tokens for a user
 */
const revokeAllUserTokens = async (userId) => {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
    [userId]
  );
};

/**
 * Login handler
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Find user
    const [users] = await pool.query(
      `SELECT id, uuid, username, email, password, full_name, role, is_active
       FROM users WHERE username = ? OR email = ?`,
      [username, username]
    );

    if (users.length === 0) {
      // Record failed attempt
      await recordFailedLogin(req);
      await logAudit(null, 'LOGIN_FAILED', 'users', null, null,
        { username, reason: 'User not found' }, ipAddress, 'warning');

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    const user = users[0];

    // Check if active
    if (!user.is_active) {
      await recordFailedLogin(req);
      await logAudit(user.id, 'LOGIN_FAILED', 'users', user.id, null,
        { reason: 'Account deactivated' }, ipAddress, 'warning');

      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact administrator.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await recordFailedLogin(req);
      await logAudit(user.id, 'LOGIN_FAILED', 'users', user.id, null,
        { reason: 'Invalid password' }, ipAddress, 'warning');

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Store refresh token
    await storeRefreshToken(user.id, refreshToken, ipAddress, userAgent);

    // Update last login time
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    // Record successful login
    await recordSuccessfulLogin(username, ipAddress);

    // Log audit
    await logAudit(user.id, 'LOGIN', 'users', user.id, null,
      { ip: ipAddress, userAgent }, ipAddress, 'info');

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        refreshToken,
        expiresIn: jwtConfig.accessToken.expiresIn,
        user: {
          uuid: user.uuid,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const ipAddress = getClientIp(req);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.'
      });
    }

    const tokenHash = hashToken(token);

    // Find valid refresh token
    const [tokens] = await pool.query(
      `SELECT rt.*, u.uuid, u.username, u.email, u.full_name, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = ?
         AND rt.revoked_at IS NULL
         AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      await logAudit(null, 'TOKEN_REFRESH_FAILED', 'refresh_tokens', null, null,
        { reason: 'Invalid or expired token' }, ipAddress, 'warning');

      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.'
      });
    }

    const tokenRecord = tokens[0];

    // Check if user is still active
    if (!tokenRecord.is_active) {
      // Revoke all tokens for this user
      await revokeAllUserTokens(tokenRecord.user_id);

      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    // Revoke old refresh token
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?',
      [tokenRecord.id]
    );

    // Generate new tokens
    const newAccessToken = generateAccessToken({
      uuid: tokenRecord.uuid,
      role: tokenRecord.role
    });
    const newRefreshToken = generateRefreshToken();

    // Store new refresh token
    await storeRefreshToken(
      tokenRecord.user_id,
      newRefreshToken,
      ipAddress,
      req.headers['user-agent']
    );

    await logAudit(tokenRecord.user_id, 'TOKEN_REFRESH', 'refresh_tokens',
      tokenRecord.id, null, { ip: ipAddress }, ipAddress, 'info');

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: jwtConfig.accessToken.expiresIn
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout handler
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const ipAddress = getClientIp(req);

    if (token) {
      const tokenHash = hashToken(token);
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?',
        [tokenHash]
      );
    }

    // Log audit
    await logAudit(req.user?.id, 'LOGOUT', 'users', req.user?.id, null,
      { ip: ipAddress }, ipAddress, 'info');

    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout from all devices
 */
const logoutAll = async (req, res, next) => {
  try {
    const ipAddress = getClientIp(req);

    await revokeAllUserTokens(req.user.id);

    await logAudit(req.user.id, 'LOGOUT_ALL', 'users', req.user.id, null,
      { ip: ipAddress }, ipAddress, 'info');

    res.json({
      success: true,
      message: 'Logged out from all devices.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        uuid: req.user.uuid,
        username: req.user.username,
        email: req.user.email,
        fullName: req.user.full_name,
        role: req.user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = getClientIp(req);

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain uppercase, lowercase, and numbers.'
      });
    }

    // Get current password hash
    const [users] = await pool.query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);

    if (!isValidPassword) {
      await logAudit(req.user.id, 'PASSWORD_CHANGE_FAILED', 'users', req.user.id, null,
        { reason: 'Invalid current password' }, ipAddress, 'warning');

      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    // Hash new password with strong bcrypt settings
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and timestamp
    await pool.query(
      'UPDATE users SET password = ?, password_changed_at = NOW() WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    // Revoke all refresh tokens (force re-login on all devices)
    await revokeAllUserTokens(req.user.id);

    // Log audit
    await logAudit(req.user.id, 'PASSWORD_CHANGE', 'users', req.user.id, null,
      { ip: ipAddress }, ipAddress, 'info');

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  logoutAll,
  refreshToken,
  getProfile,
  changePassword,
  BCRYPT_ROUNDS
};
