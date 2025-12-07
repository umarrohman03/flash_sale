/**
 * Script to reset migrations for a database
 * This is useful when switching to a new database and you want to re-run all migrations
 * 
 * Usage: POSTGRES_DB=flash_sale_4 ts-node src/scripts/resetMigrations.ts
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../infrastructure/logger';

// Load .env file
dotenv.config({ override: false });

async function resetMigrations() {
  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database,
  });

  try {
    logger.info(`Resetting migrations table for database: ${config.postgres.database}`);
    console.log(`🔄 Resetting migrations table for database: ${config.postgres.database}`);
    
    const client = await pool.connect();
    try {
      // Check if migrations table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'migrations'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('⚠️ Migrations table does not exist. Nothing to reset.');
        logger.warn('Migrations table does not exist');
        return;
      }
      
      // Get count before deletion
      const countResult = await client.query('SELECT COUNT(*) as count FROM migrations');
      const count = countResult.rows[0].count;
      
      // Delete all migration records
      await client.query('DELETE FROM migrations');
      logger.info(`✓ Cleared ${count} migration record(s)`);
      console.log(`✅ Cleared ${count} migration record(s) from migrations table`);
      console.log('💡 You can now run migrations again with: npm run migrate');
    } finally {
      client.release();
    }
    
    await pool.end();
  } catch (error: any) {
    logger.error('Error resetting migrations:', error);
    console.error('❌ Error resetting migrations:', error.message);
    if (error.code === '3D000') {
      console.error(`💡 Database "${config.postgres.database}" does not exist. Create it first or check your POSTGRES_DB setting.`);
    }
    process.exit(1);
  }
}

resetMigrations();

