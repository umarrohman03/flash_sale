import request from 'supertest';
import { createTestApp, createTestToken } from './setup';
import { TestAppContext } from './setup';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('Auth Integration Tests', () => {
  let testContext: TestAppContext;
  let mockUserRepositoryInstance: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup UserRepository mock before creating test app
    mockUserRepositoryInstance = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    } as any;

    (UserRepository as jest.MockedClass<typeof UserRepository>).mockImplementation(() => {
      return mockUserRepositoryInstance;
    });

    testContext = createTestApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        fullName: 'New User',
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(null);
      mockUserRepositoryInstance.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockUserRepositoryInstance.create.mockResolvedValue({
        id: 5,
        username: userData.username,
        email: userData.email,
        passwordHash: 'hashed_password',
        fullName: userData.fullName,
      });

      // Act
      const response = await request(testContext.app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          userId: '5',
          username: userData.username,
          email: userData.email,
          fullName: userData.fullName,
        },
      });
      expect(mockUserRepositoryInstance.findByUsername).toHaveBeenCalledWith(userData.username);
      expect(mockUserRepositoryInstance.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockUserRepositoryInstance.create).toHaveBeenCalled();
    });

    it('should return 400 when required fields are missing', async () => {
      // Act
      const response = await request(testContext.app)
        .post('/api/auth/register')
        .send({ username: 'testuser' })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'username, email, and password are required',
      });
    });

    it('should return 400 when email format is invalid', async () => {
      // Act
      const response = await request(testContext.app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'password123',
        })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'Invalid email format',
      });
    });

    it('should return 409 when username already exists', async () => {
      // Arrange
      const userData = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'password123',
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue({
        id: 1,
        username: 'existinguser',
        email: 'existing@example.com',
        passwordHash: 'hash',
        fullName: 'Existing User',
      });

      // Act
      const response = await request(testContext.app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Conflict',
        message: 'Username already exists',
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully and return token', async () => {
      // Arrange
      const loginData = {
        username: 'testuser',
        password: 'password123',
      };

      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const response = await request(testContext.app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data.userId).toBe('1');
      expect(typeof response.body.data.token).toBe('string');
    });

    it('should return 400 when username is missing', async () => {
      // Act
      const response = await request(testContext.app)
        .post('/api/auth/login')
        .send({ password: 'password123' })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'username and password are required',
      });
    });

    it('should return 401 when credentials are invalid', async () => {
      // Arrange
      mockUserRepositoryInstance.findByUsername.mockResolvedValue(null);

      // Act
      const response = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        })
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    });

    it('should return 401 when password is incorrect', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        fullName: 'Test User',
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const response = await request(testContext.app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        })
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid credentials',
      });
    });
  });
});

