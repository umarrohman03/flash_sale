import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import cors, { CorsOptions } from 'cors';
import { IFlashSaleService } from '../domain/interfaces/IFlashSaleService';
import { IAuthService } from '../domain/interfaces/IAuthService';
import { IRedisService } from '../domain/interfaces/IRedisService';
import { createFlashSaleRoutes } from './routes/flashSaleRoutes';
import { createAuthRoutes } from './routes/authRoutes';
import { createOrderRoutes } from './routes/orderRoutes';
import { createAuthMiddleware } from './middleware/authMiddleware';
import { swaggerSpec } from './swagger/swagger.config';

export function createApp(
  flashSaleService: IFlashSaleService,
  authService: IAuthService,
  redisService: IRedisService
): Express {
  const app = express();

  // CORS configuration - Allow requests from frontend
  // Enable CORS for all routes - must be before other middleware
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // In development, allow all localhost origins
      if (process.env.NODE_ENV !== 'production') {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }
      
      // In production, check against allowed origins
      const allowedOrigins = process.env.FRONTEND_URL 
        ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
        : ['http://localhost:5173'];
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} is not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: [],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
  
  app.use(cors(corsOptions));

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Flash Sale API Documentation',
  }));

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   */
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Authentication routes (public)
  app.use('/api/auth', createAuthRoutes(authService));

  // Protected API routes
  const authMiddleware = createAuthMiddleware(authService);
  app.use('/api/flash-sale', authMiddleware, createFlashSaleRoutes(flashSaleService));
  app.use('/api/orders', authMiddleware, createOrderRoutes(redisService));

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

