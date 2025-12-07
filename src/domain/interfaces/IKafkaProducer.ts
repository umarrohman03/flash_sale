// Interface Segregation Principle - specific interface for Kafka producer
import { FlashSaleAttempt } from '../models/FlashSaleAttempt';

export interface IKafkaProducer {
  sendAttempt(attempt: FlashSaleAttempt): Promise<void>;
  disconnect(): Promise<void>;
}

