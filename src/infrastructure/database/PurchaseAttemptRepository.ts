// Single Responsibility Principle - handles only purchase attempt persistence
import { Pool, PoolClient } from 'pg';
import { config } from '../../config';
import { logger } from '../logger';
import { FlashSaleAttempt } from '../../domain/models/FlashSaleAttempt';

export class PurchaseAttemptRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  async create(attempt: FlashSaleAttempt): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      // Check if saleId is provided
      if (!attempt.saleId) {
        logger.warn(`Missing saleId in purchase attempt for user ${attempt.userId}`);
        return; // Don't throw, just log and skip
      }

      // Convert userId to number for the schema
      const userIdNum = typeof attempt.userId === 'string' 
        ? parseInt(attempt.userId, 10) 
        : attempt.userId;
      
      if (isNaN(userIdNum)) {
        logger.warn(`Invalid userId in purchase attempt: ${attempt.userId}`);
        return; // Don't throw, just log and skip
      }

      const saleIdNum = parseInt(attempt.saleId, 10);
      if (isNaN(saleIdNum)) {
        logger.warn(`Invalid saleId in purchase attempt: ${attempt.saleId}`);
        return; // Don't throw, just log and skip
      }

      // Store attempt payload as JSONB
      const attemptPayload = {
        userId: String(attempt.userId),
        productId: String(attempt.productId),
        saleId: String(attempt.saleId),
        timestamp: attempt.timestamp.toISOString(),
      };

      await client.query(
        `INSERT INTO purchase_attempts (sale_id, user_id, attempt_payload)
         VALUES ($1, $2, $3)`,
        [saleIdNum, userIdNum, JSON.stringify(attemptPayload)]
      );

      logger.info(`Purchase attempt recorded for user ${attempt.userId}, sale ${attempt.saleId}`);
    } catch (error: any) {
      // Log error but don't throw - we don't want to fail the purchase attempt if logging fails
      logger.error(`Error recording purchase attempt for user ${attempt.userId}:`, error);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

