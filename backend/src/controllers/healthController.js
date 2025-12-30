/**
 * Health Controller
 * System health checks and metrics for monitoring
 */
const { pool } = require('../config/database');
const os = require('os');

// In-memory metrics storage
const metrics = {
  requests: {
    total: 0,
    byEndpoint: {},
    byStatus: {}
  },
  errors: {
    total: 0,
    byType: {}
  },
  responseTimes: [],
  startTime: Date.now()
};

/**
 * Basic health check (no auth required)
 */
const getHealth = async (req, res) => {
  try {
    // Quick database ping
    await pool.query('SELECT 1');

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Detailed health check (admin only)
 */
const getDetailedHealth = async (req, res, next) => {
  try {
    const startTime = Date.now();

    // Database check
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    try {
      const dbStart = Date.now();
      await pool.query('SELECT 1');
      dbResponseTime = Date.now() - dbStart;
    } catch (error) {
      dbStatus = 'unhealthy';
    }

    // System info
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = os.loadavg();

    // Calculate average response time
    const avgResponseTime = metrics.responseTimes.length > 0
      ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length
      : 0;

    res.json({
      status: dbStatus,
      timestamp: new Date().toISOString(),
      server: {
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        uptimeSeconds: uptime,
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
      },
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      cpu: {
        loadAverage: {
          '1min': cpuUsage[0].toFixed(2),
          '5min': cpuUsage[1].toFixed(2),
          '15min': cpuUsage[2].toFixed(2)
        },
        cores: os.cpus().length
      },
      database: {
        status: dbStatus,
        responseTime: `${dbResponseTime}ms`
      },
      performance: {
        avgResponseTime: `${Math.round(avgResponseTime)}ms`,
        totalRequests: metrics.requests.total,
        totalErrors: metrics.errors.total
      },
      responseTime: `${Date.now() - startTime}ms`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get performance metrics (admin only)
 */
const getMetrics = async (req, res, next) => {
  try {
    const uptime = Date.now() - metrics.startTime;
    const requestsPerSecond = metrics.requests.total / (uptime / 1000);

    // Get top endpoints by request count
    const topEndpoints = Object.entries(metrics.requests.byEndpoint)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    // Response time percentiles
    const sortedTimes = [...metrics.responseTimes].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    res.json({
      success: true,
      data: {
        uptime: `${Math.floor(uptime / 1000 / 60)}m`,
        requests: {
          total: metrics.requests.total,
          perSecond: requestsPerSecond.toFixed(2),
          byStatus: metrics.requests.byStatus,
          topEndpoints
        },
        errors: {
          total: metrics.errors.total,
          rate: metrics.requests.total > 0
            ? ((metrics.errors.total / metrics.requests.total) * 100).toFixed(2) + '%'
            : '0%',
          byType: metrics.errors.byType
        },
        responseTimes: {
          count: metrics.responseTimes.length,
          p50: `${Math.round(p50)}ms`,
          p90: `${Math.round(p90)}ms`,
          p99: `${Math.round(p99)}ms`
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset metrics (admin only)
 */
const resetMetrics = async (req, res) => {
  metrics.requests = { total: 0, byEndpoint: {}, byStatus: {} };
  metrics.errors = { total: 0, byType: {} };
  metrics.responseTimes = [];
  metrics.startTime = Date.now();

  res.json({
    success: true,
    message: 'Metrics reset successfully.'
  });
};

/**
 * Record request metrics (used by middleware)
 */
const recordRequest = (endpoint, statusCode, responseTime) => {
  metrics.requests.total++;
  metrics.requests.byEndpoint[endpoint] = (metrics.requests.byEndpoint[endpoint] || 0) + 1;
  metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;

  // Keep last 1000 response times
  metrics.responseTimes.push(responseTime);
  if (metrics.responseTimes.length > 1000) {
    metrics.responseTimes.shift();
  }

  if (statusCode >= 400) {
    metrics.errors.total++;
    const errorType = statusCode >= 500 ? 'server' : 'client';
    metrics.errors.byType[errorType] = (metrics.errors.byType[errorType] || 0) + 1;
  }
};

module.exports = {
  getHealth,
  getDetailedHealth,
  getMetrics,
  resetMetrics,
  recordRequest
};
