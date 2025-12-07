import { Request, Response } from 'express';
import { createFlashSaleRoutes } from '../../api/routes/flashSaleRoutes';
import { IFlashSaleService } from '../../domain/interfaces/IFlashSaleService';
import { FlashSaleStatus } from '../../domain/models/FlashSaleStatus';
import { createMockRequest, createMockResponse, createMockFlashSaleService } from '../utils/testHelpers';

describe('Flash Sale Routes', () => {
  let flashSaleService: jest.Mocked<IFlashSaleService>;
  let router: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    flashSaleService = createMockFlashSaleService();
    router = createFlashSaleRoutes(flashSaleService);
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/flash-sale/status', () => {
    it('should return 200 with active flash sale status', async () => {
      // Arrange
      const expectedStatus = {
        id: 1,
        status: FlashSaleStatus.ACTIVE,
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T23:59:59Z'),
        currentTime: new Date('2024-01-01T12:00:00Z'),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
        productId: 1,
      };

      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.getStatus.mockResolvedValue(expectedStatus);

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.getStatus).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expectedStatus,
      });
    });

    it('should return 200 with upcoming flash sale status', async () => {
      // Arrange
      const expectedStatus = {
        id: 1,
        status: FlashSaleStatus.UPCOMING,
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T23:59:59Z'),
        currentTime: new Date('2023-12-31T12:00:00Z'),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
        productId: 1,
      };

      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.getStatus.mockResolvedValue(expectedStatus);

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.getStatus).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expectedStatus,
      });
    });

    it('should return 200 with ended flash sale status', async () => {
      // Arrange
      const expectedStatus = {
        status: FlashSaleStatus.ENDED,
        startTime: new Date('2024-01-01T00:00:00Z'),
        endTime: new Date('2024-01-01T23:59:59Z'),
        currentTime: new Date('2024-01-02T12:00:00Z'),
        productName: undefined,
        productDescription: undefined,
        productId: undefined,
      };

      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.getStatus.mockResolvedValue(expectedStatus);

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.getStatus).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expectedStatus,
      });
    });

    it('should return 500 when service throws an error', async () => {
      // Arrange
      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.getStatus.mockRejectedValue(new Error('Database error'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/status' && r.route?.methods.get);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.getStatus).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Database error',
      });
    });
  });

  describe('POST /api/flash-sale/attempt/:saleId', () => {
    it('should return 200 when purchase attempt is successful', async () => {
      // Arrange
      const saleId = '1';
      mockRequest.params = { saleId };
      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.attemptPurchase.mockResolvedValue({
        success: true,
        message: 'Your purchase attempt has been received and is being processed.',
      });

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).toHaveBeenCalledWith('1', 1);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Your purchase attempt has been received and is being processed.',
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      const saleId = '1';
      mockRequest.params = { saleId };
      mockRequest.user = undefined;

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        message: 'User authentication required. Please provide a valid token.',
      });
    });

    it('should return 400 when saleId is missing', async () => {
      // Arrange
      mockRequest.params = {};
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'saleId parameter is required',
      });
    });

    it('should return 400 when saleId is not a positive integer', async () => {
      // Arrange
      mockRequest.params = { saleId: 'invalid' };
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        message: 'saleId must be a positive integer',
      });
    });

    it('should return 400 when saleId is zero', async () => {
      // Arrange
      mockRequest.params = { saleId: '0' };
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when saleId is negative', async () => {
      // Arrange
      mockRequest.params = { saleId: '-1' };
      mockRequest.user = { userId: '1', username: 'testuser' };

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when flash sale is not found', async () => {
      // Arrange
      const saleId = '999';
      mockRequest.params = { saleId };
      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.attemptPurchase.mockResolvedValue({
        success: false,
        message: 'Flash sale with ID 999 not found.',
      });

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).toHaveBeenCalledWith('1', 999);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Flash sale with ID 999 not found.',
      });
    });

    it('should return 400 when flash sale is not active', async () => {
      // Arrange
      const saleId = '1';
      mockRequest.params = { saleId };
      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.attemptPurchase.mockResolvedValue({
        success: false,
        message: 'Flash sale is not yet active. Start time: 2024-01-01T00:00:00.000Z',
      });

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Flash sale is not yet active. Start time: 2024-01-01T00:00:00.000Z',
      });
    });

    it('should return 400 when item is out of stock', async () => {
      // Arrange
      const saleId = '1';
      mockRequest.params = { saleId };
      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.attemptPurchase.mockResolvedValue({
        success: false,
        message: 'Sorry, the item is out of stock.',
      });

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Sorry, the item is out of stock.',
      });
    });

    it('should return 400 when user already attempted', async () => {
      // Arrange
      const saleId = '1';
      mockRequest.params = { saleId };
      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.attemptPurchase.mockResolvedValue({
        success: false,
        message: 'Your purchase attempt is being processed. Please check back shortly.',
      });

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Your purchase attempt is being processed. Please check back shortly.',
      });
    });

    it('should return 500 when service throws an error', async () => {
      // Arrange
      const saleId = '1';
      mockRequest.params = { saleId };
      mockRequest.user = { userId: '1', username: 'testuser' };
      flashSaleService.attemptPurchase.mockRejectedValue(new Error('Database error'));

      // Act
      const route = router.stack.find((r: any) => r.route?.path === '/attempt/:saleId' && r.route?.methods.post);
      await route.route.stack[0].handle(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(flashSaleService.attemptPurchase).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'Database error',
      });
    });
  });
});

