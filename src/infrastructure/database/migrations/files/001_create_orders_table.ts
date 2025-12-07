import { Migration } from '../MigrationRunner';

export const migration: Migration = {
  name: '001_create_orders_table',
  up: `
    -- Create orders table
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      product_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    );

    -- Create index on user_id for fast lookups
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

    -- Create index on product_id
    CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);

    -- Create index on status
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

    -- Create index on created_at for time-based queries
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
  `,
  down: `
    -- Drop indexes
    DROP INDEX IF EXISTS idx_orders_created_at;
    DROP INDEX IF EXISTS idx_orders_status;
    DROP INDEX IF EXISTS idx_orders_product_id;
    DROP INDEX IF EXISTS idx_orders_user_id;

    -- Drop table
    DROP TABLE IF EXISTS orders;
  `,
};

