/**
 * Input Sanitization Middleware
 * XSS protection, SQL injection detection, and input cleaning
 */

/**
 * Sanitize a string to prevent XSS
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;');
};

/**
 * Recursively sanitize object properties
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
};

/**
 * XSS sanitization middleware
 */
const sanitizeXSS = (req, res, next) => {
  // Don't sanitize these content types
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return next();
  }

  // Sanitize body, query, and params
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);

  next();
};

/**
 * SQL injection patterns to detect
 */
const sqlInjectionPatterns = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  /exec(\s|\+)+(s|x)p\w+/i,
  /UNION(\s+)ALL(\s+)SELECT/i,
  /UNION(\s+)SELECT/i,
  /INSERT(\s+)INTO/i,
  /DELETE(\s+)FROM/i,
  /DROP(\s+)TABLE/i,
  /UPDATE(\s+)SET/i,
  /SELECT(\s+)\*(\s+)FROM/i
];

/**
 * Check string for SQL injection patterns
 */
const hasSQLInjection = (str) => {
  if (typeof str !== 'string') return false;
  return sqlInjectionPatterns.some(pattern => pattern.test(str));
};

/**
 * Recursively check object for SQL injection
 */
const checkObjectForSQLInjection = (obj) => {
  if (obj === null || obj === undefined) return false;
  if (typeof obj === 'string') return hasSQLInjection(obj);
  if (typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(checkObjectForSQLInjection);

  return Object.values(obj).some(checkObjectForSQLInjection);
};

/**
 * SQL injection detection middleware
 */
const detectSQLInjection = (req, res, next) => {
  const suspicious =
    checkObjectForSQLInjection(req.body) ||
    checkObjectForSQLInjection(req.query) ||
    checkObjectForSQLInjection(req.params);

  if (suspicious) {
    console.warn('Potential SQL injection detected:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      success: false,
      message: 'Invalid input detected.'
    });
  }

  next();
};

/**
 * Remove null bytes from strings
 */
const removeNullBytes = (req, res, next) => {
  const clean = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return obj.replace(/\0/g, '');
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(clean);

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key.replace(/\0/g, '')] = clean(value);
    }
    return cleaned;
  };

  if (req.body) req.body = clean(req.body);
  if (req.query) req.query = clean(req.query);
  if (req.params) req.params = clean(req.params);

  next();
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * Combined sanitization middleware
 */
const sanitizeAll = (req, res, next) => {
  // Apply all sanitization in sequence
  removeNullBytes(req, res, () => {
    detectSQLInjection(req, res, () => {
      sanitizeXSS(req, res, next);
    });
  });
};

module.exports = {
  sanitizeXSS,
  detectSQLInjection,
  removeNullBytes,
  securityHeaders,
  sanitizeAll,
  sanitizeString,
  sanitizeObject
};
