// Single Responsibility Principle - handles only migration execution
import { Pool, PoolClient } from 'pg';
import { config } from '../../../config';
import { logger } from '../../logger';
import * as fs from 'fs';
import * as path from 'path';

export interface Migration {
  name: string;
  up: string | ((client: PoolClient) => Promise<void>);
  down: string | ((client: PoolClient) => Promise<void>);
}

export class MigrationRunner {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }

  async ensureDatabase(): Promise<void> {
    // First, try to connect to the target database
    let testPool: Pool | null = null;
    try {
      testPool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.user,
        password: config.postgres.password,
        database: config.postgres.database,
        connectionTimeoutMillis: 5000,
      });
      await testPool.query('SELECT 1');
      await testPool.end();
      testPool = null;
      logger.info(`Database '${config.postgres.database}' exists`);
      return;
    } catch (error: any) {
      // Clean up test pool if it exists
      if (testPool) {
        try {
          await testPool.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // If database doesn't exist, connect to default 'postgres' database to create it
      if (error.code === '3D000') {
        logger.info(`Database '${config.postgres.database}' does not exist, creating...`);
        const adminPool = new Pool({
          host: config.postgres.host,
          port: config.postgres.port,
          user: config.postgres.user,
          password: config.postgres.password,
          database: 'postgres', // Connect to default database
          connectionTimeoutMillis: 10000,
        });
        
        try {
          // Escape database name to prevent SQL injection
          // PostgreSQL identifiers should not be quoted unless they contain special characters
          // But we'll use identifier quoting for safety
          const dbName = config.postgres.database.replace(/"/g, '""');
          await adminPool.query(`CREATE DATABASE "${dbName}"`);
          logger.info(`✓ Database '${config.postgres.database}' created successfully`);
        } catch (createError: any) {
          if (createError.code === '42P04') {
            // Database already exists (race condition)
            logger.info(`Database '${config.postgres.database}' already exists (created concurrently)`);
          } else {
            logger.error(`Failed to create database '${config.postgres.database}':`, {
              code: createError.code,
              message: createError.message,
            });
            throw createError;
          }
        } finally {
          await adminPool.end();
        }
        
        // Verify the database was created by trying to connect again
        const verifyPool = new Pool({
          host: config.postgres.host,
          port: config.postgres.port,
          user: config.postgres.user,
          password: config.postgres.password,
          database: config.postgres.database,
          connectionTimeoutMillis: 5000,
        });
        try {
          await verifyPool.query('SELECT 1');
          await verifyPool.end();
          logger.info(`✓ Verified database '${config.postgres.database}' is accessible`);
        } catch (verifyError: any) {
          await verifyPool.end();
          logger.error(`Database '${config.postgres.database}' was created but is not accessible:`, verifyError.message);
          throw verifyError;
        }
      } else {
        // Other connection errors - log for debugging
        logger.error(`Failed to connect to database '${config.postgres.database}':`, {
          code: error.code,
          message: error.message,
          host: config.postgres.host,
          port: config.postgres.port,
        });
        // Also log to console for visibility
        console.error('Database connection error:', {
          code: error.code,
          message: error.message,
          name: error.name,
          host: config.postgres.host,
          port: config.postgres.port,
          database: config.postgres.database,
        });
        throw error;
      }
    }
  }

  async ensureMigrationsTable(): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      logger.info('Migrations table ensured');
    } catch (error) {
      logger.error('Error creating migrations table:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAppliedMigrations(): Promise<string[]> {
    const client: PoolClient = await this.pool.connect();
    try {
      const result = await client.query('SELECT name FROM migrations ORDER BY id');
      return result.rows.map((row: { name: string }) => row.name);
    } catch (error) {
      logger.error('Error getting applied migrations:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async applyMigration(migration: Migration): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      logger.info(`Applying migration: ${migration.name}`);
      console.log(`🔄 Applying migration: ${migration.name}`);
      
      // Execute migration - support both string SQL and async functions
      if (typeof migration.up === 'string') {
        await client.query(migration.up);
      } else {
        // For async function migrations, execute and capture any console output
        await migration.up(client);
      }
      
      // Record migration
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      
      await client.query('COMMIT');
      logger.info(`✓ Successfully applied migration: ${migration.name}`);
      console.log(`✅ Successfully applied migration: ${migration.name}`);
    } catch (error: any) {
      try {
        await client.query('ROLLBACK');
        console.log(`🔄 Rolled back transaction for migration: ${migration.name}`);
      } catch (rollbackError) {
        logger.error('Error during rollback:', rollbackError);
        console.error('❌ Error during rollback:', rollbackError);
      }
      logger.error(`✗ Failed to apply migration ${migration.name}:`, error);
      console.error(`❌ Failed to apply migration ${migration.name}:`, error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      throw new Error(`Migration ${migration.name} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async rollbackMigration(migration: Migration): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      logger.info(`Rolling back migration: ${migration.name}`);
      
      // Execute rollback - support both string SQL and async functions
      if (typeof migration.down === 'string') {
        await client.query(migration.down);
      } else {
        await migration.down(client);
      }
      
      // Remove migration record
      await client.query('DELETE FROM migrations WHERE name = $1', [migration.name]);
      
      await client.query('COMMIT');
      logger.info(`✓ Successfully rolled back migration: ${migration.name}`);
    } catch (error: any) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Error during rollback:', rollbackError);
      }
      logger.error(`✗ Failed to roll back migration ${migration.name}:`, error);
      throw new Error(`Rollback of ${migration.name} failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async loadMigrations(): Promise<Migration[]> {
    // Determine migrations directory based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    let migrationsDir: string;
    
    if (isProduction) {
      // In production, migrations are in dist (compiled JS)
      migrationsDir = path.join(process.cwd(), 'dist', 'infrastructure', 'database', 'migrations', 'files');
    } else {
      // In development, migrations are in src (TypeScript)
      migrationsDir = path.join(process.cwd(), 'src', 'infrastructure', 'database', 'migrations', 'files');
    }
    
    if (!fs.existsSync(migrationsDir)) {
      logger.warn(`Migrations directory not found: ${migrationsDir}`);
      return [];
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter((file: string) => {
        // Filter by extension based on environment
        const extension = isProduction ? '.js' : '.ts';
        return file.endsWith(extension) && !file.endsWith('.d.ts');
      })
      .sort(); // Sort to ensure order
    
    const migrations: Migration[] = [];
    
    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      
      try {
        // In production, require the .js file
        // In development, require the .ts file (ts-node will handle it)
        const migrationModule = require(migrationPath);
        
        if (!migrationModule.migration) {
          logger.warn(`Migration file ${file} does not export a 'migration' object`);
          continue;
        }
        
        const migration = migrationModule.migration as Migration;
        
        // Validate migration structure
        if (!migration.name || migration.up === undefined || migration.down === undefined) {
          logger.warn(`Migration ${file} is missing required fields (name, up, down)`);
          continue;
        }
        
        // Validate migration name matches file name pattern
        const expectedName = file.replace(/\.(ts|js)$/, '').replace(/\//g, '_');
        if (migration.name !== expectedName) {
          logger.warn(
            `Migration name '${migration.name}' does not match file name pattern '${expectedName}'`
          );
        }
        
        migrations.push(migration);
        logger.debug(`Loaded migration: ${migration.name}`);
      } catch (error: any) {
        logger.error(`Could not load migration ${file}:`, error.message);
        // Don't throw - continue loading other migrations
      }
    }
    
    // Validate migration order
    for (let i = 0; i < migrations.length; i++) {
      const current = migrations[i];
      const expectedNumber = String(i + 1).padStart(3, '0');
      if (!current.name.startsWith(expectedNumber)) {
        logger.warn(
          `Migration ${current.name} may be out of order. Expected to start with ${expectedNumber}`
        );
      }
    }
    
    logger.info(`Loaded ${migrations.length} migration(s)`);
    return migrations;
  }

  async runMigrations(): Promise<void> {
    try {
      logger.info('Starting migration process...');
      
      // Ensure database exists
      await this.ensureDatabase();
      
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Get already applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      logger.info(`Found ${appliedMigrations.length} already applied migration(s)`);
      
      // Load all available migrations
      const allMigrations = await this.loadMigrations();
      
      if (allMigrations.length === 0) {
        logger.warn('No migrations found to apply');
        return;
      }
      
      // Filter pending migrations
      const pendingMigrations = allMigrations.filter(
        (m) => !appliedMigrations.includes(m.name)
      );
      
      if (pendingMigrations.length === 0) {
        logger.info('✓ Database is up to date - no pending migrations');
        return;
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migration(s) to apply`);
      
      // Apply migrations sequentially
      for (let i = 0; i < pendingMigrations.length; i++) {
        const migration = pendingMigrations[i];
        logger.info(`[${i + 1}/${pendingMigrations.length}] Processing: ${migration.name}`);
        await this.applyMigration(migration);
      }
      
      logger.info(`✓ Successfully applied ${pendingMigrations.length} migration(s)`);
    } catch (error: any) {
      logger.error('✗ Migration process failed:', error.message);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<{
    applied: string[];
    pending: string[];
    total: number;
  }> {
    await this.ensureDatabase();
    await this.ensureMigrationsTable();
    const appliedMigrations = await this.getAppliedMigrations();
    const allMigrations = await this.loadMigrations();
    const pendingMigrations = allMigrations
      .filter((m) => !appliedMigrations.includes(m.name))
      .map((m) => m.name);

    return {
      applied: appliedMigrations,
      pending: pendingMigrations,
      total: allMigrations.length,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

