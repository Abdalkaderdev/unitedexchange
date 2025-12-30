/**
 * JWT Configuration
 * Production-ready token management with refresh token strategy
 */
require('dotenv').config();

module.exports = {
  // Access token - short lived for security
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'access-secret-change-in-production',
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' // 15 minutes
  },

  // Refresh token - longer lived, stored in database
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // 7 days
    expiresInMs: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  },

  // Legacy support
  secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h'
};
