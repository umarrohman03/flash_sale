// Single Responsibility Principle - handles only flash sale persistence
import { Pool, PoolClient } from 'pg';
import { IFlashSaleRepository, FlashSale } from '../../domain/interfaces/IFlashSaleRepository';
import { config } from '../../config';
import { logger } from '../logger';

export class FlashSaleRepository implements IFlashSaleRepository {
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

  async findActive(): Promise<FlashSale | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      const now = new Date();
      const result = await client.query(
        `SELECT fs.id, fs.product_id, fs.start_at, fs.end_at, fs.initial_stock, fs.remaining_stock, 
                fs.metadata, fs.created_at, fs.updated_at,
                p.name as product_name, p.description as product_description
         FROM flash_sales fs
         LEFT JOIN products p ON fs.product_id = p.id
         WHERE fs.start_at <= $1 
           AND fs.end_at >= $1
         ORDER BY fs.created_at DESC
         LIMIT 1`,
        [now]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToFlashSale(result.rows[0]);
    } catch (error) {
      logger.error('Error finding active flash sale:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findMostRecent(): Promise<FlashSale | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT fs.id, fs.product_id, fs.start_at, fs.end_at, fs.initial_stock, fs.remaining_stock, 
                fs.metadata, fs.created_at, fs.updated_at,
                p.name as product_name, p.description as product_description
         FROM flash_sales fs
         LEFT JOIN products p ON fs.product_id = p.id
         ORDER BY fs.created_at DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToFlashSale(result.rows[0]);
    } catch (error) {
      logger.error('Error finding most recent flash sale:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByTimeWindow(): Promise<FlashSale | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      const now = new Date();
      const result = await client.query(
        `SELECT fs.id, fs.product_id, fs.start_at, fs.end_at, fs.initial_stock, fs.remaining_stock, 
                fs.metadata, fs.created_at, fs.updated_at,
                p.name as product_name, p.description as product_description
         FROM flash_sales fs
         LEFT JOIN products p ON fs.product_id = p.id
         WHERE fs.start_at <= $1 
           AND fs.end_at >= $1
         ORDER BY fs.created_at DESC
         LIMIT 1`,
        [now]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      logger.info(`[FlashSaleRepository] Found sale in time window: id=${row.id}, product_id=${row.product_id}, remaining_stock=${row.remaining_stock}, initial_stock=${row.initial_stock}`);
      const mapped = this.mapRowToFlashSale(row);
      logger.info(`[FlashSaleRepository] Mapped sale: id=${mapped.id}, productId=${mapped.productId}, remainingStock=${mapped.remainingStock}, initialStock=${mapped.initialStock}`);
      return mapped;
    } catch (error) {
      logger.error('Error finding flash sale by time window:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: number): Promise<FlashSale | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT fs.id, fs.product_id, fs.start_at, fs.end_at, fs.initial_stock, fs.remaining_stock, 
                fs.metadata, fs.created_at, fs.updated_at,
                p.name as product_name, p.description as product_description
         FROM flash_sales fs
         LEFT JOIN products p ON fs.product_id = p.id
         WHERE fs.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToFlashSale(result.rows[0]);
    } catch (error) {
      logger.error('Error finding flash sale by id:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateRemainingStock(id: number, remainingStock: number): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query(
        `UPDATE flash_sales
         SET remaining_stock = $1, updated_at = NOW()
         WHERE id = $2`,
        [remainingStock, id]
      );
    } catch (error) {
      logger.error('Error updating remaining stock:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToFlashSale(row: any): FlashSale {
    return {
      id: Number(row.id),
      productId: Number(row.product_id),
      startAt: new Date(row.start_at),
      endAt: new Date(row.end_at),
      initialStock: Number(row.initial_stock),
      remainingStock: Number(row.remaining_stock),
      metadata: row.metadata || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      productName: row.product_name || undefined,
      productDescription: row.product_description || undefined,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

