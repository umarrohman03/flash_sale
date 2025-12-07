import { Request, Response } from 'express';
import { createOrderRoutes } from '../../api/routes/orderRoutes';
import { IRedisService } from '../../domain/interfaces/IRedisService';
import { createMockRequest, createMockResponse, createMockRedisService } from '../utils/testHelpers';

describe('Order Routes', () => {
  let redisService: jest.Mocked<IRedisService>;
  let router: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    redisService = createMockRedisService();
    router = createOrderRoutes(redisService);
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orders/status/:productId', () => {
    it('should return 200 with SUCCESS status when result is true', async () => {
      // Arrange
      const productId = '1';
      const userId = '2';

      mockRequest.params = { productId };
      mockRequest.user = { userId, username: 'testuser' };
      redisService.getUserResult.mockResolvedValue(true); // SUCCESS

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).toHaveBeenCalledWith(userId, productId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          productId: 1,
          userId: userId,
          status: 'SUCCESS',
        },
      });
    });

    it('should return 200 with FAILED status when result is false', async () => {
      // Arrange
      const productId = '1';
      const userId = '2';

      mockRequest.params = { productId };
      mockRequest.user = { userId, username: 'testuser' };
      redisService.getUserResult.mockResolvedValue(false); // FAILED

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).toHaveBeenCalledWith(userId, productId);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          productId: 1,
          userId: userId,
          status: 'FAILED',
        },
      });
    });

    it('should return 400 when result key does not exist in Redis', async () => {
      // Arrange
      const productId = '1';
      const userId = '2';

      mockRequest.params = { productId };
      mockRequest.user = { userId, username: 'testuser' };
      redisService.getUserResult.mockResolvedValue(null); // Key doesn't exist

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).toHaveBeenCalledWith(userId, productId);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Bad Request',
        message: 'Order status not found. The purchase attempt may not have been processed yet or the key does not exist in Redis.',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      const productId = '1';
      mockRequest.params = { productId };
      mockRequest.user = undefined;

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'User authentication required. Please provide a valid token.',
      });
    });

    it('should return 400 when productId is missing', async () => {
      // Arrange
      mockRequest.params = {};
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'productId parameter is required',
      });
    });

    it('should return 400 when productId is not a positive integer', async () => {
      // Arrange
      mockRequest.params = { productId: 'invalid' };
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'productId must be a positive integer',
      });
    });

    it('should return 400 when productId is zero', async () => {
      // Arrange
      mockRequest.params = { productId: '0' };
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when productId is negative', async () => {
      // Arrange
      mockRequest.params = { productId: '-1' };
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 when redisService throws an error', async () => {
      // Arrange
      const productId = '1';
      const userId = '1';

      mockRequest.params = { productId };
      mockRequest.user = { userId, username: 'testuser' };
      redisService.getUserResult.mockRejectedValue(new Error('Redis connection failed'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status/:productId' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(redisService.getUserResult).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Redis connection failed',
      });
    });
  });
});
