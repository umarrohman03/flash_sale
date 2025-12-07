import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { config } from '../../config';

const isProduction = process.env.NODE_ENV === 'production';
const apiPath = isProduction
  ? path.join(process.cwd(), 'dist', 'api', 'routes', '*.js')
  : path.join(process.cwd(), 'src', 'api', 'routes', '*.ts');
const appPath = isProduction
  ? path.join(process.cwd(), 'dist', 'api', 'app.js')
  : path.join(process.cwd(), 'src', 'api', 'app.ts');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Flash Sale API',
      version: '1.0.0',
      description: 'High-performance flash sale backend service API documentation',
      contact: {
        name: 'Flash Sale API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    // Don't apply security globally - only to specific endpoints
    // security: [{ bearerAuth: [] }],  // Removed - apply per endpoint instead
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Authentication',
        description: 'User authentication endpoints',
      },
          {
            name: 'Flash Sale',
            description: 'Flash sale operations (requires authentication)',
          },
          {
            name: 'Orders',
            description: 'Order management operations (requires authentication)',
          },
    ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'Enter JWT token obtained from /api/auth/login',
            },
          },
          schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Validation error',
            },
            message: {
              type: 'string',
              example: 'userId is required',
            },
          },
        },
        FlashSaleStatus: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Flash sale ID',
              example: 1,
            },
            status: {
              type: 'string',
              enum: ['upcoming', 'active', 'ended'],
              example: 'active',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T23:59:59.000Z',
            },
            currentTime: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00.000Z',
            },
            productName: {
              type: 'string',
              description: 'Product name',
              example: 'Premium Smartphone',
            },
            productDescription: {
              type: 'string',
              description: 'Product description',
              example: 'Latest model smartphone with advanced features',
            },
          },
        },
        StatusResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              $ref: '#/components/schemas/FlashSaleStatus',
            },
          },
        },
        AttemptPurchaseResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Your purchase attempt has been received and is being processed.',
            },
          },
        },
            HealthResponse: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  example: 'ok',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-01T12:00:00.000Z',
                },
              },
            },
            LoginRequest: {
              type: 'object',
              required: ['username', 'password'],
              properties: {
                username: {
                  type: 'string',
                  description: 'Username',
                  example: 'admin',
                },
                password: {
                  type: 'string',
                  description: 'Password',
                  example: 'admin123',
                  format: 'password',
                },
              },
            },
            LoginResponse: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                  example: true,
                },
                data: {
                  type: 'object',
                  properties: {
                    token: {
                      type: 'string',
                      description: 'JWT token for authentication',
                      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    },
                    userId: {
                      type: 'string',
                      description: 'User ID',
                      example: '1',
                    },
                  },
                },
              },
            },
            RegisterRequest: {
              type: 'object',
              required: ['username', 'email', 'password'],
              properties: {
                username: {
                  type: 'string',
                  description: 'Username (must be unique)',
                  example: 'newuser',
                  minLength: 1,
                },
                email: {
                  type: 'string',
                  description: 'Email address (must be unique)',
                  example: 'newuser@example.com',
                  format: 'email',
                },
                password: {
                  type: 'string',
                  description: 'Password (minimum 6 characters)',
                  example: 'password123',
                  format: 'password',
                  minLength: 6,
                },
                fullName: {
                  type: 'string',
                  description: 'Full name (optional)',
                  example: 'New User',
                },
              },
            },
            RegisterResponse: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                  example: true,
                },
                data: {
                  type: 'object',
                  properties: {
                    userId: {
                      type: 'string',
                      description: 'User ID',
                      example: '5',
                    },
                    username: {
                      type: 'string',
                      description: 'Username',
                      example: 'newuser',
                    },
                    email: {
                      type: 'string',
                      description: 'Email address',
                      example: 'newuser@example.com',
                    },
                    fullName: {
                      type: 'string',
                      description: 'Full name',
                      example: 'New User',
                      nullable: true,
                    },
                  },
                },
              },
            },
            Order: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: 'Order ID',
                  example: 1,
                },
                userId: {
                  type: 'string',
                  description: 'User ID',
                  example: '2',
                },
                productId: {
                  type: 'string',
                  description: 'Product ID',
                  example: '1',
                },
                saleId: {
                  type: 'integer',
                  description: 'Flash sale ID',
                  example: 1,
                },
                status: {
                  type: 'string',
                  enum: ['PENDING', 'SUCCESS', 'FAILED'],
                  description: 'Order status',
                  example: 'SUCCESS',
                },
                attemptId: {
                  type: 'string',
                  format: 'uuid',
                  description: 'Purchase attempt ID',
                  example: '550e8400-e29b-41d4-a716-446655440000',
                  nullable: true,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Order creation timestamp',
                  example: '2025-12-05T18:22:29.521Z',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Order last update timestamp',
                  example: '2025-12-05T18:22:29.521Z',
                },
              },
            },
            OrderStatusResponse: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                  example: true,
                },
                data: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Order',
                  },
                },
              },
            },
          },
      responses: {
        BadRequest: {
          description: 'Bad request - validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  apis: [apiPath, appPath],
};

export const swaggerSpec = swaggerJsdoc(options);

