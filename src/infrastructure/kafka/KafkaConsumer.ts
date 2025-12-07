// Single Responsibility Principle - handles only Kafka consumer operations
import { Kafka, Consumer } from 'kafkajs';
import { IKafkaConsumer } from '../../domain/interfaces/IKafkaConsumer';
import { FlashSaleAttempt } from '../../domain/models/FlashSaleAttempt';
import { config } from '../../config';
import { logger } from '../logger';

export class KafkaConsumer implements IKafkaConsumer {
  private consumer: Consumer;

  constructor() {
    const kafka = new Kafka({
      clientId: `${config.kafka.clientId}-consumer`,
      brokers: config.kafka.brokers,
      retry: {
        retries: 5,
        initialRetryTime: 100,
        multiplier: 2,
        maxRetryTime: 30000,
      },
    });

    this.consumer = kafka.consumer({
      groupId: config.kafka.consumerGroup,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: config.kafka.topicFlashSaleAttempts,
      fromBeginning: false,
    });
    logger.info('Kafka consumer connected and subscribed');
  }

  async consumeAttempts(
    onMessage: (attempt: FlashSaleAttempt) => Promise<void>
  ): Promise<void> {
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          if (!message.value) {
            logger.warn('Received message with no value');
            return;
          }

          const data = JSON.parse(message.value.toString());
          const attempt: FlashSaleAttempt = {
            userId: data.userId,
            productId: data.productId,
            saleId: data.saleId,
            timestamp: new Date(data.timestamp),
          };

          await onMessage(attempt);
        } catch (error) {
          logger.error('Error processing Kafka message:', error);
          // In production, you might want to send to a dead letter queue
        }
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
}

