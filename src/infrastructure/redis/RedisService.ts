// Single Responsibility Principle - handles only Redis operations
import Redis, { RedisOptions } from 'ioredis';
import { IRedisService } from '../../domain/interfaces/IRedisService';
import { config } from '../../config';
import { logger } from '../logger';
import {
  ATTEMPT_PURCHASE_SCRIPT,
  GET_USER_STATUS_SCRIPT,
  SET_USER_RESULT_SCRIPT,
  INITIALIZE_STOCK_SCRIPT,
  RESTORE_STOCK_SCRIPT,
} from './lua-scripts';
import type {
  AttemptPurchaseResult,
  UserStatusResult,
} from '../../domain/interfaces/IRedisService';

export class RedisService implements IRedisService {
  private client: Redis;
  private attemptPurchaseSha: string | null = null;
  private getUserStatusSha: string | null = null;
  private setUserResultSha: string | null = null;
  private initializeStockSha: string | null = null;
  private restoreStockSha: string | null = null;

  constructor() {
    const redisOptions: RedisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null, // Retry indefinitely until connection is established
      connectTimeout: 10000,
      lazyConnect: false,
      enableReadyCheck: true,
      enableOfflineQueue: true, // Allow queuing commands while connecting
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        if (times <= 10) {
          logger.info(`Redis retry attempt ${times}, waiting ${delay}ms`);
        }
        return delay;
      },
    };

    logger.info(`Connecting to Redis at ${config.redis.host}:${config.redis.port}`);
    this.client = new Redis(redisOptions);

    this.client.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.client.on('connect', async () => {
      logger.info('Redis connected successfully');
      // Load Lua scripts on connection
      await this.loadScripts();
    });
  }

  /**
   * Load Lua scripts and cache their SHA1 hashes for EVALSHA
   */
  private async loadScripts(): Promise<void> {
    try {
      this.attemptPurchaseSha = (await this.client.script('LOAD', ATTEMPT_PURCHASE_SCRIPT)) as string;
      this.getUserStatusSha = (await this.client.script('LOAD', GET_USER_STATUS_SCRIPT)) as string;
      this.setUserResultSha = (await this.client.script('LOAD', SET_USER_RESULT_SCRIPT)) as string;
      this.initializeStockSha = (await this.client.script('LOAD', INITIALIZE_STOCK_SCRIPT)) as string;
      this.restoreStockSha = (await this.client.script('LOAD', RESTORE_STOCK_SCRIPT)) as string;
      logger.info('Redis Lua scripts loaded successfully');
    } catch (error) {
      logger.error('Error loading Redis Lua scripts:', error);
      // Scripts will be loaded on first use via EVAL
    }
  }

  /**
   * Execute script using EVALSHA if available, fallback to EVAL
   */
  private async executeScript(
    script: string,
    shaRef: { current: string | null },
    keys: string[],
    args: (string | number)[]
  ): Promise<any> {
    try {
      if (shaRef.current) {
        try {
          return await this.client.evalsha(shaRef.current, keys.length, ...keys, ...args.map(String));
        } catch (error: any) {
          // If NOSCRIPT error, script was evicted, reload it
          if (error.message?.includes('NOSCRIPT')) {
            shaRef.current = (await this.client.script('LOAD', script)) as string;
            logger.debug('Reloaded Redis script after NOSCRIPT error');
            return await this.client.evalsha(shaRef.current, keys.length, ...keys, ...args.map(String));
          }
          throw error;
        }
      }
      // Fallback to EVAL if SHA not available
      const result = await this.client.eval(script, keys.length, ...keys, ...args.map(String));
      // Cache the SHA for future use
      shaRef.current = (await this.client.script('LOAD', script)) as string;
      return result;
    } catch (error) {
      logger.error('Error executing Redis script:', error);
      throw error;
    }
  }

  /**
   * Attempt Purchase - Atomic operation using Lua script
   * Checks if user attempted, checks stock, decrements stock, and adds user to attempted set
   * All in one atomic operation to prevent race conditions
   */
  async attemptPurchase(
    userId: string,
    productId: string
  ): Promise<AttemptPurchaseResult> {
    const stockKey = `flashsale:stock:${productId}`;
    const attemptedSetKey = `flashsale:attempted:${productId}`;

    const shaRef = { current: this.attemptPurchaseSha };
    const result = await this.executeScript(
      ATTEMPT_PURCHASE_SCRIPT,
      shaRef,
      [stockKey, attemptedSetKey],
      [userId]
    );
    this.attemptPurchaseSha = shaRef.current;

    // Result format: [success, remainingStock, wasNewAttempt]
    const attemptResult = {
      success: result[0] === 1,
      remainingStock: result[1] as number,
      wasNewAttempt: result[2] === 1,
    };

    // Log stock information
    logger.info(`[Stock] User ${userId} attempt on product ${productId}: success=${attemptResult.success}, remainingStock=${attemptResult.remainingStock}, wasNewAttempt=${attemptResult.wasNewAttempt}`);

    return attemptResult;
  }

  // Stock key format: flashsale:stock:{productId}
  // Example: flashsale:stock:1 (for product ID 1)
  async decrementStock(productId: string): Promise<number> {
    const key = `flashsale:stock:${productId}`;
    const result = await this.client.decr(key);
    return result;
  }

  async incrementStock(productId: string): Promise<number> {
    const key = `flashsale:stock:${productId}`;
    const result = await this.client.incr(key);
    return result;
  }

  /**
   * Restore stock using Lua script (for rollback scenarios)
   */
  async restoreStock(productId: string): Promise<number> {
    const stockKey = `flashsale:stock:${productId}`;
    const shaRef = { current: this.restoreStockSha };
    const result = await this.executeScript(
      RESTORE_STOCK_SCRIPT,
      shaRef,
      [stockKey],
      []
    );
    this.restoreStockSha = shaRef.current;
    const newStock = result as number;
    logger.info(`[Stock] Restored stock for product ${productId} (key: ${stockKey}): ${newStock}`);
    return newStock;
  }

  async getStock(productId: string): Promise<number> {
    const key = `flashsale:stock:${productId}`;
    const stock = await this.client.get(key);
    return stock ? parseInt(stock, 10) : 0;
  }

  async stockKeyExists(productId: string): Promise<boolean> {
    const key = `flashsale:stock:${productId}`;
    const exists = await this.client.exists(key);
    return exists === 1;
  }

  async initializeStock(productId: string, stock: number): Promise<void> {
    const stockKey = `flashsale:stock:${productId}`;
    const shaRef = { current: this.initializeStockSha };
    await this.executeScript(
      INITIALIZE_STOCK_SCRIPT,
      shaRef,
      [stockKey],
      [stock]
    );
    this.initializeStockSha = shaRef.current;
    logger.info(`[Stock] Initialized stock for product ${productId} (key: ${stockKey}): ${stock}`);
  }

  // User attempted set: flashsale:attempted:{productId}
  async addUserToAttemptedSet(userId: string, productId: string): Promise<boolean> {
    const key = `flashsale:attempted:${productId}`;
    const result = await this.client.sadd(key, userId);
    // Returns 1 if added (new), 0 if already exists
    return result === 1;
  }

  async isUserInAttemptedSet(userId: string, productId: string): Promise<boolean> {
    const key = `flashsale:attempted:${productId}`;
    const result = await this.client.sismember(key, userId);
    return result === 1;
  }

  /**
   * Get User Status - Atomic operation using Lua script
   * Checks if user attempted and if they have a result in one atomic call
   */
  async getUserStatus(userId: string, productId: string): Promise<UserStatusResult> {
    const attemptedSetKey = `flashsale:attempted:${productId}`;
    const resultKey = `flashsale:result:${userId}:${productId}`;

    const shaRef = { current: this.getUserStatusSha };
    const result = await this.executeScript(
      GET_USER_STATUS_SCRIPT,
      shaRef,
      [attemptedSetKey, resultKey],
      [userId]
    );
    this.getUserStatusSha = shaRef.current;

    // Result format: [hasAttempted, hasResult, resultValue]
    return {
      hasAttempted: result[0] === 1,
      hasResult: result[1] === 1,
      result: result[2] !== null ? result[2] === 1 : null,
    };
  }

  // User result: flashsale:result:{userId}:{productId}
  async setUserResult(userId: string, productId: string, success: boolean): Promise<void> {
    const resultKey = `flashsale:result:${userId}:${productId}`;
    const ttl = 86400; // 24 hours

    const shaRef = { current: this.setUserResultSha };
    await this.executeScript(
      SET_USER_RESULT_SCRIPT,
      shaRef,
      [resultKey],
      [success ? '1' : '0', ttl]
    );
    this.setUserResultSha = shaRef.current;
  }

  async getUserResult(userId: string, productId: string): Promise<boolean | null> {
    const key = `flashsale:result:${userId}:${productId}`;
    const result = await this.client.get(key);
    if (result === null) return null;
    return result === '1';
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

