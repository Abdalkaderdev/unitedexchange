/**
 * Authentication API Integration Tests
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = 'test-jwt-secret';

// Mock user store
const users = [
  {
    id: 1,
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    username: 'admin',
    email: 'admin@test.com',
    password: bcrypt.hashSync('Admin123!', 10),
    role: 'admin',
    is_active: true
  },
  {
    id: 2,
    uuid: '123e4567-e89b-12d3-a456-426614174001',
    username: 'employee',
    email: 'employee@test.com',
    password: bcrypt.hashSync('Employee123!', 10),
    role: 'employee',
    is_active: true
  }
];

// Create test app with mock auth
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const user = users.find(u => u.username === username);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { userId: user.id, uuid: user.uuid, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      token,
      user: {
        uuid: user.uuid,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  });

  // Protected endpoint
  app.get('/api/auth/profile', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = users.find(u => u.id === decoded.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: {
          uuid: user.uuid,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  });

  return app;
};

describe('Authentication API', () => {
  let app;
  let authToken;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'Admin123!' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe('admin');
      expect(response.body.user.role).toBe('admin');

      authToken = response.body.token;
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'Password123!' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password123!' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    beforeAll(async () => {
      // Get auth token
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'Admin123!' });
      authToken = response.body.token;
    });

    it('should return profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('admin');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 1, uuid: '123', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
