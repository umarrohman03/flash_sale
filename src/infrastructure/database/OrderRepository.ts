// Single Responsibility Principle - handles only order persistence
import { Pool, PoolClient } from 'pg';
import { IOrderRepository } from '../../domain/interfaces/IOrderRepository';
import { Order, OrderStatus } from '../../domain/models/Order';
import { config } from '../../config';
import { logger } from '../logger';

export class OrderRepository implements IOrderRepository {
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

  async create(order: Order): Promise<Order> {
    const client: PoolClient = await this.pool.connect();
    try {
      // Convert userId to number for new schema
      const userIdNum = typeof order.userId === 'string' ? parseInt(order.userId, 10) : order.userId;
      if (isNaN(userIdNum)) {
        throw new Error('Invalid userId: must be a number or numeric string');
      }

      const saleId = order.saleId;
      if (!saleId) {
        throw new Error('saleId is required');
      }

      const productIdNum = typeof order.productId === 'string' ? parseInt(order.productId, 10) : order.productId;
      if (isNaN(productIdNum)) {
        throw new Error('Invalid productId: must be a number or numeric string');
      }

      const attemptId = order.attemptId || null;
      const status = order.status === OrderStatus.CONFIRMED ? OrderStatus.SUCCESS : order.status;

      const result = await client.query(
        `INSERT INTO orders (sale_id, product_id, user_id, status, attempt_id, reserved_at, processed_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NULL)
         RETURNING id, order_uuid, sale_id, product_id, user_id, status, attempt_id, 
                   reserved_at, processed_at, metadata, created_at`,
        [saleId, productIdNum, userIdNum, status, attemptId]
      );

      const row = result.rows[0];
      return {
        id: Number(row.id),
        userId: String(row.user_id),
        productId: String(row.product_id),
        saleId: Number(row.sale_id),
        status: row.status as OrderStatus,
        attemptId: row.attempt_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.reserved_at),
      };
    } catch (error: any) {
      // Handle unique constraint violation (user already has an order)
      if (error.code === '23505') {
        logger.warn(`Order already exists for user ${order.userId}, sale ${order.saleId}`);
        throw new Error('Order already exists for this user');
      }
      logger.error('Error creating order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: string, saleId: number): Promise<Order | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      const userIdNum = parseInt(userId, 10);
      const result = await client.query(
        `SELECT id, order_uuid, sale_id, product_id, user_id, status, attempt_id, 
                reserved_at, processed_at, metadata, created_at
         FROM orders
         WHERE user_id = $1 AND sale_id = $2
         LIMIT 1`,
        [userIdNum, saleId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: Number(row.id),
        userId: String(row.user_id),
        productId: String(row.product_id),
        saleId: Number(row.sale_id),
        status: row.status as OrderStatus,
        attemptId: row.attempt_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.reserved_at),
      };
    } catch (error) {
      logger.error('Error finding order:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findBySaleId(saleId: number): Promise<Order[]> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT id, order_uuid, sale_id, product_id, user_id, status, attempt_id, 
                reserved_at, processed_at, metadata, created_at
         FROM orders
         WHERE sale_id = $1
         ORDER BY created_at DESC`,
        [saleId]
      );

      return result.rows.map((row) => ({
        id: Number(row.id),
        userId: String(row.user_id),
        productId: String(row.product_id),
        saleId: Number(row.sale_id),
        status: row.status as OrderStatus,
        attemptId: row.attempt_id,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.reserved_at),
      }));
    } catch (error) {
      logger.error('Error finding orders by sale ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(orderId: number, status: OrderStatus): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id = $2`,
        [status, orderId]
      );
    } catch (error) {
      logger.error('Error updating order status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

