// Single Responsibility Principle - handles only user persistence
import { Pool, PoolClient } from 'pg';
import { config } from '../../config';
import { logger } from '../logger';

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  fullName?: string;
}

export class UserRepository {
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
      logger.error('Unexpected error on idle PostgreSQL client in UserRepository', err);
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      logger.debug(`Searching for user with username: ${username}`);
      const result = await client.query(
        `SELECT id, username, email, password_hash, full_name
         FROM users
         WHERE username = $1`,
        [username]
      );

      logger.debug(`Found ${result.rows.length} user(s) with username: ${username}`);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const user = {
        id: parseInt(row.id, 10),
        username: row.username,
        email: row.email,
        passwordHash: row.password_hash,
        fullName: row.full_name,
      };
      logger.debug(`User found: id=${user.id}, username=${user.username}`);
      return user;
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const client: PoolClient = await this.pool.connect();
    try {
      logger.debug(`Searching for user with email: ${email}`);
      const result = await client.query(
        `SELECT id, username, email, password_hash, full_name
         FROM users
         WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const user = {
        id: parseInt(row.id, 10),
        username: row.username,
        email: row.email,
        passwordHash: row.password_hash,
        fullName: row.full_name,
      };
      logger.debug(`User found: id=${user.id}, email=${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async create(userData: {
    username: string;
    email: string;
    passwordHash: string;
    fullName?: string;
  }): Promise<User> {
    const client: PoolClient = await this.pool.connect();
    try {
      logger.debug(`Creating user with username: ${userData.username}`);
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, password_hash, full_name`,
        [userData.username, userData.email, userData.passwordHash, userData.fullName || null]
      );

      const row = result.rows[0];
      const user = {
        id: parseInt(row.id, 10),
        username: row.username,
        email: row.email,
        passwordHash: row.password_hash,
        fullName: row.full_name,
      };
      logger.info(`User created successfully: id=${user.id}, username=${user.username}`);
      return user;
    } catch (error: any) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        if (error.constraint === 'users_username_key') {
          throw new Error('Username already exists');
        } else if (error.constraint === 'users_email_key') {
          throw new Error('Email already exists');
        }
      }
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

