import { Request, Response } from 'express';
import { createAuthRoutes } from '../../api/routes/authRoutes';
import { IAuthService } from '../../domain/interfaces/IAuthService';
import { createMockRequest, createMockResponse, createMockAuthService } from '../utils/testHelpers';

describe('Auth Routes', () => {
  let authService: jest.Mocked<IAuthService>;
  let router: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    authService = createMockAuthService();
    router = createAuthRoutes(authService);
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 with token when login is successful', async () => {
      // Arrange
      const loginData = {
        username: 'testuser',
        password: 'password123',
      };
      const expectedToken = 'mock-jwt-token';
      const expectedUserId = '1';

      mockRequest.body = loginData;
      authService.login.mockResolvedValue({
        token: expectedToken,
        userId: expectedUserId,
      });

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/login' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.login).toHaveBeenCalledWith(loginData.username, loginData.password);
      // Note: Express defaults to 200 status, so status() may not be called explicitly
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: expectedToken,
          userId: expectedUserId,
        },
      });
    });

    it('should return 400 when username is missing', async () => {
      // Arrange
      mockRequest.body = { password: 'password123' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/login' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.login).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'username and password are required',
      });
    });

    it('should return 400 when password is missing', async () => {
      // Arrange
      mockRequest.body = { username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/login' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.login).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'username and password are required',
      });
    });

    it('should return 401 when credentials are invalid', async () => {
      // Arrange
      mockRequest.body = {
        username: 'testuser',
        password: 'wrongpassword',
      };
      authService.login.mockRejectedValue(new Error('Invalid credentials'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/login' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.login).toHaveBeenCalledWith('testuser', 'wrongpassword');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    });

    it('should return 500 when an unexpected error occurs', async () => {
      // Arrange
      mockRequest.body = {
        username: 'testuser',
        password: 'password123',
      };
      authService.login.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/login' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.login).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Database connection failed',
      });
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 201 when registration is successful', async () => {
      // Arrange
      const registerData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      };
      const expectedUser = {
        userId: '5',
        username: 'newuser',
        email: 'newuser@example.com',
        fullName: 'New User',
      };

      mockRequest.body = registerData;
      authService.register.mockResolvedValue(expectedUser);

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).toHaveBeenCalledWith(
        registerData.username,
        registerData.email,
        registerData.password,
        registerData.fullName
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expectedUser,
      });
    });

    it('should return 400 when username is missing', async () => {
      // Arrange
      mockRequest.body = {
        email: 'user@example.com',
        password: 'password123',
      };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'username, email, and password are required',
      });
    });

    it('should return 400 when email is missing', async () => {
      // Arrange
      mockRequest.body = {
        username: 'newuser',
        password: 'password123',
      };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when password is missing', async () => {
      // Arrange
      mockRequest.body = {
        username: 'newuser',
        email: 'user@example.com',
      };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when email format is invalid', async () => {
      // Arrange
      mockRequest.body = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'password123',
      };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'Invalid email format',
      });
    });

    it('should return 400 when password is too short', async () => {
      // Arrange
      mockRequest.body = {
        username: 'newuser',
        email: 'user@example.com',
        password: '12345', // Less than 6 characters
      };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'Password must be at least 6 characters long',
      });
    });

    it('should return 409 when username already exists', async () => {
      // Arrange
      mockRequest.body = {
        username: 'existinguser',
        email: 'user@example.com',
        password: 'password123',
      };
      authService.register.mockRejectedValue(new Error('Username already exists'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Conflict',
        message: 'Username already exists',
      });
    });

    it('should return 409 when email already exists', async () => {
      // Arrange
      mockRequest.body = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'password123',
      };
      authService.register.mockRejectedValue(new Error('Email already exists'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Conflict',
        message: 'Email already exists',
      });
    });

    it('should return 500 when an unexpected error occurs', async () => {
      // Arrange
      mockRequest.body = {
        username: 'newuser',
        email: 'user@example.com',
        password: 'password123',
      };
      authService.register.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/register' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(authService.register).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Database connection failed',
      });
    });
  });
});

