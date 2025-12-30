/**
 * Transaction API Integration Tests
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = 'test-jwt-secret';

// Mock data
const transactions = [];

// Create test app with mock endpoints
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Auth middleware
  const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    try {
      const token = authHeader.split(' ')[1];
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  };

  // Get transactions
  app.get('/api/transactions', authenticate, (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    let filtered = [...transactions];

    if (status && status !== 'all') {
      filtered = filtered.filter(t => t.status === status);
    }

    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + parseInt(limit));

    res.json({
      success: true,
      transactions: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit)
      }
    });
  });

  // Create transaction
  app.post('/api/transactions', authenticate, (req, res) => {
    const {
      customerName,
      currencyInId,
      currencyOutId,
      amountIn,
      amountOut,
      exchangeRate
    } = req.body;

    // Validation
    if (!customerName && !req.body.customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer name or ID is required'
      });
    }

    if (!currencyInId || !currencyOutId || !amountIn || !amountOut || !exchangeRate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (amountIn <= 0 || amountOut <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amounts must be positive'
      });
    }

    const transaction = {
      id: transactions.length + 1,
      uuid: uuidv4(),
      transaction_number: `TXN-${Date.now()}`,
      customer_name: customerName,
      currency_in_id: currencyInId,
      currency_out_id: currencyOutId,
      amount_in: parseFloat(amountIn),
      amount_out: parseFloat(amountOut),
      exchange_rate: parseFloat(exchangeRate),
      status: 'completed',
      created_by: req.user.userId,
      created_at: new Date().toISOString()
    };

    transactions.push(transaction);

    res.status(201).json({
      success: true,
      message: 'Transaction created',
      transaction
    });
  });

  // Get single transaction
  app.get('/api/transactions/:uuid', authenticate, (req, res) => {
    const transaction = transactions.find(t => t.uuid === req.params.uuid);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      transaction
    });
  });

  // Cancel transaction
  app.post('/api/transactions/:uuid/cancel', authenticate, (req, res) => {
    const transaction = transactions.find(t => t.uuid === req.params.uuid);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Transaction already cancelled'
      });
    }

    transaction.status = 'cancelled';
    transaction.cancelled_at = new Date().toISOString();
    transaction.cancelled_by = req.user.userId;
    transaction.cancel_reason = req.body.reason;

    res.json({
      success: true,
      message: 'Transaction cancelled',
      transaction
    });
  });

  return app;
};

describe('Transaction API', () => {
  let app;
  let authToken;
  let createdTransactionUuid;

  beforeAll(() => {
    app = createTestApp();

    authToken = jwt.sign(
      { userId: 1, uuid: 'user-uuid', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    // Clear transactions before each test
    transactions.length = 0;
  });

  describe('POST /api/transactions', () => {
    it('should create a transaction with valid data', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'John Doe',
          currencyInId: 1,
          currencyOutId: 3,
          amountIn: 100,
          amountOut: 145000,
          exchangeRate: 1450
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction.customer_name).toBe('John Doe');
      expect(response.body.transaction.amount_in).toBe(100);
      expect(response.body.transaction.status).toBe('completed');

      createdTransactionUuid = response.body.transaction.uuid;
    });

    it('should reject transaction without customer', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currencyInId: 1,
          currencyOutId: 3,
          amountIn: 100,
          amountOut: 145000,
          exchangeRate: 1450
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject negative amounts', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'John Doe',
          currencyInId: 1,
          currencyOutId: 3,
          amountIn: -100,
          amountOut: 145000,
          exchangeRate: 1450
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          customerName: 'John Doe',
          currencyInId: 1,
          currencyOutId: 3,
          amountIn: 100,
          amountOut: 145000,
          exchangeRate: 1450
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      // Create some transactions
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'Customer 1',
          currencyInId: 1,
          currencyOutId: 3,
          amountIn: 100,
          amountOut: 145000,
          exchangeRate: 1450
        });

      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'Customer 2',
          currencyInId: 2,
          currencyOutId: 3,
          amountIn: 50,
          amountOut: 79000,
          exchangeRate: 1580
        });
    });

    it('should return paginated transactions', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.transactions)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.transactions.length).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/transactions/:uuid', () => {
    let transactionUuid;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'Test Customer',
          currencyInId: 1,
          currencyOutId: 3,
          amountIn: 100,
          amountOut: 145000,
          exchangeRate: 1450
        });
      transactionUuid = response.body.transaction.uuid;
    });

    it('should return transaction by UUID', async () => {
      const response = await request(app)
        .get(`/api/transactions/${transactionUuid}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction.uuid).toBe(transactionUuid);
    });

    it('should return 404 for non-existent UUID', async () => {
      const response = await request(app)
        .get('/api/transactions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/transactions/:uuid/cancel', () => {
    let transactionUuid;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerName: 'Test Customer',
          currencyInId: 1,
          currencyOutId: 3,
          amountIn: 100,
          amountOut: 145000,
          exchangeRate: 1450
        });
      transactionUuid = response.body.transaction.uuid;
    });

    it('should cancel transaction', async () => {
      const response = await request(app)
        .post(`/api/transactions/${transactionUuid}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Customer request' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transaction.status).toBe('cancelled');
    });

    it('should not cancel already cancelled transaction', async () => {
      // First cancellation
      await request(app)
        .post(`/api/transactions/${transactionUuid}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Customer request' });

      // Second cancellation should fail
      const response = await request(app)
        .post(`/api/transactions/${transactionUuid}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Another reason' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Transaction already cancelled');
    });
  });
});
