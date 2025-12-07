import { Migration } from '../MigrationRunner';

export const migration: Migration = {
  name: '004_create_orders_table',
  up: `
    -- Create UUID extension for generating UUIDs (needed for order_uuid and attempt_id)
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Drop old orders table if it exists (from migration 001)
    DROP TABLE IF EXISTS orders CASCADE;

    -- Order status enum type (only create if it doesn't exist)
    DO $$ BEGIN
      CREATE TYPE order_status_t AS ENUM ('PENDING','SUCCESS','FAILED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Orders table (source of truth for final confirmed orders)
    CREATE TABLE orders (
      id BIGSERIAL PRIMARY KEY,
      order_uuid UUID NOT NULL DEFAULT uuid_generate_v4(),
      sale_id BIGINT NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL,
      status order_status_t NOT NULL DEFAULT 'PENDING',
      attempt_id UUID NULL,            -- from the producer to support idempotency
      reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- when Redis reserved
      processed_at TIMESTAMPTZ NULL,   -- when worker finalized
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Guarantee one order per user per sale (final safety net)
    CREATE UNIQUE INDEX ux_orders_sale_user ON orders (sale_id, user_id);

    -- Indexes for orders table
    CREATE INDEX idx_orders_user ON orders (user_id);
    CREATE INDEX idx_orders_sale_status ON orders (sale_id, status);
  `,
  down: `
    DROP TABLE IF EXISTS orders;
    DROP TYPE IF EXISTS order_status_t;
    -- Note: Extension is not dropped as it may be used by other tables
  `,
};

