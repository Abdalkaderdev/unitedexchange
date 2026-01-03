/**
 * United Exchange API Server
 * Production-ready Express application
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const routes = require('./routes');
const swaggerSpec = require('./config/swagger');
const { testConnection } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiRateLimiter } = require('./middleware/rateLimiter');
const { sanitizeAll, securityHeaders } = require('./middleware/sanitize');
const { metricsMiddleware } = require('./middleware/metrics');
const logger = require('./utils/logger');

const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket auth middleware (optional, for now public info)
io.on('connection', (socket) => {
  // console.log('New client connected', socket.id);
  socket.on('disconnect', () => {
    // console.log('Client disconnected', socket.id);
  });
});

// Make io available in requests (optional, but we export it for controllers)
app.set('io', io);

const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(securityHeaders);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization
app.use(sanitizeAll);

// Metrics tracking
app.use(metricsMiddleware);

// API rate limiting (general)
app.use('/api', apiRateLimiter);

// Swagger API Documentation (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'United Exchange API Docs'
  }));
  // Serve swagger spec as JSON
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  // Test database connection
  const dbConnected = await testConnection();

  if (!dbConnected) {
    logger.error('Failed to connect to database. Please check your configuration.');
    process.exit(1);
  }

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`API available at: http://localhost:${PORT}/api`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`API Docs: http://localhost:${PORT}/api-docs`);
    }
  });
};

startServer();

// Export app and io for usage elsewhere if needed
module.exports = { app, io };
