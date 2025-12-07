import dotenv from 'dotenv';
import { MigrationRunner } from '../infrastructure/database/migrations';
import { logger } from '../infrastructure/logger';

// Load .env file before running migrations
// This ensures environment variables like FLASH_SALE_TOTAL_STOCK are available
dotenv.config({ override: false });

async function main() {
  const runner = new MigrationRunner();
  
  try {
    // Check migration status first
    const status = await runner.getMigrationStatus();
    logger.info(`Migration status: ${status.applied.length} applied, ${status.pending.length} pending, ${status.total} total`);
    
    if (status.pending.length > 0) {
      logger.info(`Pending migrations: ${status.pending.join(', ')}`);
    }
    
    // Run migrations
    logger.info('Starting database migrations...');
    await runner.runMigrations();
    
    // Final status
    const finalStatus = await runner.getMigrationStatus();
    logger.info(`✓ Migration process completed. ${finalStatus.applied.length}/${finalStatus.total} migrations applied`);
    
    process.exit(0);
  } catch (error: any) {
    logger.error('✗ Migration process failed');
    const errorDetails = {
      message: error.message || 'Unknown error',
      code: error.code,
      name: error.name,
      stack: error.stack,
    };
    logger.error('Error details:', errorDetails);
    // Also log to console for better visibility in Docker logs
    console.error('Migration failed with error:', JSON.stringify(errorDetails, null, 2));
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await runner.close();
  }
}

main();

