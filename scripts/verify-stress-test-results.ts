/**
 * Verification Script for Stress Test Results
 * 
 * This script verifies the results of a stress test by:
 * 1. Checking database orders count vs stock
 * 2. Verifying no overselling occurred
 * 3. Comparing Redis stock with database stock
 * 4. Validating concurrency control
 * 
 * Usage:
 *   npm run verify-stress-test -- --saleId=1
 */

import { Pool } from 'pg';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load .env before importing config
dotenv.config({ override: false });

// Import config (will use environment variables loaded above)
import { config } from '../src/config';

dotenv.config({ override: false });

interface VerificationResult {
  saleId: number;
  initialStock: number;
  remainingStock: number;
  ordersCount: number;
  redisStock: number;
  overselling: boolean;
  stockConsistency: boolean;
  purchaseAttemptsCount: number;
}

async function verifyStressTestResults(saleId: number): Promise<VerificationResult> {
  // Connect to PostgreSQL
  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database,
  });

  // Connect to Redis
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
  });

  try {
    // Get flash sale information
    const flashSaleResult = await pool.query(
      `SELECT id, product_id, initial_stock, remaining_stock 
       FROM flash_sales 
       WHERE id = $1`,
      [saleId]
    );

    if (flashSaleResult.rows.length === 0) {
      throw new Error(`Flash sale with ID ${saleId} not found`);
    }

    const flashSale = flashSaleResult.rows[0];
    const productId = flashSale.product_id;
    const initialStock = parseInt(flashSale.initial_stock, 10);
    const remainingStock = parseInt(flashSale.remaining_stock, 10);

    // Count successful orders
    const ordersResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM orders 
       WHERE sale_id = $1 AND status = 'SUCCESS'`,
      [saleId]
    );
    const ordersCount = parseInt(ordersResult.rows[0].count, 10);

    // Count purchase attempts
    const attemptsResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM purchase_attempts 
       WHERE sale_id = $1`,
      [saleId]
    );
    const purchaseAttemptsCount = parseInt(attemptsResult.rows[0].count, 10);

    // Get Redis stock
    const redisStockStr = await redis.get(`flashsale:stock:${productId}`);
    const redisStock = redisStockStr ? parseInt(redisStockStr, 10) : -1;

    // Calculate expected remaining stock
    const expectedRemainingStock = initialStock - ordersCount;
    const overselling = ordersCount > initialStock;
    const stockConsistency = redisStock === remainingStock;

    return {
      saleId,
      initialStock,
      remainingStock,
      ordersCount,
      redisStock,
      overselling,
      stockConsistency,
      purchaseAttemptsCount,
    };
  } finally {
    await pool.end();
    await redis.quit();
  }
}

async function main() {
  const saleId = parseInt(process.argv.find(arg => arg.startsWith('--saleId='))?.split('=')[1] || '1', 10);

  console.log('\n🔍 Verifying Stress Test Results...');
  console.log('='.repeat(60));

  try {
    const result = await verifyStressTestResults(saleId);

    console.log('\n📊 Verification Results:');
    console.log('='.repeat(60));
    console.log(`Sale ID:                 ${result.saleId}`);
    console.log(`Initial Stock:            ${result.initialStock}`);
    console.log(`Remaining Stock (DB):     ${result.remainingStock}`);
    console.log(`Redis Stock:              ${result.redisStock}`);
    console.log(`Successful Orders:        ${result.ordersCount}`);
    console.log(`Purchase Attempts:        ${result.purchaseAttemptsCount}`);
    console.log(`Expected Remaining:       ${result.initialStock - result.ordersCount}`);

    console.log('\n✅ Validation:');
    console.log('='.repeat(60));
    
    // Check overselling
    if (result.overselling) {
      console.log('❌ OVERSELLING DETECTED!');
      console.log(`   Orders (${result.ordersCount}) > Initial Stock (${result.initialStock})`);
      console.log(`   This is a critical bug - concurrency control failed!`);
    } else {
      console.log('✅ No Overselling: Orders <= Initial Stock');
    }

    // Check stock consistency
    if (!result.stockConsistency) {
      console.log('⚠️  Stock Inconsistency:');
      console.log(`   Redis Stock (${result.redisStock}) != DB Remaining Stock (${result.remainingStock})`);
      console.log(`   This may indicate a sync issue`);
    } else {
      console.log('✅ Stock Consistency: Redis matches Database');
    }

    // Check remaining stock calculation
    const expectedRemaining = result.initialStock - result.ordersCount;
    if (result.remainingStock !== expectedRemaining) {
      console.log('⚠️  Remaining Stock Mismatch:');
      console.log(`   Expected: ${expectedRemaining}, Actual: ${result.remainingStock}`);
      console.log(`   Database may need to be updated by worker`);
    } else {
      console.log('✅ Remaining Stock: Matches expected calculation');
    }

    // Summary
    console.log('\n📈 Summary:');
    console.log('='.repeat(60));
    const successRate = (result.ordersCount / result.purchaseAttemptsCount) * 100;
    console.log(`Success Rate:             ${successRate.toFixed(2)}%`);
    console.log(`Stock Utilization:        ${((result.ordersCount / result.initialStock) * 100).toFixed(2)}%`);
    
    if (!result.overselling && result.stockConsistency) {
      console.log('\n✅ All validations passed! Concurrency control is working correctly.');
    } else {
      console.log('\n⚠️  Some validations failed. Review the issues above.');
    }

    console.log('\n' + '='.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { verifyStressTestResults, VerificationResult };

