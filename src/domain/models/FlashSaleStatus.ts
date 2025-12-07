export enum FlashSaleStatus {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export interface FlashSaleStatusResponse {
  id?: number;
  status: FlashSaleStatus;
  startTime: Date;
  endTime: Date;
  currentTime: Date;
  productName?: string;
  productDescription?: string;
  productId?: number;
}

