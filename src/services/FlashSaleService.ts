// Single Responsibility Principle - handles flash sale business logic
// Open/Closed Principle - can be extended without modification
// Dependency Inversion Principle - depends on abstractions (interfaces)
import { IFlashSaleService } from '../domain/interfaces/IFlashSaleService';
import { IRedisService } from '../domain/interfaces/IRedisService';
import { IKafkaProducer } from '../domain/interfaces/IKafkaProducer';
import { IFlashSaleRepository } from '../domain/interfaces/IFlashSaleRepository';
import { FlashSaleStatus, FlashSaleStatusResponse } from '../domain/models/FlashSaleStatus';
import { FlashSaleAttempt } from '../domain/models/FlashSaleAttempt';
import { PurchaseAttemptRepository } from '../infrastructure/database/PurchaseAttemptRepository';
import { logger } from '../infrastructure/logger';

export class FlashSaleService implements IFlashSaleService {
  private purchaseAttemptRepository: PurchaseAttemptRepository;

  constructor(
    private redisService: IRedisService,
    private kafkaProducer: IKafkaProducer,
    private flashSaleRepository: IFlashSaleRepository
  ) {
    this.purchaseAttemptRepository = new PurchaseAttemptRepository();
  }

  async getStatus(): Promise<FlashSaleStatusResponse> {
    const now = new Date();
    
    // Get active flash sale from database
    let flashSale = await this.flashSaleRepository.findActive();
    
    // If no active flash sale, get the most recent one (could be upcoming or ended)
    if (!flashSale) {
      flashSale = await this.flashSaleRepository.findMostRecent();
    }
    
    if (!flashSale) {
      // No flash sale exists at all
      return {
        status: FlashSaleStatus.ENDED,
        startTime: now,
        endTime: now,
        currentTime: now,
        productName: undefined,
        productDescription: undefined,
        productId: undefined,
      };
    }

    let status: FlashSaleStatus;
    if (now < flashSale.startAt) {
      status = FlashSaleStatus.UPCOMING;
    } else if (now >= flashSale.startAt && now <= flashSale.endAt) {
      status = FlashSaleStatus.ACTIVE;
    } else {
      status = FlashSaleStatus.ENDED;
    }

    return {
      id: flashSale.id,
      status,
      startTime: flashSale.startAt,
      endTime: flashSale.endAt,
      currentTime: now,
      productName: flashSale.productName,
      productDescription: flashSale.productDescription,
      productId: flashSale.productId,
    };
  }

  async attemptPurchase(userId: string, saleId: number): Promise<{ success: boolean; message: string }> {
    // Get flash sale by ID
    const flashSale = await this.flashSaleRepository.findById(saleId);
    if (!flashSale) {
      return {
        success: false,
        message: `Flash sale with ID ${saleId} not found.`,
      };
    }

    // Check if flash sale is active
    const now = new Date();
    if (now < flashSale.startAt) {
      return {
        success: false,
        message: `Flash sale is not yet active. Start time: ${flashSale.startAt.toISOString()}`,
      };
    }

    if (now > flashSale.endAt) {
      return {
        success: false,
        message: `Flash sale has ended. End time: ${flashSale.endAt.toISOString()}`,
      };
    }

    const productId = String(flashSale.productId);

    // Ensure stock is initialized in Redis for this product
    // This handles cases where stock wasn't initialized on server startup
    // We check if the key EXISTS, not just if value is 0, because stock=0 means sold out, not uninitialized
    const stockKeyExists = await this.redisService.stockKeyExists(productId);
    if (!stockKeyExists) {
      // Stock key doesn't exist, initialize it now
      logger.info(`Stock key not found in Redis for product ${productId}, initializing with remaining_stock: ${flashSale.remainingStock}`);
      await this.redisService.initializeStock(productId, flashSale.remainingStock);
    }

    // Use atomic Lua script to attempt purchase
    // This atomically: checks if attempted, checks stock, decrements stock, adds to attempted set
    const attemptResult = await this.redisService.attemptPurchase(userId, productId);

    // If user already attempted, check their result
    if (!attemptResult.wasNewAttempt) {
      // User already attempted, check if they have a result
      const userStatus = await this.redisService.getUserStatus(userId, productId);
      if (userStatus.hasResult && userStatus.result !== null) {
        return {
          success: userStatus.result,
          message: userStatus.result
            ? 'You have successfully secured an item!'
            : 'Your purchase attempt was unsuccessful.',
        };
      }
      return {
        success: false,
        message: 'Your purchase attempt is being processed. Please check back shortly.',
      };
    }

    // Check if stock was available
    // success=1 means stock was available and decremented successfully
    // success=0 means stock was unavailable (already attempted or stock <= 0)
    if (!attemptResult.success) {
      // Stock depleted or unavailable, or user already attempted
      await this.redisService.setUserResult(userId, productId, false);
      return {
        success: false,
        message: 'Sorry, the item is out of stock.',
      };
    }

    // Send attempt to Kafka for async processing
    const attempt: FlashSaleAttempt = {
      userId,
      productId,
      saleId: saleId.toString(),
      timestamp: new Date(),
    };

    // Record purchase attempt to database (for audit/logging)
    // This is done asynchronously and won't block the request if it fails
    this.purchaseAttemptRepository.create(attempt)
      .then(() => {
        logger.info(`Purchase attempt recorded to database for user ${userId}, sale ${saleId}`);
      })
      .catch((error) => {
        logger.error(`Failed to record purchase attempt to database for user ${userId}:`, error);
        // Don't throw - we don't want to fail the purchase attempt if logging fails
      });

    try {
      await this.kafkaProducer.sendAttempt(attempt);
      logger.info(`Flash sale attempt sent to Kafka for user ${userId}, sale ${saleId}`);
    } catch (error) {
      logger.error(`Failed to send attempt to Kafka for user ${userId}:`, error);
      // Rollback: restore stock using Lua script
      await this.redisService.restoreStock(productId);
      // Note: User is already in attempted set, but worker will handle the result
      return {
        success: false,
        message: 'Failed to process your request. Please try again.',
      };
    }

    return {
      success: true,
      message: 'Your purchase attempt has been received and is being processed.',
    };
  }

}

