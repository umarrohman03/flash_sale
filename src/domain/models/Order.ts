export enum OrderStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  // Legacy support
  CONFIRMED = 'SUCCESS',
}

export interface Order {
  id?: number;
  userId: string;
  productId: string;
  saleId?: number;
  status: OrderStatus | 'PENDING' | 'SUCCESS' | 'FAILED';
  attemptId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

