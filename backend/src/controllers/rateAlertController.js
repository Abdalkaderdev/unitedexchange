const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logAudit, getClientIp, parseDecimal } = require('../utils/helpers');
const emailService = require('../services/emailService');

/**
 * Get all alerts for the current user
 */
const getAlerts = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const [alerts] = await pool.query(`
      SELECT 
        ra.uuid,
        ra.target_rate,
        ra.condition_type,
        ra.is_active,
        ra.created_at,
        ra.last_triggered_at,
        fc.code as from_currency,
        tc.code as to_currency
      FROM rate_alerts ra
      JOIN currencies fc ON ra.from_currency_id = fc.id
      JOIN currencies tc ON ra.to_currency_id = tc.id
      WHERE ra.user_id = ?
      ORDER BY ra.created_at DESC
    `, [userId]);

        res.json({
            success: true,
            data: alerts.map(a => ({
                uuid: a.uuid,
                targetRate: parseDecimal(a.target_rate),
                condition: a.condition_type,
                isActive: a.is_active,
                fromCurrency: a.from_currency,
                toCurrency: a.to_currency,
                createdAt: a.created_at,
                lastTriggeredAt: a.last_triggered_at
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new rate alert
 */
const createAlert = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fromCurrencyId, toCurrencyId, targetRate, condition } = req.body;

        // Validate inputs
        if (!fromCurrencyId || !toCurrencyId || !targetRate || !condition) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        if (!['above', 'below'].includes(condition)) {
            return res.status(400).json({
                success: false,
                message: 'Condition must be either "above" or "below"'
            });
        }

        const uuid = uuidv4();

        const [result] = await pool.query(`
      INSERT INTO rate_alerts 
      (uuid, user_id, from_currency_id, to_currency_id, target_rate, condition_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [uuid, userId, fromCurrencyId, toCurrencyId, targetRate, condition]);

        await logAudit(
            userId,
            'CREATE',
            'rate_alerts',
            result.insertId,
            null,
            { fromCurrencyId, toCurrencyId, targetRate, condition },
            getClientIp(req)
        );

        res.status(201).json({
            success: true,
            message: 'Alert created successfully',
            data: { uuid }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete an alert
 */
const deleteAlert = async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const userId = req.user.id;

        const [alerts] = await pool.query(
            'SELECT id FROM rate_alerts WHERE uuid = ? AND user_id = ?',
            [uuid, userId]
        );

        if (alerts.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        await pool.query('DELETE FROM rate_alerts WHERE id = ?', [alerts[0].id]);

        await logAudit(
            userId,
            'DELETE',
            'rate_alerts',
            alerts[0].id,
            null,
            null,
            getClientIp(req)
        );

        res.json({
            success: true,
            message: 'Alert deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Check active alerts against updated rates
 * matches: Array of { fromCurrencyId, toCurrencyId, buyRate, sellRate }
 */
const checkAlerts = async (matches) => {
    try {
        // Process each updated rate
        for (const match of matches) {
            const rate = parseFloat(match.buyRate); // Using buy rate for comparison usually

            // Find relevant active alerts
            const [alerts] = await pool.query(`
        SELECT ra.*, u.email, u.full_name, fc.code as from_code, tc.code as to_code
        FROM rate_alerts ra
        JOIN users u ON ra.user_id = u.id
        JOIN currencies fc ON ra.from_currency_id = fc.id
        JOIN currencies tc ON ra.to_currency_id = tc.id
        WHERE ra.is_active = TRUE
          AND ra.from_currency_id = ?
          AND ra.to_currency_id = ?
      `, [match.fromCurrencyId, match.toCurrencyId]);

            for (const alert of alerts) {
                const target = parseFloat(alert.target_rate);
                let triggered = false;

                if (alert.condition_type === 'above' && rate > target) {
                    triggered = true;
                } else if (alert.condition_type === 'below' && rate < target) {
                    triggered = true;
                }

                if (triggered) {
                    // Send email
                    await emailService.sendRateAlertEmail(
                        alert.email,
                        alert.full_name,
                        {
                            fromCurrency: alert.from_code,
                            toCurrency: alert.to_code,
                            rate: rate,
                            targetRate: target,
                            condition: alert.condition_type
                        }
                    );

                    // Update last_triggered_at (and optionally deactivate if one-time)
                    await pool.query(
                        'UPDATE rate_alerts SET last_triggered_at = NOW() WHERE id = ?',
                        [alert.id]
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error checking rate alerts:', error);
    }
};

module.exports = {
    getAlerts,
    createAlert,
    deleteAlert,
    checkAlerts
};
