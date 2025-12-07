// Integration test setup
// This file sets up the test environment for integration tests

import { createApp } from '../../api/app';
import { FlashSaleService } from '../../services/FlashSaleService';
import { AuthService } from '../../services/AuthService';
import { IFlashSaleService } from '../../domain/interfaces/IFlashSaleService';
import { IAuthService } from '../../domain/interfaces/IAuthService';
import { IOrderRepository } from '../../domain/interfaces/IOrderRepository';
import { IRedisService } from '../../domain/interfaces/IRedisService';
import { IKafkaProducer } from '../../domain/interfaces/IKafkaProducer';
import { IFlashSaleRepository } from '../../domain/interfaces/IFlashSaleRepository';
import {
  createMockRedisService,
  createMockKafkaProducer,
  createMockFlashSaleRepository,
  createMockOrderRepository,
} from '../utils/testHelpers';
import { UserRepository } from '../../infrastructure/database/UserRepository';
import { Express } from 'express';

// Mock UserRepository at the module level
jest.mock('../../infrastructure/database/UserRepository');

export interface TestAppContext {
  app: Express;
  flashSaleService: IFlashSaleService;
  authService: IAuthService;
  orderRepository: jest.Mocked<IOrderRepository>;
  redisService: jest.Mocked<IRedisService>;
  kafkaProducer: jest.Mocked<IKafkaProducer>;
  flashSaleRepository: jest.Mocked<IFlashSaleRepository>;
}

/**
 * Creates a test Express app with mocked dependencies
 */
export function createTestApp(): TestAppContext {
  // Create mocked dependencies
  const redisService = createMockRedisService();
  const kafkaProducer = createMockKafkaProducer();
  const flashSaleRepository = createMockFlashSaleRepository();
  const orderRepository = createMockOrderRepository();

  // Create real services with mocked dependencies
  const flashSaleService = new FlashSaleService(
    redisService,
    kafkaProducer,
    flashSaleRepository
  );

  const authService = new AuthService();

  // Create Express app
  const app = createApp(flashSaleService, authService, redisService);

  return {
    app,
    flashSaleService,
    authService,
    orderRepository,
    redisService,
    kafkaProducer,
    flashSaleRepository,
  };
}

/**
 * Helper to create a valid JWT token for testing
 */
export async function createTestToken(
  authService: IAuthService,
  userId: string = '1',
  username: string = 'testuser'
): Promise<string> {
  // Generate JWT token directly for testing
  const jwt = require('jsonwebtoken');
  const { config } = require('../../config');
  
  return jwt.sign(
    { userId, username },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

/**
 * Helper to create a test user in the database (for integration tests that need real data)
 */
export async function createTestUser(
  username: string,
  email: string,
  password: string,
  fullName?: string
): Promise<{ userId: string; username: string; email: string; fullName?: string }> {
  // This would create a real user in the test database
  // For now, we'll use the auth service
  const authService = new AuthService();
  return await authService.register(username, email, password, fullName);
}

