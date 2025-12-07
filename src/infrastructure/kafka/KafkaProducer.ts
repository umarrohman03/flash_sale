// Single Responsibility Principle - handles only Kafka producer operations
import { Kafka, Producer } from 'kafkajs';
import { IKafkaProducer } from '../../domain/interfaces/IKafkaProducer';
import { FlashSaleAttempt } from '../../domain/models/FlashSaleAttempt';
import { config } from '../../config';
import { logger } from '../logger';

export class KafkaProducer implements IKafkaProducer {
  private producer: Producer;

  constructor() {
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        retries: 5,
        initialRetryTime: 100,
        multiplier: 2,
        maxRetryTime: 30000,
      },
    });

    this.producer = kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    logger.info('Kafka producer connected');
  }

  async sendAttempt(attempt: FlashSaleAttempt): Promise<void> {
    try {
      await this.producer.send({
        topic: config.kafka.topicFlashSaleAttempts,
        messages: [
          {
            key: attempt.userId, // Keyed by userId for partitioning
            value: JSON.stringify({
              userId: attempt.userId,
              productId: attempt.productId,
              saleId: attempt.saleId,
              timestamp: attempt.timestamp.toISOString(),
            }),
          },
        ],
      });
      logger.debug(`Sent flash sale attempt for user ${attempt.userId}, sale ${attempt.saleId || 'N/A'}`);
    } catch (error) {
      logger.error('Error sending Kafka message:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    logger.info('Kafka producer disconnected');
  }
}

