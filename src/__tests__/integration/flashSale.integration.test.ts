import request from 'supertest';
import { createTestApp, createTestToken } from './setup';
import { TestAppContext } from './setup';
import { FlashSaleStatus } from '../../domain/models/FlashSaleStatus';

describe('Flash Sale Integration Tests', () => {
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

  describe('GET /api/flash-sale/status', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return flash sale status when authenticated', async () => {
      // Arrange
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const mockFlashSale = {
        id: 1,
        productId: 1,
        startAt: new Date('2024-01-01T00:00:00Z'),
        endAt: new Date('2024-01-01T23:59:59Z'),
        initialStock: 100,
        remainingStock: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
      };

      testContext.flashSaleRepository.findActive.mockResolvedValue(mockFlashSale);

      // Act
      const response = await request(testContext.app)
        .get('/api/flash-sale/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 1,
        status: FlashSaleStatus.ACTIVE,
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
      });
      expect(response.body.data).toHaveProperty('startTime');
      expect(response.body.data).toHaveProperty('endTime');
      expect(response.body.data).toHaveProperty('currentTime');
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/api/flash-sale/status')
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'No token provided. Please include a Bearer token in the Authorization header.',
      });
    });

    it('should return 401 when token is invalid', async () => {
      // Act
      const response = await request(testContext.app)
        .get('/api/flash-sale/status')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      testContext.flashSaleRepository.findActive.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const response = await request(testContext.app)
        .get('/api/flash-sale/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error',
        message: 'Database connection failed',
      });
    });
  });

  describe('POST /api/flash-sale/attempt/:saleId', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should successfully attempt purchase when authenticated and stock available', async () => {
      // Arrange
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const saleId = 1;
      const mockFlashSale = {
        id: saleId,
        productId: 1,
        startAt: new Date('2024-01-01T00:00:00Z'),
        endAt: new Date('2024-01-01T23:59:59Z'),
        initialStock: 100,
        remainingStock: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
      };

      testContext.flashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      testContext.redisService.stockKeyExists.mockResolvedValue(true);
      testContext.redisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: true,
      });
      testContext.kafkaProducer.sendAttempt.mockResolvedValue();

      // Act
      const response = await request(testContext.app)
        .post(`/api/flash-sale/attempt/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        message: 'Your purchase attempt has been received and is being processed.',
      });
      expect(testContext.flashSaleRepository.findById).toHaveBeenCalledWith(saleId);
      expect(testContext.redisService.attemptPurchase).toHaveBeenCalledWith('1', '1');
      expect(testContext.kafkaProducer.sendAttempt).toHaveBeenCalled();
    });

    it('should return 401 when not authenticated', async () => {
      // Act
      const response = await request(testContext.app)
        .post('/api/flash-sale/attempt/1')
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Unauthorized',
        message: 'No token provided. Please include a Bearer token in the Authorization header.',
      });
    });

    it('should return 400 when saleId is invalid', async () => {
      // Act
      const response = await request(testContext.app)
        .post('/api/flash-sale/attempt/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'saleId must be a positive integer',
      });
    });

    it('should return 400 when flash sale is not found', async () => {
      // Arrange
      testContext.flashSaleRepository.findById.mockResolvedValue(null);

      // Act
      const response = await request(testContext.app)
        .post('/api/flash-sale/attempt/999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        message: 'Flash sale with ID 999 not found.',
      });
    });

    it('should return 400 when flash sale has not started', async () => {
      // Arrange
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z')); // Before start time
      const saleId = 1;
      const futureFlashSale = {
        id: saleId,
        productId: 1,
        startAt: new Date('2024-01-02T00:00:00Z'), // Starts tomorrow
        endAt: new Date('2024-01-02T23:59:59Z'),
        initialStock: 100,
        remainingStock: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
      };

      testContext.flashSaleRepository.findById.mockResolvedValue(futureFlashSale);

      // Act
      const response = await request(testContext.app)
        .post(`/api/flash-sale/attempt/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Flash sale is not yet active');
    });

    it('should return 400 when item is out of stock', async () => {
      // Arrange
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const saleId = 1;
      const mockFlashSale = {
        id: saleId,
        productId: 1,
        startAt: new Date('2024-01-01T00:00:00Z'),
        endAt: new Date('2024-01-01T23:59:59Z'),
        initialStock: 100,
        remainingStock: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
      };

      testContext.flashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      testContext.redisService.stockKeyExists.mockResolvedValue(true);
      testContext.redisService.attemptPurchase.mockResolvedValue({
        success: false,
        remainingStock: 0,
        wasNewAttempt: true,
      });
      testContext.redisService.setUserResult.mockResolvedValue();

      // Act
      const response = await request(testContext.app)
        .post(`/api/flash-sale/attempt/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        message: 'Sorry, the item is out of stock.',
      });
    });

    it('should initialize stock when stock key does not exist', async () => {
      // Arrange
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const saleId = 1;
      const mockFlashSale = {
        id: saleId,
        productId: 1,
        startAt: new Date('2024-01-01T00:00:00Z'),
        endAt: new Date('2024-01-01T23:59:59Z'),
        initialStock: 100,
        remainingStock: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
      };

      testContext.flashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      testContext.redisService.stockKeyExists.mockResolvedValue(false);
      testContext.redisService.initializeStock.mockResolvedValue();
      testContext.redisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: true,
      });
      testContext.kafkaProducer.sendAttempt.mockResolvedValue();

      // Act
      await request(testContext.app)
        .post(`/api/flash-sale/attempt/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(testContext.redisService.initializeStock).toHaveBeenCalledWith('1', 50);
    });
  });
});

