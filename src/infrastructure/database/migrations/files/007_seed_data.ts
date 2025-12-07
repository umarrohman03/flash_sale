import { Migration } from '../MigrationRunner';
import { PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Ensure .env is loaded for this migration
// This is important because migrations might run in contexts where .env isn't loaded
dotenv.config({ override: false });

export const migration: Migration = {
  name: '007_seed_data',
  up: async (client: PoolClient) => {
    console.log('🌱 Starting seed data migration...');
    
    try {
      // Hash passwords for users
      console.log('🔐 Hashing user passwords...');
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const user1PasswordHash = await bcrypt.hash('user123', 10);
      const user2PasswordHash = await bcrypt.hash('user456', 10);
      const user3PasswordHash = await bcrypt.hash('user789', 10);

      // Insert users
      console.log('👥 Inserting users...');
      const userInsertResult = await client.query(`
        INSERT INTO users (username, email, password_hash, full_name)
        VALUES
          ('admin', 'admin@flashsale.com', $1, 'Administrator'),
          ('user1', 'user1@flashsale.com', $2, 'John Doe'),
          ('user2', 'user2@flashsale.com', $3, 'Jane Smith'),
          ('user3', 'user3@flashsale.com', $4, 'Bob Johnson')
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username;
      `, [adminPasswordHash, user1PasswordHash, user2PasswordHash, user3PasswordHash]);
      
      if (userInsertResult.rows.length > 0) {
        console.log(`✓ Inserted ${userInsertResult.rows.length} user(s): ${userInsertResult.rows.map((r: any) => r.username).join(', ')}`);
      } else {
        console.log('⚠ Users already exist, skipping insert');
      }
    } catch (error: any) {
      console.error('❌ Error inserting users:', error.message);
      throw error;
    }

    try {
      // Insert products
      console.log('📦 Inserting products...');
      const productInsertResult = await client.query(`
        INSERT INTO products (sku, name, description)
        VALUES
          ('FLASH-001', 'Premium Smartphone', 'Latest model smartphone with advanced features'),
          ('FLASH-002', 'Wireless Headphones', 'High-quality noise-cancelling wireless headphones'),
          ('FLASH-003', 'Smart Watch', 'Feature-rich smartwatch with health tracking')
        ON CONFLICT (sku) DO NOTHING
        RETURNING id, sku;
      `);
      
      if (productInsertResult.rows.length > 0) {
        console.log(`✓ Inserted ${productInsertResult.rows.length} product(s): ${productInsertResult.rows.map((r: any) => r.sku).join(', ')}`);
      } else {
        console.log('⚠ Products already exist, skipping insert');
      }
    } catch (error: any) {
      console.error('❌ Error inserting products:', error.message);
      throw error;
    }

    try {
      // Insert flash sales
      console.log('⚡ Inserting flash sales...');
      // Get product IDs first
      const productResult = await client.query('SELECT id, sku FROM products WHERE sku = $1', ['FLASH-001']);
      if (productResult.rows.length === 0) {
        console.error('❌ Product FLASH-001 not found. Cannot create flash sale.');
        throw new Error('Product FLASH-001 must exist before creating flash sale');
      }
      
      const productId = productResult.rows[0].id;
      console.log(`📱 Found product FLASH-001 with ID: ${productId}`);
      
      // Create an active flash sale (starting now, ending in 24 hours)
      const startTime = new Date();
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + 24);

      // Use FLASH_SALE_TOTAL_STOCK from .env, default to 1000 if not set
      // Ensure we read from environment (dotenv.config was called at top of file)
      const totalStockEnv = process.env.FLASH_SALE_TOTAL_STOCK;
      const totalStock = totalStockEnv ? parseInt(totalStockEnv, 10) : 1000;
      
      console.log(`📦 Using FLASH_SALE_TOTAL_STOCK=${totalStock} (from env: ${totalStockEnv || 'not set, using default 1000'})`);
      
      // Check if flash sale already exists for this product
      const existingSale = await client.query(
        'SELECT id, initial_stock, remaining_stock FROM flash_sales WHERE product_id = $1',
        [productId]
      );

      if (existingSale.rows.length === 0) {
        // Create new flash sale
        console.log(`🆕 Creating new flash sale for product ${productId}...`);
        const insertResult = await client.query(`
          INSERT INTO flash_sales (product_id, start_at, end_at, initial_stock, remaining_stock)
          VALUES
            ($1, $2, $3, $4, $4)
          RETURNING id, initial_stock, remaining_stock;
        `, [productId, startTime, endTime, totalStock]);
        
        if (insertResult.rows.length > 0) {
          const inserted = insertResult.rows[0];
          console.log(`✅ Successfully created flash sale ID ${inserted.id} for product ${productId} with initial_stock=${inserted.initial_stock} and remaining_stock=${inserted.remaining_stock}`);
        } else {
          throw new Error('Failed to create flash sale - no rows returned');
        }
      } else {
        // Update existing flash sale stock to match .env value (if stock hasn't been decremented)
        const existing = existingSale.rows[0];
        console.log(`⚠️ Flash sale already exists (ID: ${existing.id}, initial_stock: ${existing.initial_stock}, remaining_stock: ${existing.remaining_stock})`);
        
        // Only update if remaining_stock equals initial_stock (no purchases made yet)
        const updateResult = await client.query(`
          UPDATE flash_sales 
          SET initial_stock = $1, remaining_stock = $1
          WHERE product_id = $2 AND initial_stock = remaining_stock
          RETURNING id, initial_stock, remaining_stock;
        `, [totalStock, productId]);
        
        if (updateResult.rows.length > 0) {
          const updated = updateResult.rows[0];
          console.log(`✅ Successfully updated flash sale ID ${updated.id} for product ${productId} to initial_stock=${updated.initial_stock} and remaining_stock=${updated.remaining_stock}`);
        } else {
          console.log(`⚠️ Flash sale for product ${productId} exists but stock has been modified (initial_stock=${existing.initial_stock}, remaining_stock=${existing.remaining_stock}), skipping update`);
        }
      }
      
      // Verify the flash sale was created/updated correctly
      const verifyResult = await client.query(
        'SELECT id, product_id, initial_stock, remaining_stock FROM flash_sales WHERE product_id = $1',
        [productId]
      );
      
      if (verifyResult.rows.length > 0) {
        const verified = verifyResult.rows[0];
        console.log(`✅ Verification: Flash sale ID ${verified.id} has initial_stock=${verified.initial_stock} and remaining_stock=${verified.remaining_stock}`);
      } else {
        console.error('❌ Verification failed: Flash sale not found after insert/update');
        throw new Error('Flash sale was not created/updated successfully');
      }
    } catch (error: any) {
      console.error('❌ Error inserting flash sales:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
    
    console.log('✅ Seed data migration completed successfully!');
  },
  down: async (client: PoolClient) => {
    // Remove seed data
    await client.query(`DELETE FROM flash_sales WHERE product_id IN (SELECT id FROM products WHERE sku IN ('FLASH-001', 'FLASH-002', 'FLASH-003'));`);
    await client.query(`DELETE FROM products WHERE sku IN ('FLASH-001', 'FLASH-002', 'FLASH-003');`);
    await client.query(`DELETE FROM users WHERE username IN ('admin', 'user1', 'user2', 'user3');`);
  },
};


