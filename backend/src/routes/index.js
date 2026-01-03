/**
 * API Routes Index
 * Aggregates all route modules
 */
const express = require('express');
const router = express.Router();

// Route modules
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const currencyRoutes = require('./currencyRoutes');
const transactionRoutes = require('./transactionRoutes');
const reportRoutes = require('./reportRoutes');
const customerRoutes = require('./customerRoutes');
const cashDrawerRoutes = require('./cashDrawerRoutes');
const shiftRoutes = require('./shiftRoutes');
const complianceRoutes = require('./complianceRoutes');
const healthRoutes = require('./healthRoutes');
const scheduledReportRoutes = require('./scheduledReportRoutes');
const filterPresetRoutes = require('./filterPresetRoutes');
const auditRoutes = require('./auditRoutes');
const permissionRoutes = require('./permissionRoutes');
const rateAlertRoutes = require('./rateAlertRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/currencies', currencyRoutes);
router.use('/transactions', transactionRoutes);
router.use('/reports', reportRoutes);
router.use('/customers', customerRoutes);
router.use('/cash-drawers', cashDrawerRoutes);
router.use('/shifts', shiftRoutes);
router.use('/compliance', complianceRoutes);
router.use('/health', healthRoutes);
router.use('/scheduled-reports', scheduledReportRoutes);
router.use('/filter-presets', filterPresetRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/permissions', permissionRoutes);
router.use('/rate-alerts', rateAlertRoutes);

module.exports = router;
