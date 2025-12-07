import { Request, Response } from 'express';
import { IAuthService } from '../../domain/interfaces/IAuthService';
import { IFlashSaleService } from '../../domain/interfaces/IFlashSaleService';
import { IOrderRepository } from '../../domain/interfaces/IOrderRepository';
import { IRedisService } from '../../domain/interfaces/IRedisService';
import { IKafkaProducer } from '../../domain/interfaces/IKafkaProducer';
import { IFlashSaleRepository } from '../../domain/interfaces/IFlashSaleRepository';

/**
 * Creates a mock Express Request object
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: undefined,
    ...overrides,
  } as Partial<Request>;
}

/**
 * Creates a mock Express Response object with jest spies
 */
export function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Creates a mock AuthService
 */
export function createMockAuthService(): jest.Mocked<IAuthService> {
  return {
    login: jest.fn(),
    register: jest.fn(),
    verifyToken: jest.fn(),
  } as jest.Mocked<IAuthService>;
}

/**
 * Creates a mock FlashSaleService
 */
export function createMockFlashSaleService(): jest.Mocked<IFlashSaleService> {
  return {
    getStatus: jest.fn(),
    attemptPurchase: jest.fn(),
  } as jest.Mocked<IFlashSaleService>;
}

/**
 * Creates a mock OrderRepository
 */
export function createMockOrderRepository(): jest.Mocked<IOrderRepository> {
  return {
    findByUserId: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findBySaleId: jest.fn(),
    updateStatus: jest.fn(),
  } as jest.Mocked<IOrderRepository>;
}

/**
 * Creates a mock RedisService
 */
export function createMockRedisService(): jest.Mocked<IRedisService> {
  return {
    attemptPurchase: jest.fn(),
    getUserStatus: jest.fn(),
    restoreStock: jest.fn(),
    decrementStock: jest.fn(),
    incrementStock: jest.fn(),
    getStock: jest.fn(),
    stockKeyExists: jest.fn(),
    initializeStock: jest.fn(),
    addUserToAttemptedSet: jest.fn(),
    isUserInAttemptedSet: jest.fn(),
    setUserResult: jest.fn(),
    getUserResult: jest.fn(),
    ping: jest.fn(),
  } as jest.Mocked<IRedisService>;
}

/**
 * Creates a mock KafkaProducer
 */
export function createMockKafkaProducer(): jest.Mocked<IKafkaProducer> {
  return {
    sendAttempt: jest.fn(),
    disconnect: jest.fn(),
  } as jest.Mocked<IKafkaProducer>;
}

/**
 * Creates a mock FlashSaleRepository
 */
export function createMockFlashSaleRepository(): jest.Mocked<IFlashSaleRepository> {
  return {
    findActive: jest.fn(),
    findById: jest.fn(),
    findMostRecent: jest.fn(),
    findByTimeWindow: jest.fn(),
    updateRemainingStock: jest.fn(),
  } as jest.Mocked<IFlashSaleRepository>;
}

/**
 * Helper to wait for async operations in tests
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
