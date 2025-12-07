// Interface Segregation Principle - specific interface for order persistence
import { Order } from '../models/Order';

export interface IOrderRepository {
  create(order: Order): Promise<Order>;
  findByUserId(userId: string, saleId: number): Promise<Order | null>;
  findBySaleId(saleId: number): Promise<Order[]>;
  updateStatus(orderId: number, status: Order['status']): Promise<void>;
}

