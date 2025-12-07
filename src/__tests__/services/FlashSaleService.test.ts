import { FlashSaleService } from '../../services/FlashSaleService';
import { IRedisService } from '../../domain/interfaces/IRedisService';
import { IKafkaProducer } from '../../domain/interfaces/IKafkaProducer';
import { IFlashSaleRepository } from '../../domain/interfaces/IFlashSaleRepository';
import { FlashSaleStatus } from '../../domain/models/FlashSaleStatus';
import { PurchaseAttemptRepository } from '../../infrastructure/database/PurchaseAttemptRepository';

// Mock dependencies
jest.mock('../../infrastructure/database/PurchaseAttemptRepository');

describe('FlashSaleService', () => {
  let flashSaleService: FlashSaleService;
  let mockRedisService: jest.Mocked<IRedisService>;
  let mockKafkaProducer: jest.Mocked<IKafkaProducer>;
  let mockFlashSaleRepository: jest.Mocked<IFlashSaleRepository>;
  let mockPurchaseAttemptRepositoryInstance: jest.Mocked<PurchaseAttemptRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocks
    mockRedisService = {
      attemptPurchase: jest.fn(),
      getUserStatus: jest.fn(),
      restoreStock: jest.fn(),
      decrementStock: jest.fn(),
      incrementStock: jest.fn(),
      getStock: jest.fn(),
      stockKeyExists: jest.fn(),
      initializeStock: jest.fn(),
      addUserToAttemptedSet: jest.fn(),
      isUserInAttemptedSet: jest.fn(),
      setUserResult: jest.fn(),
      getUserResult: jest.fn(),
      ping: jest.fn(),
    } as jest.Mocked<IRedisService>;

    mockKafkaProducer = {
      sendAttempt: jest.fn(),
      disconnect: jest.fn(),
    } as jest.Mocked<IKafkaProducer>;

    mockFlashSaleRepository = {
      findActive: jest.fn(),
      findById: jest.fn(),
      findMostRecent: jest.fn(),
      findByTimeWindow: jest.fn(),
      updateRemainingStock: jest.fn(),
    } as jest.Mocked<IFlashSaleRepository>;

    // Create a mock instance
    mockPurchaseAttemptRepositoryInstance = {
      create: jest.fn(),
    } as any;

    // Mock the constructor to return our mock instance
    (PurchaseAttemptRepository as jest.MockedClass<typeof PurchaseAttemptRepository>).mockImplementation(() => {
      return mockPurchaseAttemptRepositoryInstance;
    });

    flashSaleService = new FlashSaleService(
      mockRedisService,
      mockKafkaProducer,
      mockFlashSaleRepository
    );
  });

  describe('getStatus', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return active status when flash sale is currently active', async () => {
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

      mockFlashSaleRepository.findActive.mockResolvedValue(mockFlashSale);

      // Act
      const result = await flashSaleService.getStatus();

      // Assert
      expect(mockFlashSaleRepository.findActive).toHaveBeenCalled();
      expect(mockFlashSaleRepository.findMostRecent).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 1,
        status: FlashSaleStatus.ACTIVE,
        startTime: mockFlashSale.startAt,
        endTime: mockFlashSale.endAt,
        currentTime: new Date('2024-01-01T12:00:00Z'),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
        productId: 1,
      });
    });

    it('should return upcoming status when flash sale has not started', async () => {
      // Arrange
      jest.setSystemTime(new Date('2023-12-31T12:00:00Z'));

      const mockFlashSale = {
        id: 1,
        productId: 1,
        startAt: new Date('2024-01-01T00:00:00Z'),
        endAt: new Date('2024-01-01T23:59:59Z'),
        initialStock: 100,
        remainingStock: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
        productName: 'Premium Smartphone',
        productDescription: 'Latest model smartphone',
      };

      mockFlashSaleRepository.findActive.mockResolvedValue(null);
      mockFlashSaleRepository.findMostRecent.mockResolvedValue(mockFlashSale);

      // Act
      const result = await flashSaleService.getStatus();

      // Assert
      expect(mockFlashSaleRepository.findActive).toHaveBeenCalled();
      expect(mockFlashSaleRepository.findMostRecent).toHaveBeenCalled();
      expect(result.status).toBe(FlashSaleStatus.UPCOMING);

      jest.restoreAllMocks();
    });

    it('should return ended status when flash sale has ended', async () => {
      // Arrange
      jest.setSystemTime(new Date('2024-01-02T12:00:00Z'));

      const mockFlashSale = {
        id: 1,
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

      mockFlashSaleRepository.findActive.mockResolvedValue(null);
      mockFlashSaleRepository.findMostRecent.mockResolvedValue(mockFlashSale);

      // Act
      const result = await flashSaleService.getStatus();

      // Assert
      expect(result.status).toBe(FlashSaleStatus.ENDED);

      jest.restoreAllMocks();
    });

    it('should return ended status when no flash sale exists', async () => {
      // Arrange
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findActive.mockResolvedValue(null);
      mockFlashSaleRepository.findMostRecent.mockResolvedValue(null);

      // Act
      const result = await flashSaleService.getStatus();

      // Assert
      expect(mockFlashSaleRepository.findActive).toHaveBeenCalled();
      expect(mockFlashSaleRepository.findMostRecent).toHaveBeenCalled();
      const expectedNow = new Date('2024-01-01T12:00:00Z');
      expect(result).toEqual({
        status: FlashSaleStatus.ENDED,
        startTime: expectedNow,
        endTime: expectedNow,
        currentTime: expectedNow,
        productName: undefined,
        productDescription: undefined,
        productId: undefined,
      });

      jest.restoreAllMocks();
    });
  });

  describe('attemptPurchase', () => {
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

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should return success when purchase attempt is successful', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(true);
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: true,
      });
      mockKafkaProducer.sendAttempt.mockResolvedValue();
      mockPurchaseAttemptRepositoryInstance.create.mockResolvedValue(undefined);

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockFlashSaleRepository.findById).toHaveBeenCalledWith(saleId);
      expect(mockRedisService.stockKeyExists).toHaveBeenCalledWith('1');
      expect(mockRedisService.attemptPurchase).toHaveBeenCalledWith(userId, '1');
      expect(mockKafkaProducer.sendAttempt).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Your purchase attempt has been received and is being processed.',
      });
    });

    it('should initialize stock when stock key does not exist', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(false);
      mockRedisService.initializeStock.mockResolvedValue();
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: true,
      });
      mockKafkaProducer.sendAttempt.mockResolvedValue();
      mockPurchaseAttemptRepositoryInstance.create.mockResolvedValue(undefined);

      // Act
      await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockFlashSaleRepository.findById).toHaveBeenCalledWith(saleId);
      expect(mockRedisService.stockKeyExists).toHaveBeenCalledWith('1');
      expect(mockRedisService.initializeStock).toHaveBeenCalledWith('1', 50);
      expect(mockRedisService.attemptPurchase).toHaveBeenCalledWith(userId, '1');
    });

    it('should return error when flash sale is not found', async () => {
      // Arrange
      const userId = '1';
      const saleId = 999;

      mockFlashSaleRepository.findById.mockResolvedValue(null);

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockFlashSaleRepository.findById).toHaveBeenCalledWith(saleId);
      expect(result).toEqual({
        success: false,
        message: 'Flash sale with ID 999 not found.',
      });
      expect(mockRedisService.attemptPurchase).not.toHaveBeenCalled();
    });

    it('should return error when flash sale has not started', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z')); // Before start time
      const futureFlashSale = {
        ...mockFlashSale,
        startAt: new Date('2024-01-02T00:00:00Z'), // Starts tomorrow
      };

      mockFlashSaleRepository.findById.mockResolvedValue(futureFlashSale);

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockFlashSaleRepository.findById).toHaveBeenCalledWith(saleId);
      expect(result).toEqual({
        success: false,
        message: `Flash sale is not yet active. Start time: ${futureFlashSale.startAt.toISOString()}`,
      });
      expect(mockRedisService.stockKeyExists).not.toHaveBeenCalled();
      expect(mockRedisService.attemptPurchase).not.toHaveBeenCalled();
    });

    it('should return error when flash sale has ended', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-02T12:00:00Z')); // After end time
      const pastFlashSale = {
        ...mockFlashSale,
        endAt: new Date('2024-01-01T23:59:59Z'), // Ended yesterday
      };

      mockFlashSaleRepository.findById.mockResolvedValue(pastFlashSale);

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockFlashSaleRepository.findById).toHaveBeenCalledWith(saleId);
      expect(result).toEqual({
        success: false,
        message: `Flash sale has ended. End time: ${pastFlashSale.endAt.toISOString()}`,
      });
      expect(mockRedisService.stockKeyExists).not.toHaveBeenCalled();
      expect(mockRedisService.attemptPurchase).not.toHaveBeenCalled();
    });

    it('should return error when stock is out', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(true);
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: false,
        remainingStock: 0,
        wasNewAttempt: true,
      });
      mockRedisService.setUserResult.mockResolvedValue();

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockFlashSaleRepository.findById).toHaveBeenCalledWith(saleId);
      expect(mockRedisService.stockKeyExists).toHaveBeenCalledWith('1');
      expect(mockRedisService.attemptPurchase).toHaveBeenCalledWith(userId, '1');
      expect(mockRedisService.setUserResult).toHaveBeenCalledWith(userId, '1', false);
      expect(result).toEqual({
        success: false,
        message: 'Sorry, the item is out of stock.',
      });
      expect(mockKafkaProducer.sendAttempt).not.toHaveBeenCalled();
    });

    it('should return success message when user already attempted and has successful result', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(true);
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: false,
      });
      mockRedisService.getUserStatus.mockResolvedValue({
        hasAttempted: true,
        hasResult: true,
        result: true,
      });

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockRedisService.getUserStatus).toHaveBeenCalledWith(userId, '1');
      expect(result).toEqual({
        success: true,
        message: 'You have successfully secured an item!',
      });
      expect(mockKafkaProducer.sendAttempt).not.toHaveBeenCalled();
    });

    it('should return failure message when user already attempted and has failed result', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(true);
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: false,
        remainingStock: 0,
        wasNewAttempt: false,
      });
      mockRedisService.getUserStatus.mockResolvedValue({
        hasAttempted: true,
        hasResult: true,
        result: false,
      });

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Your purchase attempt was unsuccessful.',
      });
    });

    it('should return processing message when user already attempted but no result yet', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(true);
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: false,
      });
      mockRedisService.getUserStatus.mockResolvedValue({
        hasAttempted: true,
        hasResult: false,
        result: null,
      });

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Your purchase attempt is being processed. Please check back shortly.',
      });
    });

    it('should restore stock and return error when Kafka send fails', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(true);
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: true,
      });
      mockPurchaseAttemptRepositoryInstance.create.mockResolvedValue(undefined);
      mockKafkaProducer.sendAttempt.mockRejectedValue(new Error('Kafka connection failed'));
      mockRedisService.restoreStock.mockResolvedValue(50);

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      expect(mockRedisService.restoreStock).toHaveBeenCalledWith('1');
      expect(result).toEqual({
        success: false,
        message: 'Failed to process your request. Please try again.',
      });
    });

    it('should not throw when purchase attempt repository create fails', async () => {
      // Arrange
      const userId = '1';
      const saleId = 1;
      jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      mockFlashSaleRepository.findById.mockResolvedValue(mockFlashSale);
      mockRedisService.stockKeyExists.mockResolvedValue(true);
      mockRedisService.attemptPurchase.mockResolvedValue({
        success: true,
        remainingStock: 49,
        wasNewAttempt: true,
      });
      mockKafkaProducer.sendAttempt.mockResolvedValue();
      mockPurchaseAttemptRepositoryInstance.create.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await flashSaleService.attemptPurchase(userId, saleId);

      // Assert
      // Should not throw, purchase attempt logging failure should not block the request
      expect(result.success).toBe(true);
    });
  });
});

