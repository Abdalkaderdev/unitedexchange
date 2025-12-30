/**
 * Health Routes
 * System health and monitoring endpoints
 */
const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns OK status - used by load balancers
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', healthController.getHealth);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check (admin only)
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed system health
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                     total:
 *                       type: number
 *                 database:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     latency:
 *                       type: number
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/detailed', authenticate, authorize('admin'), healthController.getDetailedHealth);

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Performance metrics (admin only)
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRequests:
 *                   type: integer
 *                 requestsPerSecond:
 *                   type: number
 *                 averageResponseTime:
 *                   type: number
 *                 statusCodes:
 *                   type: object
 *                   additionalProperties:
 *                     type: integer
 *                 endpoints:
 *                   type: object
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/metrics', authenticate, authorize('admin'), healthController.getMetrics);

/**
 * @swagger
 * /health/metrics/reset:
 *   post:
 *     summary: Reset metrics counters (admin only)
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/metrics/reset', authenticate, authorize('admin'), healthController.resetMetrics);

module.exports = router;
