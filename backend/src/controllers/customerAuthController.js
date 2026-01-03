/**
 * Customer Authentication Controller
 * Handles customer login and profile management
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const jwtConfig = require('../config/jwt');
const { logAudit, getClientIp } = require('../utils/helpers');
const { BCRYPT_ROUNDS } = require('./authController');

/**
 * Customer Login
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const ipAddress = getClientIp(req);

        // Find customer
        const [customers] = await pool.query(
            `SELECT id, uuid, full_name, email, password, is_blocked, block_reason 
       FROM customers 
       WHERE email = ?`,
            [email]
        );

        if (customers.length === 0) {
            // Don't reveal user existence
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials.'
            });
        }

        const customer = customers[0];

        // Check if blocked
        if (customer.is_blocked) {
            await logAudit(null, 'CUSTOMER_LOGIN_BLOCKED', 'customers', customer.id, null,
                { reason: customer.block_reason }, ipAddress, 'warning');

            return res.status(403).json({
                success: false,
                message: 'Account is blocked. Please contact support.'
            });
        }

        // Check if password exists (first time login check)
        if (!customer.password) {
            return res.status(401).json({
                success: false,
                message: 'Account not set up. Please contact support to set a password.'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, customer.password);

        if (!isValidPassword) {
            await logAudit(null, 'CUSTOMER_LOGIN_FAILED', 'customers', customer.id, null,
                { reason: 'Invalid password' }, ipAddress, 'warning');

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials.'
            });
        }

        // Generate token (Customer-specific payload)
        const token = jwt.sign(
            {
                uuid: customer.uuid,
                id: customer.id,
                role: 'customer', // Distinct role
                type: 'access'
            },
            jwtConfig.accessToken.secret,
            { expiresIn: '24h' } // Longer session for customers typically
        );

        // Update last login
        await pool.query(
            'UPDATE customers SET last_login_at = NOW() WHERE id = ?',
            [customer.id]
        );

        await logAudit(null, 'CUSTOMER_LOGIN', 'customers', customer.id, null,
            { ip: ipAddress }, ipAddress, 'info');

        res.json({
            success: true,
            data: {
                token,
                customer: {
                    uuid: customer.uuid,
                    fullName: customer.full_name,
                    email: customer.email
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get Customer Profile
 */
const getProfile = async (req, res, next) => {
    try {
        const customerId = req.user.id; // Set by auth middleware

        const [customers] = await pool.query(
            `SELECT uuid, full_name, email, phone, id_type, id_number, address, 
              total_transactions, total_volume
       FROM customers 
       WHERE id = ?`,
            [customerId]
        );

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found.'
            });
        }

        res.json({
            success: true,
            data: customers[0]
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Set Initial Password (Admin or Setup link logic)
 * For simplicity in this phase, we expose an endpoint for customers to set password if they have a temp token, 
 * OR strictly allow admins to set it. 
 * Let's assume an Admin does it for now or we build a "Setup Account" flow later.
 * Actually, let's add a simple "Set Password" for the pilot that requires the Email and a "Setup Token" (reset_token).
 */
const setPassword = async (req, res, next) => {
    // Implementation deferred for brevity, assuming manual DB update for pilot as per plan verification step.
    // Or we can implement a proper reset flow if needed.
    // For now, let's execute the Manual Verification plan: "Manually set a password for a test customer via DB"
    res.status(501).json({ message: 'Not implemented' });
};

module.exports = {
    login,
    getProfile
};
