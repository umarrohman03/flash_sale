// Interface Segregation Principle - specific interface for Kafka consumer
import { FlashSaleAttempt } from '../models/FlashSaleAttempt';

export interface IKafkaConsumer {
  consumeAttempts(
    onMessage: (attempt: FlashSaleAttempt) => Promise<void>
  ): Promise<void>;
  disconnect(): Promise<void>;
}

