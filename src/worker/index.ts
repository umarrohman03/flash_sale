// Worker service to process Kafka messages and create orders
import { KafkaConsumer } from '../infrastructure/kafka/KafkaConsumer';
import { RedisService } from '../infrastructure/redis/RedisService';
import { OrderRepository } from '../infrastructure/database/OrderRepository';
import { OrderStatus } from '../domain/models/Order';
import { FlashSaleAttempt } from '../domain/models/FlashSaleAttempt';
import { config } from '../config';
import { logger } from '../infrastructure/logger';

async function processFlashSaleAttempt(
  attempt: FlashSaleAttempt,
  redisService: RedisService,
  orderRepository: OrderRepository
): Promise<void> {
  const { userId, productId, saleId } = attempt;

  if (!saleId) {
    logger.error(`Missing saleId in attempt for user ${userId}`);
    await redisService.setUserResult(userId, productId, false);
    return;
  }

  const saleIdNum = parseInt(saleId, 10);

  try {
    // Check if user already has an order (idempotency)
      const existingOrder = await orderRepository.findByUserId(userId, saleIdNum);
      if (existingOrder) {
        logger.info(`Order already exists for user ${userId}, sale ${saleId}`);
        const status = String(existingOrder.status).toUpperCase();
        const isSuccess = status === 'SUCCESS' || status === OrderStatus.SUCCESS;
        await redisService.setUserResult(userId, productId, isSuccess);
        return;
      }

    // Check stock availability (double-check)
    // Note: Stock was already decremented in the API, so we check if it's >= 0
    const stock = await redisService.getStock(productId);
    if (stock < 0) {
      // Stock was already depleted when decremented
      logger.info(`Stock depleted for user ${userId}`);
      await redisService.setUserResult(userId, productId, false);
      return;
    }

    // Create order with new schema
    const order = await orderRepository.create({
      userId,
      productId,
      status: OrderStatus.SUCCESS,
      saleId: saleIdNum,
      attemptId: null,
    });

    logger.info(`Order created successfully for user ${userId}, order ID: ${order.id}, sale ${saleId}`);

    // Set result in Redis
    await redisService.setUserResult(userId, productId, true);
  } catch (error: any) {
    logger.error(`Error processing attempt for user ${userId}:`, error);

    // If order creation failed (e.g., unique constraint), mark as failed
    if (error.message && error.message.includes('already exists')) {
      // User already has an order, check it
      try {
        const existingOrder = await orderRepository.findByUserId(userId, saleIdNum);
        if (existingOrder) {
          const status = String(existingOrder.status).toUpperCase();
          const isSuccess = status === 'SUCCESS' || status === OrderStatus.SUCCESS;
          await redisService.setUserResult(userId, productId, isSuccess);
        }
      } catch (checkError) {
        logger.error(`Error checking existing order for user ${userId}:`, checkError);
      }
    } else {
      // Mark as failed
      await redisService.setUserResult(userId, productId, false);
    }
  }
}

async function startWorker() {
  try {
    // Check if consumer is enabled
    if (!config.worker.enableConsumer) {
      logger.info('Consumer is disabled via ENABLE_CONSUMER flag. Worker will not start.');
      logger.info('Set ENABLE_CONSUMER=true to enable the consumer.');
      process.exit(0);
    }

    logger.info('Starting Flash Sale Worker...');

    // Initialize services
    const redisService = new RedisService();
    await redisService.ping();
    logger.info('Redis service initialized');

    const orderRepository = new OrderRepository();
    logger.info('Order repository initialized');

    const kafkaConsumer = new KafkaConsumer();
    await kafkaConsumer.connect();
    logger.info('Kafka consumer initialized');

    // Start consuming messages
    logger.info('Worker ready to process flash sale attempts');
    await kafkaConsumer.consumeAttempts(async (attempt: FlashSaleAttempt) => {
      await processFlashSaleAttempt(attempt, redisService, orderRepository);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down worker...');
      await kafkaConsumer.disconnect();
      await redisService.disconnect();
      await orderRepository.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();

