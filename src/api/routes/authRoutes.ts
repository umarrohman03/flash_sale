import { Router, Request, Response } from 'express';
import { IAuthService } from '../../domain/interfaces/IAuthService';
import { logger } from '../../infrastructure/logger';

export function createAuthRoutes(authService: IAuthService): Router {
  const router = Router();

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: User login
   *     description: Authenticate user and receive JWT token for accessing protected endpoints
   *     tags: [Authentication]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *           example:
   *             username: admin
   *             password: admin123
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginResponse'
   *             example:
   *               success: true
   *               data:
   *                 token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *                 userId: "1"
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               success: false
   *               error: "Unauthorized"
   *               message: "Invalid credentials"
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: User registration
   *     description: Register a new user account. Username and email must be unique.
   *     tags: [Authentication]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RegisterRequest'
   *           example:
   *             username: newuser
   *             email: newuser@example.com
   *             password: password123
   *             fullName: New User
   *     responses:
   *       201:
   *         description: Registration successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RegisterResponse'
   *             example:
   *               success: true
   *               data:
   *                 userId: "5"
   *                 username: newuser
   *                 email: newuser@example.com
   *                 fullName: New User
   *       400:
   *         description: Validation error or username/email already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             examples:
   *               validationError:
   *                 value:
   *                   success: false
   *                   error: "Validation error"
   *                   message: "username, email, and password are required"
   *               usernameExists:
   *                 value:
   *                   success: false
   *                   error: "Conflict"
   *                   message: "Username already exists"
   *               emailExists:
   *                 value:
   *                   success: false
   *                   error: "Conflict"
   *                   message: "Email already exists"
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { username, email, password, fullName } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'username, email, and password are required',
        });
      }

      // Validate email format (basic)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid email format',
        });
      }

      // Validate password length (minimum 6 characters)
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Password must be at least 6 characters long',
        });
      }

      const result = await authService.register(username, email, password, fullName);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Registration error:', error);
      
      if (error.message === 'Username already exists' || error.message === 'Email already exists') {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to process registration',
      });
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'username and password are required',
        });
      }

      const result = await authService.login(username, password);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Login error:', error);
      
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to process login',
      });
    }
  });

  return router;
}

