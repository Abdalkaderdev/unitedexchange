/**
 * Swagger/OpenAPI Configuration
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'United Exchange API',
      version: '1.0.0',
      description: 'API documentation for United Exchange money exchange system',
      contact: {
        name: 'United Exchange Support',
        email: 'support@unitedexchange.com'
      }
    },
    servers: [
      {
        url: '/api',
        description: 'API Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string' },
            full_name: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'manager', 'teller'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Currency: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            code: { type: 'string', example: 'USD' },
            name: { type: 'string', example: 'US Dollar' },
            name_ar: { type: 'string', example: 'دولار أمريكي' },
            name_ku: { type: 'string', example: 'دۆلاری ئەمریکی' },
            symbol: { type: 'string', example: '$' },
            buy_rate: { type: 'number', example: 1450.00 },
            sell_rate: { type: 'number', example: 1455.00 },
            is_active: { type: 'boolean' },
            decimal_places: { type: 'integer', example: 2 }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            transaction_number: { type: 'string' },
            transaction_type: { type: 'string', enum: ['buy', 'sell'] },
            from_currency_id: { type: 'integer' },
            to_currency_id: { type: 'integer' },
            from_amount: { type: 'number' },
            to_amount: { type: 'number' },
            exchange_rate: { type: 'number' },
            customer_name: { type: 'string' },
            customer_phone: { type: 'string' },
            notes: { type: 'string' },
            status: { type: 'string', enum: ['completed', 'cancelled'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            customer_number: { type: 'string' },
            full_name: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            id_type: { type: 'string' },
            id_number: { type: 'string' },
            address: { type: 'string' },
            is_active: { type: 'boolean' },
            total_transactions: { type: 'integer' },
            total_volume: { type: 'number' }
          }
        },
        CashDrawer: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            location: { type: 'string' },
            status: { type: 'string', enum: ['open', 'closed', 'reconciling'] },
            assigned_user_id: { type: 'integer' }
          }
        },
        Shift: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            cash_drawer_id: { type: 'integer' },
            start_time: { type: 'string', format: 'date-time' },
            end_time: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['active', 'closed', 'handed_over', 'abandoned'] }
          }
        },
        ComplianceAlert: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            rule_id: { type: 'integer' },
            transaction_id: { type: 'integer' },
            customer_id: { type: 'integer' },
            alert_type: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            status: { type: 'string', enum: ['new', 'reviewing', 'escalated', 'resolved', 'dismissed'] }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Currencies', description: 'Currency and exchange rates' },
      { name: 'Transactions', description: 'Exchange transactions' },
      { name: 'Customers', description: 'Customer management' },
      { name: 'Cash Drawers', description: 'Cash drawer operations' },
      { name: 'Shifts', description: 'Shift management' },
      { name: 'Compliance', description: 'KYC and compliance' },
      { name: 'Reports', description: 'Reports and analytics' },
      { name: 'Health', description: 'System health and monitoring' }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
