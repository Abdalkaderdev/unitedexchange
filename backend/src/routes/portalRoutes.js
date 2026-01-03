const express = require('express');
const router = express.Router();
const customerAuthController = require('../controllers/customerAuthController');
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/login', customerAuthController.login);

// Protected routes
router.use(authenticate); // Reusing existing auth middleware which decodes JWT

// Middleware to ensure user is a customer
const requireCustomer = (req, res, next) => {
    if (req.user.role !== 'customer') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Customers only.'
        });
    }
    next();
};

router.use(requireCustomer);

router.get('/profile', customerAuthController.getProfile);

// Reusing transaction controller but we must ensure it filters by req.user.id (customer_id)
// We need to modify transactionController.getTransactions to handle 'customer' role context
router.get('/transactions', transactionController.getTransactions);

module.exports = router;
