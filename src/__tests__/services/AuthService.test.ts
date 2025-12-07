import { AuthService } from '../../services/AuthService';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// Mock dependencies
jest.mock('../../infrastructure/database/UserRepository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../config', () => ({
  config: {
    auth: {
      jwtSecret: 'test-secret',
      jwtExpiresIn: '24h',
    },
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepositoryInstance: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock instance
    mockUserRepositoryInstance = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as any;

    // Mock the constructor to return our mock instance
    (UserRepository as jest.MockedClass<typeof UserRepository>).mockImplementation(() => {
      return mockUserRepositoryInstance;
    });

    authService = new AuthService();
  });

  describe('login', () => {
    it('should return token and userId when credentials are valid', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'password123';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        fullName: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const expectedToken = 'mock-jwt-token';

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue(expectedToken);

      // Act
      const result = await authService.login(username, password);

      // Assert
      expect(mockUserRepositoryInstance.findByUsername).toHaveBeenCalledWith(username);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: '1', username },
        'test-secret',
        { expiresIn: '24h' }
      );
      expect(result).toEqual({
        token: expectedToken,
        userId: '1',
      });
    });

    it('should throw error when user is not found', async () => {
      // Arrange
      const username = 'nonexistent';
      const password = 'password123';

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(username, password)).rejects.toThrow('Invalid credentials');
      expect(mockUserRepositoryInstance.findByUsername).toHaveBeenCalledWith(username);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    it('should throw error when password is invalid', async () => {
      // Arrange
      const username = 'testuser';
      const password = 'wrongpassword';
      const hashedPassword = 'hashed_password';
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        fullName: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(username, password)).rejects.toThrow('Invalid credentials');
      expect(mockUserRepositoryInstance.findByUsername).toHaveBeenCalledWith(username);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(jwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should create user and return user data when registration is successful', async () => {
      // Arrange
      const username = 'newuser';
      const email = 'newuser@example.com';
      const password = 'password123';
      const fullName = 'New User';
      const hashedPassword = 'hashed_password';
      const mockCreatedUser = {
        id: 5,
        username,
        email,
        passwordHash: hashedPassword,
        fullName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(null);
      mockUserRepositoryInstance.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserRepositoryInstance.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await authService.register(username, email, password, fullName);

      // Assert
      expect(mockUserRepositoryInstance.findByUsername).toHaveBeenCalledWith(username);
      expect(mockUserRepositoryInstance.findByEmail).toHaveBeenCalledWith(email);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(mockUserRepositoryInstance.create).toHaveBeenCalledWith({
        username,
        email,
        passwordHash: hashedPassword,
        fullName,
      });
      expect(result).toEqual({
        userId: '5',
        username,
        email,
        fullName,
      });
    });

    it('should create user without fullName when fullName is not provided', async () => {
      // Arrange
      const username = 'newuser';
      const email = 'newuser@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password';
      const mockCreatedUser = {
        id: 5,
        username,
        email,
        passwordHash: hashedPassword,
        fullName: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(null);
      mockUserRepositoryInstance.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserRepositoryInstance.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await authService.register(username, email, password);

      // Assert
      expect(mockUserRepositoryInstance.create).toHaveBeenCalledWith({
        username,
        email,
        passwordHash: hashedPassword,
        fullName: undefined,
      });
      expect(result.fullName).toBeUndefined();
    });

    it('should throw error when username already exists', async () => {
      // Arrange
      const username = 'existinguser';
      const email = 'newuser@example.com';
      const password = 'password123';
      const existingUser = {
        id: 1,
        username: 'existinguser',
        email: 'existing@example.com',
        passwordHash: 'hash',
        fullName: 'Existing User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(username, email, password)).rejects.toThrow(
        'Username already exists'
      );
      expect(mockUserRepositoryInstance.findByUsername).toHaveBeenCalledWith(username);
      expect(mockUserRepositoryInstance.findByEmail).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserRepositoryInstance.create).not.toHaveBeenCalled();
    });

    it('should throw error when email already exists', async () => {
      // Arrange
      const username = 'newuser';
      const email = 'existing@example.com';
      const password = 'password123';
      const existingUser = {
        id: 1,
        username: 'existinguser',
        email: 'existing@example.com',
        passwordHash: 'hash',
        fullName: 'Existing User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepositoryInstance.findByUsername.mockResolvedValue(null);
      mockUserRepositoryInstance.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(username, email, password)).rejects.toThrow(
        'Email already exists'
      );
      expect(mockUserRepositoryInstance.findByUsername).toHaveBeenCalledWith(username);
      expect(mockUserRepositoryInstance.findByEmail).toHaveBeenCalledWith(email);
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserRepositoryInstance.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should return decoded token when token is valid', async () => {
      // Arrange
      const token = 'valid-token';
      const decoded = {
        userId: '1',
        username: 'testuser',
      };

      (jwt.verify as jest.Mock).mockReturnValue(decoded);

      // Act
      const result = await authService.verifyToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(result).toEqual(decoded);
    });

    it('should throw error when token is invalid', async () => {
      // Arrange
      const token = 'invalid-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid or expired token');
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
    });

    it('should throw error when token is expired', async () => {
      // Arrange
      const token = 'expired-token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      // Act & Assert
      await expect(authService.verifyToken(token)).rejects.toThrow('Invalid or expired token');
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
    });
  });
});

