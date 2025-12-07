// Interface Segregation Principle - specific interface for Redis operations
export interface AttemptPurchaseResult {
  success: boolean;
  remainingStock: number;
  wasNewAttempt: boolean;
}

export interface UserStatusResult {
  hasAttempted: boolean;
  hasResult: boolean;
  result: boolean | null;
}

export interface IRedisService {
  // Atomic operations using Lua scripts
  attemptPurchase(userId: string, productId: string): Promise<AttemptPurchaseResult>;
  getUserStatus(userId: string, productId: string): Promise<UserStatusResult>;
  restoreStock(productId: string): Promise<number>;
  
  // Stock operations
  decrementStock(productId: string): Promise<number>;
  incrementStock(productId: string): Promise<number>;
  getStock(productId: string): Promise<number>;
  stockKeyExists(productId: string): Promise<boolean>;
  initializeStock(productId: string, stock: number): Promise<void>;
  
  // User tracking operations
  addUserToAttemptedSet(userId: string, productId: string): Promise<boolean>;
  isUserInAttemptedSet(userId: string, productId: string): Promise<boolean>;
  
  // User result operations
  setUserResult(userId: string, productId: string, success: boolean): Promise<void>;
  getUserResult(userId: string, productId: string): Promise<boolean | null>;
  
  // Health check
  ping(): Promise<string>;
}

