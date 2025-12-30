/**
 * Currency API Integration Tests
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-jwt-secret';

// Mock currency store
const currencies = [
  { id: 1, code: 'USD', name: 'US Dollar', symbol: '$', is_active: true, decimal_places: 2 },
  { id: 2, code: 'EUR', name: 'Euro', symbol: '€', is_active: true, decimal_places: 2 },
  { id: 3, code: 'IQD', name: 'Iraqi Dinar', symbol: 'د.ع', is_active: true, decimal_places: 0 }
];

const exchangeRates = [
  { from_currency_id: 1, to_currency_id: 3, buy_rate: 1450, sell_rate: 1455 },
  { from_currency_id: 2, to_currency_id: 3, buy_rate: 1580, sell_rate: 1590 }
];

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

  const authorize = (role) => (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };

  // Get all currencies
  app.get('/api/currencies', authenticate, (req, res) => {
    res.json({
      success: true,
      currencies: currencies.filter(c => c.is_active)
    });
  });

  // Get exchange rates
  app.get('/api/currencies/rates', authenticate, (req, res) => {
    const rates = exchangeRates.map(rate => {
      const fromCurrency = currencies.find(c => c.id === rate.from_currency_id);
      const toCurrency = currencies.find(c => c.id === rate.to_currency_id);
      return {
        fromCurrency: fromCurrency.code,
        toCurrency: toCurrency.code,
        buyRate: rate.buy_rate,
        sellRate: rate.sell_rate
      };
    });

    res.json({ success: true, rates });
  });

  // Create currency (admin only)
  app.post('/api/currencies', authenticate, authorize('admin'), (req, res) => {
    const { code, name, symbol } = req.body;

    if (!code || !name || !symbol) {
      return res.status(400).json({
        success: false,
        message: 'Code, name, and symbol are required'
      });
    }

    if (code.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Currency code must be exactly 3 characters'
      });
    }

    if (currencies.find(c => c.code === code.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Currency already exists'
      });
    }

    const newCurrency = {
      id: currencies.length + 1,
      code: code.toUpperCase(),
      name,
      symbol,
      is_active: true,
      decimal_places: 2
    };

    currencies.push(newCurrency);

    res.status(201).json({
      success: true,
      message: 'Currency created',
      currency: newCurrency
    });
  });

  return app;
};

describe('Currency API', () => {
  let app;
  let adminToken;
  let employeeToken;

  beforeAll(() => {
    app = createTestApp();

    // Create tokens
    adminToken = jwt.sign(
      { userId: 1, uuid: 'admin-uuid', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    employeeToken = jwt.sign(
      { userId: 2, uuid: 'employee-uuid', role: 'employee' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  describe('GET /api/currencies', () => {
    it('should return all active currencies', async () => {
      const response = await request(app)
        .get('/api/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.currencies)).toBe(true);
      expect(response.body.currencies.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/currencies')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should allow employee access', async () => {
      const response = await request(app)
        .get('/api/currencies')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/currencies/rates', () => {
    it('should return exchange rates', async () => {
      const response = await request(app)
        .get('/api/currencies/rates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.rates)).toBe(true);
      expect(response.body.rates[0]).toHaveProperty('buyRate');
      expect(response.body.rates[0]).toHaveProperty('sellRate');
    });
  });

  describe('POST /api/currencies', () => {
    it('should allow admin to create currency', async () => {
      const response = await request(app)
        .post('/api/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'GBP',
          name: 'British Pound',
          symbol: '£'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.currency.code).toBe('GBP');
    });

    it('should reject duplicate currency code', async () => {
      const response = await request(app)
        .post('/api/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'USD',
          name: 'Another Dollar',
          symbol: '$'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Currency already exists');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .post('/api/currencies')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          code: 'CHF',
          name: 'Swiss Franc',
          symbol: 'CHF'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should validate currency code length', async () => {
      const response = await request(app)
        .post('/api/currencies')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'AB',
          name: 'Invalid Currency',
          symbol: 'X'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
