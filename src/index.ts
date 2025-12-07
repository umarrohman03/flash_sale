import { createApp } from './api/app';
import { FlashSaleService } from './services/FlashSaleService';
import { AuthService } from './services/AuthService';
import { RedisService } from './infrastructure/redis/RedisService';
import { KafkaProducer } from './infrastructure/kafka/KafkaProducer';
import { FlashSaleRepository } from './infrastructure/database/FlashSaleRepository';
import { OrderRepository } from './infrastructure/database/OrderRepository';
import { config } from './config';
import { logger } from './infrastructure/logger';

async function initializeServices() {
  // Initialize Redis
  const redisService = new RedisService();
  // Wait a bit for Redis connection to establish before pinging
  await new Promise(resolve => setTimeout(resolve, 1000));
  await redisService.ping();
  logger.info('Redis service initialized');

  // Initialize Flash Sale Repository
  const flashSaleRepository = new FlashSaleRepository();
  logger.info('Flash sale repository initialized');

  // Get flash sale within time window (regardless of status field) and initialize stock in Redis
  // This ensures stock is initialized even if status field is UPCOMING but sale is actually active
  const flashSaleInWindow = await flashSaleRepository.findByTimeWindow();
  if (flashSaleInWindow) {
    const productId = String(flashSaleInWindow.productId);
    logger.info(`Found flash sale in time window: sale ${flashSaleInWindow.id}, product ${productId}, remaining_stock: ${flashSaleInWindow.remainingStock}, initial_stock: ${flashSaleInWindow.initialStock}`);
    // Check if stock key already exists in Redis to avoid overwriting
    // We check if the key EXISTS, not just if value is 0, because stock=0 means sold out, not uninitialized
    const stockKeyExists = await redisService.stockKeyExists(productId);
    if (!stockKeyExists) {
      // Stock key doesn't exist, initialize it now
      logger.info(`Initializing stock for product ${productId} with value: ${flashSaleInWindow.remainingStock}`);
      await redisService.initializeStock(productId, flashSaleInWindow.remainingStock);
      logger.info(`Initialized stock: ${flashSaleInWindow.remainingStock} for product ${productId}, sale ${flashSaleInWindow.id}`);
    } else {
      const existingStock = await redisService.getStock(productId);
      logger.info(`Stock key already exists in Redis for product ${productId}: ${existingStock}. Skipping initialization.`);
    }
  } else {
    logger.warn('No flash sale found within time window. Stock will not be initialized in Redis.');
  }

  // Initialize Kafka Producer (with retry logic)
  const kafkaProducer = new KafkaProducer();
  try {
    await kafkaProducer.connect();
    logger.info('Kafka producer initialized');
  } catch (error: any) {
    logger.warn('Kafka producer connection failed, will retry on first use:', error.message);
    // Don't fail startup if Kafka is temporarily unavailable
  }

      // Initialize Flash Sale Service
      const flashSaleService = new FlashSaleService(redisService, kafkaProducer, flashSaleRepository);

      // Initialize Auth Service
      const authService = new AuthService();

      // Initialize Order Repository
      const orderRepository = new OrderRepository();
      logger.info('Order repository initialized');

      return { flashSaleService, authService, redisService, flashSaleRepository, kafkaProducer, orderRepository };
}

async function startServer() {
      try {
        const { flashSaleService, authService, redisService, flashSaleRepository, kafkaProducer, orderRepository } = await initializeServices();

        const app = createApp(flashSaleService, authService, redisService);

    const server = app.listen(config.server.port, () => {
      logger.info(`Flash Sale API server running on port ${config.server.port}`);
    });

    // Graceful shutdown
        const shutdown = async () => {
          logger.info('Shutting down server...');
          server.close(async () => {
            await kafkaProducer.disconnect();
            await redisService.disconnect();
            await flashSaleRepository.close();
            await orderRepository.close();
            process.exit(0);
          });
        };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

