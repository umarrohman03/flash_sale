// Dependency Inversion Principle - high-level module depends on abstraction
import { FlashSaleStatusResponse } from '../models/FlashSaleStatus';
import { FlashSaleAttempt } from '../models/FlashSaleAttempt';

export interface IFlashSaleService {
  getStatus(): Promise<FlashSaleStatusResponse>;
  attemptPurchase(userId: string, saleId: number): Promise<{ success: boolean; message: string }>;
}

