// Interface Segregation Principle - specific interface for flash sale persistence
export interface FlashSale {
  id: number;
  productId: number;
  startAt: Date;
  endAt: Date;
  initialStock: number;
  remainingStock: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  productName?: string;
  productDescription?: string;
}

export interface IFlashSaleRepository {
  findActive(): Promise<FlashSale | null>;
  findById(id: number): Promise<FlashSale | null>;
  findMostRecent(): Promise<FlashSale | null>;
  findByTimeWindow(): Promise<FlashSale | null>;
  updateRemainingStock(id: number, remainingStock: number): Promise<void>;
}

