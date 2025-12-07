import request from 'supertest';
import { createTestApp, createTestToken } from './setup';
import { TestAppContext } from './setup';

describe('Orders Integration Tests', () => {
  let testContext: TestAppContext;
  let authToken: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    testContext = createTestApp();
    authToken = await createTestToken(testContext.authService, '1', 'testuser');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/orders/status/:productId', () => {
    it('should return SUCCESS status when result is true in Redis', async () => {
      // Arrange
      const productId = 1;
      const userId = '1';

      testContext.redisService.getUserResult.mockResolvedValue(true); // SUCCESS

      // Act
      const response = await request(testContext.app)
        .get(`/api/orders/status/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        productId: productId,
        userId: userId,
        status: 'SUCCESS',
      });
      expect(testContext.redisService.getUserResult).toHaveBeenCalledWith(userId, String(productId));
    });

    it('should return FAILED status when result is false in Redis', async () => {
      // Arrange
      const productId = 1;
      const userId = '1';

      testContext.redisService.getUserResult.mockResolvedValue(false); // FAILED

      // Act
      const response = await request(testContext.app)
        .get(`/api/orders/status/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        productId: productId,
        userId: userId,
        status: 'FAILED',
      });
      expect(testContext.redisService.getUserResult).toHaveBeenCalledWith(userId, String(productId));
    });

    it('should return 400 when result key does not exist in Redis', async () => {
      // Arrange
      const productId = 1;
      const userId = '1';

      testContext.redisService.getUserResult.mockResolvedValue(null); // Key doesn't exist

      // Act
      const response = await request(testContext.app)
        .get(`/api/orders/status/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Order status not found');
      expect(testContext.redisService.getUserResult).toHaveBeenCalledWith(userId, String(productId));
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/api/orders/status/1')
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'No token provided. Please include a Bearer token in the Authorization header.',
      });
    });

    it('should return 400 when productId is invalid', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/api/orders/status/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'productId must be a positive integer',
      });
    });

    it('should return 400 when productId is zero', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/api/orders/status/0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'productId must be a positive integer',
      });
    });

    it('should return 400 when productId is negative', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/api/orders/status/-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'productId must be a positive integer',
      });
    });

    it('should handle redisService errors gracefully', async () => {
      // Arrange
      testContext.redisService.getUserResult.mockRejectedValue(
        new Error('Redis connection failed')
      );

      // Act
      const response = await request(testContext.app)
        .get('/api/orders/status/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error',
        message: 'Redis connection failed',
      });
    });

    it('should only return status for the authenticated user', async () => {
      // Arrange
      const productId = 1;

      const user1Token = await createTestToken(testContext.authService, '1', 'user1');
      const user2Token = await createTestToken(testContext.authService, '2', 'user2');

      // User 1's request
      testContext.redisService.getUserResult.mockResolvedValueOnce(true); // User 1: SUCCESS
      const response1 = await request(testContext.app)
        .get(`/api/orders/status/${productId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response1.body.data.userId).toBe('1');
      expect(response1.body.data.status).toBe('SUCCESS');

      // User 2's request
      testContext.redisService.getUserResult.mockResolvedValueOnce(false); // User 2: FAILED
      const response2 = await request(testContext.app)
        .get(`/api/orders/status/${productId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response2.body.data.userId).toBe('2');
      expect(response2.body.data.status).toBe('FAILED');
    });
  });
});
