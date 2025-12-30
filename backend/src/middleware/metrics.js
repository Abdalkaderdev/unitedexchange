/**
 * Metrics Middleware
 * Tracks request count, response times, and error rates
 */
const { recordRequest } = require('../controllers/healthController');

/**
 * Request metrics middleware
 */
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture metrics
  res.end = function (chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Get endpoint (normalize dynamic params)
    let endpoint = req.route ? req.route.path : req.path;
    endpoint = `${req.method} ${endpoint}`;

    // Record metrics
    recordRequest(endpoint, res.statusCode, responseTime);

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

module.exports = { metricsMiddleware };
