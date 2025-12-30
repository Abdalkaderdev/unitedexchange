/**
 * Rate Limiter Middleware
 * Prevents brute force attacks on authentication endpoints
 */

const { pool } = require('../config/database');

// In-memory store for rate limiting (use Redis in production for multi-instance)
const loginAttempts = new Map();

const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,           // Max failed attempts
  windowMs: 15 * 60 * 1000, // 15 minutes window
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block after max attempts
};

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > RATE_LIMIT_CONFIG.windowMs) {
      loginAttempts.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Get client identifier (IP + username combination)
 */
const getClientKey = (req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
             req.connection?.remoteAddress ||
             req.socket?.remoteAddress ||
             req.ip;
  const username = req.body?.username || 'unknown';
  return `${ip}:${username}`;
};

/**
 * Record failed login attempt to database
 */
const recordFailedAttempt = async (username, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO login_attempts (username, ip_address, attempted_at, success)
       VALUES (?, ?, NOW(), FALSE)`,
      [username, ipAddress]
    );
  } catch (error) {
    console.error('Failed to record login attempt:', error);
  }
};

/**
 * Record successful login to database
 */
const recordSuccessfulLogin = async (username, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO login_attempts (username, ip_address, attempted_at, success)
       VALUES (?, ?, NOW(), TRUE)`,
      [username, ipAddress]
    );
    // Clear failed attempts for this user/IP on successful login
    const key = `${ipAddress}:${username}`;
    loginAttempts.delete(key);
  } catch (error) {
    console.error('Failed to record successful login:', error);
  }
};

/**
 * Check if IP/user is currently blocked
 */
const isBlocked = async (username, ipAddress) => {
  try {
    // Check recent failed attempts in database
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE (username = ? OR ip_address = ?)
       AND success = FALSE
       AND attempted_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)`,
      [username, ipAddress]
    );
    return rows[0].count >= RATE_LIMIT_CONFIG.maxAttempts;
  } catch (error) {
    console.error('Failed to check block status:', error);
    return false;
  }
};

/**
 * Rate limiter middleware for login endpoint
 */
const loginRateLimiter = async (req, res, next) => {
  const clientKey = getClientKey(req);
  const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
             req.connection?.remoteAddress || req.ip;
  const username = req.body?.username || '';

  // Check in-memory store first (faster)
  const attempts = loginAttempts.get(clientKey);
  const now = Date.now();

  if (attempts) {
    // Check if blocked
    if (attempts.blocked && now < attempts.blockedUntil) {
      const remainingMs = attempts.blockedUntil - now;
      const remainingMin = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        success: false,
        message: `Too many login attempts. Please try again in ${remainingMin} minutes.`,
        retryAfter: Math.ceil(remainingMs / 1000)
      });
    }

    // Reset if window expired
    if (now - attempts.firstAttempt > RATE_LIMIT_CONFIG.windowMs) {
      loginAttempts.delete(clientKey);
    }
  }

  // Also check database for persistent blocking
  const blocked = await isBlocked(username, ip);
  if (blocked) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again in 30 minutes.',
      retryAfter: 1800
    });
  }

  // Store reference to record attempt after response
  req.rateLimitKey = clientKey;
  req.rateLimitIp = ip;

  next();
};

/**
 * Record failed attempt (call after failed login)
 */
const recordFailedLogin = async (req) => {
  const clientKey = req.rateLimitKey;
  const ip = req.rateLimitIp;
  const username = req.body?.username || '';
  const now = Date.now();

  // Update in-memory store
  let attempts = loginAttempts.get(clientKey);
  if (!attempts) {
    attempts = { count: 0, firstAttempt: now, blocked: false };
  }

  attempts.count++;

  if (attempts.count >= RATE_LIMIT_CONFIG.maxAttempts) {
    attempts.blocked = true;
    attempts.blockedUntil = now + RATE_LIMIT_CONFIG.blockDurationMs;
  }

  loginAttempts.set(clientKey, attempts);

  // Record to database
  await recordFailedAttempt(username, ip);
};

/**
 * General API rate limiter (for all authenticated routes)
 */
const apiRateLimiter = (() => {
  const requests = new Map();
  const MAX_REQUESTS = 100; // per minute
  const WINDOW_MS = 60000;

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.connection?.remoteAddress || req.ip;
    const now = Date.now();

    let data = requests.get(ip);
    if (!data || now - data.windowStart > WINDOW_MS) {
      data = { count: 0, windowStart: now };
    }

    data.count++;
    requests.set(ip, data);

    if (data.count > MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((data.windowStart + WINDOW_MS - now) / 1000)
      });
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': MAX_REQUESTS,
      'X-RateLimit-Remaining': Math.max(0, MAX_REQUESTS - data.count),
      'X-RateLimit-Reset': Math.ceil((data.windowStart + WINDOW_MS) / 1000)
    });

    next();
  };
})();

module.exports = {
  loginRateLimiter,
  recordFailedLogin,
  recordSuccessfulLogin,
  apiRateLimiter
};
