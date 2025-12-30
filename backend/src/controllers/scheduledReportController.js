/**
 * Scheduled Report Controller
 * Handles CRUD operations for scheduled reports
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const schedulerService = require('../services/schedulerService');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Create a new scheduled report
 */
const createSchedule = async (req, res, next) => {
  try {
    const {
      name,
      reportType,
      scheduleType,
      scheduleDay,
      scheduleTime,
      recipients,
      exportFormat,
      filters
    } = req.body;

    const uuid = uuidv4();
    const ipAddress = getClientIp(req);

    // Validate recipients is an array of valid emails
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipients must be a non-empty array of email addresses'
      });
    }

    // Create the schedule
    const result = await schedulerService.scheduleReport({
      uuid,
      name,
      reportType,
      scheduleType,
      scheduleDay: scheduleType === 'weekly' ? scheduleDay : null,
      scheduleTime: scheduleTime || '08:00:00',
      recipients,
      exportFormat: exportFormat || 'xlsx',
      filters,
      createdBy: req.user.id
    });

    // Log audit
    await logAudit(
      req.user.id,
      'CREATE',
      'scheduled_reports',
      uuid,
      null,
      {
        name,
        reportType,
        scheduleType,
        recipients
      },
      ipAddress,
      'info'
    );

    res.status(201).json({
      success: true,
      message: 'Scheduled report created successfully',
      data: {
        uuid,
        name,
        reportType,
        scheduleType,
        scheduleDay,
        scheduleTime: scheduleTime || '08:00:00',
        recipients,
        exportFormat: exportFormat || 'xlsx',
        filters,
        nextRunAt: result.nextRunAt,
        createdBy: req.user.full_name
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all scheduled reports with pagination
 */
const listSchedules = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;

    const result = await schedulerService.listSchedules({
      page: parseInt(page),
      limit: parseInt(limit),
      isActive: isActive !== undefined ? isActive === 'true' : null
    });

    res.json({
      success: true,
      data: result.schedules.map(schedule => ({
        uuid: schedule.uuid,
        name: schedule.name,
        reportType: schedule.report_type,
        scheduleType: schedule.schedule_type,
        scheduleDay: schedule.schedule_day,
        scheduleTime: schedule.schedule_time,
        recipients: JSON.parse(schedule.recipients),
        exportFormat: schedule.export_format,
        filters: schedule.filters ? JSON.parse(schedule.filters) : null,
        isActive: Boolean(schedule.is_active),
        lastRunAt: schedule.last_run_at,
        nextRunAt: schedule.next_run_at,
        createdBy: schedule.created_by_name,
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at
      })),
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single scheduled report by UUID
 */
const getSchedule = async (req, res, next) => {
  try {
    const { uuid } = req.params;

    const [schedules] = await pool.query(`
      SELECT
        sr.*,
        u.full_name as created_by_name,
        u.email as created_by_email
      FROM scheduled_reports sr
      JOIN users u ON sr.created_by = u.id
      WHERE sr.uuid = ?
    `, [uuid]);

    if (schedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    const schedule = schedules[0];

    res.json({
      success: true,
      data: {
        uuid: schedule.uuid,
        name: schedule.name,
        reportType: schedule.report_type,
        scheduleType: schedule.schedule_type,
        scheduleDay: schedule.schedule_day,
        scheduleTime: schedule.schedule_time,
        recipients: JSON.parse(schedule.recipients),
        exportFormat: schedule.export_format,
        filters: schedule.filters ? JSON.parse(schedule.filters) : null,
        isActive: Boolean(schedule.is_active),
        lastRunAt: schedule.last_run_at,
        nextRunAt: schedule.next_run_at,
        createdBy: {
          name: schedule.created_by_name,
          email: schedule.created_by_email
        },
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a scheduled report
 */
const updateSchedule = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const {
      name,
      reportType,
      scheduleType,
      scheduleDay,
      scheduleTime,
      recipients,
      exportFormat,
      filters,
      isActive
    } = req.body;

    const ipAddress = getClientIp(req);

    // Get existing schedule
    const [existing] = await pool.query(
      'SELECT * FROM scheduled_reports WHERE uuid = ?',
      [uuid]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    const oldSchedule = existing[0];

    // Build update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (reportType !== undefined) {
      updates.push('report_type = ?');
      params.push(reportType);
    }
    if (scheduleType !== undefined) {
      updates.push('schedule_type = ?');
      params.push(scheduleType);
    }
    if (scheduleDay !== undefined) {
      updates.push('schedule_day = ?');
      params.push(scheduleDay);
    }
    if (scheduleTime !== undefined) {
      updates.push('schedule_time = ?');
      params.push(scheduleTime);
    }
    if (recipients !== undefined) {
      updates.push('recipients = ?');
      params.push(JSON.stringify(recipients));
    }
    if (exportFormat !== undefined) {
      updates.push('export_format = ?');
      params.push(exportFormat);
    }
    if (filters !== undefined) {
      updates.push('filters = ?');
      params.push(filters ? JSON.stringify(filters) : null);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Update next run time if schedule changed
    const newScheduleType = scheduleType || oldSchedule.schedule_type;
    const newScheduleDay = scheduleDay !== undefined ? scheduleDay : oldSchedule.schedule_day;
    const newScheduleTime = scheduleTime || oldSchedule.schedule_time;

    const nextRunAt = schedulerService.calculateNextRunTime(
      newScheduleType,
      newScheduleDay,
      newScheduleTime
    );

    updates.push('next_run_at = ?');
    params.push(nextRunAt);

    // Execute update
    params.push(uuid);
    await pool.query(
      `UPDATE scheduled_reports SET ${updates.join(', ')} WHERE uuid = ?`,
      params
    );

    // Log audit
    await logAudit(
      req.user.id,
      'UPDATE',
      'scheduled_reports',
      uuid,
      {
        name: oldSchedule.name,
        reportType: oldSchedule.report_type,
        scheduleType: oldSchedule.schedule_type,
        isActive: oldSchedule.is_active
      },
      req.body,
      ipAddress,
      'info'
    );

    // Get updated schedule
    const [updated] = await pool.query(
      'SELECT * FROM scheduled_reports WHERE uuid = ?',
      [uuid]
    );

    const schedule = updated[0];

    res.json({
      success: true,
      message: 'Scheduled report updated successfully',
      data: {
        uuid: schedule.uuid,
        name: schedule.name,
        reportType: schedule.report_type,
        scheduleType: schedule.schedule_type,
        scheduleDay: schedule.schedule_day,
        scheduleTime: schedule.schedule_time,
        recipients: JSON.parse(schedule.recipients),
        exportFormat: schedule.export_format,
        filters: schedule.filters ? JSON.parse(schedule.filters) : null,
        isActive: Boolean(schedule.is_active),
        lastRunAt: schedule.last_run_at,
        nextRunAt: schedule.next_run_at,
        updatedAt: schedule.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a scheduled report
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const ipAddress = getClientIp(req);

    // Get existing schedule
    const [existing] = await pool.query(
      'SELECT * FROM scheduled_reports WHERE uuid = ?',
      [uuid]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    const schedule = existing[0];

    // Cancel the schedule (deactivates it)
    await schedulerService.cancelSchedule(uuid);

    // Delete from database
    await pool.query('DELETE FROM scheduled_reports WHERE uuid = ?', [uuid]);

    // Log audit
    await logAudit(
      req.user.id,
      'DELETE',
      'scheduled_reports',
      uuid,
      {
        name: schedule.name,
        reportType: schedule.report_type,
        scheduleType: schedule.schedule_type
      },
      null,
      ipAddress,
      'warning'
    );

    res.json({
      success: true,
      message: 'Scheduled report deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually trigger a scheduled report
 */
const runNow = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const ipAddress = getClientIp(req);

    // Check if schedule exists
    const [existing] = await pool.query(
      'SELECT * FROM scheduled_reports WHERE uuid = ?',
      [uuid]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    const schedule = existing[0];

    // Log that we're starting execution
    logger.info('Manual execution triggered for scheduled report', {
      uuid,
      name: schedule.name,
      triggeredBy: req.user.full_name
    });

    // Execute the schedule
    await schedulerService.runScheduleNow(uuid);

    // Log audit
    await logAudit(
      req.user.id,
      'EXECUTE',
      'scheduled_reports',
      uuid,
      null,
      {
        name: schedule.name,
        reportType: schedule.report_type,
        manualTrigger: true
      },
      ipAddress,
      'info'
    );

    // Get updated schedule
    const [updated] = await pool.query(
      'SELECT last_run_at, next_run_at FROM scheduled_reports WHERE uuid = ?',
      [uuid]
    );

    res.json({
      success: true,
      message: 'Scheduled report executed successfully',
      data: {
        uuid,
        name: schedule.name,
        lastRunAt: updated[0].last_run_at,
        nextRunAt: updated[0].next_run_at
      }
    });
  } catch (error) {
    logger.error('Failed to execute scheduled report manually', {
      uuid: req.params.uuid,
      error: error.message
    });

    if (error.message === 'Schedule not found') {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    next(error);
  }
};

/**
 * Get schedule execution history (if you add a history table later)
 */
const getScheduleHistory = async (req, res, next) => {
  try {
    const { uuid } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check if schedule exists
    const [existing] = await pool.query(
      'SELECT id, name FROM scheduled_reports WHERE uuid = ?',
      [uuid]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found'
      });
    }

    // For now, return audit logs related to this schedule
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [logs] = await pool.query(`
      SELECT
        al.id,
        al.action,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.created_at,
        u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.resource_type = 'scheduled_reports'
        AND al.resource_id = ?
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [uuid, parseInt(limit), offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total FROM audit_logs
      WHERE resource_type = 'scheduled_reports' AND resource_id = ?
    `, [uuid]);

    res.json({
      success: true,
      data: {
        schedule: {
          uuid,
          name: existing[0].name
        },
        history: logs.map(log => ({
          id: log.id,
          action: log.action,
          oldValues: log.old_values ? JSON.parse(log.old_values) : null,
          newValues: log.new_values ? JSON.parse(log.new_values) : null,
          ipAddress: log.ip_address,
          userName: log.user_name,
          createdAt: log.created_at
        }))
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSchedule,
  listSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  runNow,
  getScheduleHistory
};
