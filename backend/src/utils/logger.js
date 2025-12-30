/**
 * Winston Logger Configuration
 * File and console logging with rotation
 */
const winston = require('winston');
const path = require('path');

// Log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// Log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Console format (with colors)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create transports
const transports = [];

// Console transport (development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
}

// File transports (always)
const logsDir = path.join(__dirname, '../../logs');

// Error log
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
);

// Combined log
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
);

// HTTP requests log
transports.push(
  new winston.transports.File({
    filename: path.join(logsDir, 'http.log'),
    level: 'http',
    format,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  transports
});

// Stream for Morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Helper methods
logger.logRequest = (req, res, responseTime) => {
  const { method, originalUrl, ip } = req;
  const { statusCode } = res;

  logger.http(`${method} ${originalUrl} ${statusCode} ${responseTime}ms`, {
    ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id
  });
};

logger.logError = (error, req = null) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code
  };

  if (req) {
    errorInfo.method = req.method;
    errorInfo.url = req.originalUrl;
    errorInfo.ip = req.ip;
    errorInfo.userId = req.user?.id;
  }

  logger.error(error.message, errorInfo);
};

logger.logAudit = (userId, action, resource, details) => {
  logger.info(`AUDIT: ${action} on ${resource}`, {
    userId,
    action,
    resource,
    ...details
  });
};

module.exports = logger;
