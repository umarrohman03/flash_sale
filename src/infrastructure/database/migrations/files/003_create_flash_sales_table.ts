import { Migration } from '../MigrationRunner';

export const migration: Migration = {
  name: '003_create_flash_sales_table',
  up: `
    -- Flash sales table (one row per flash sale event)
    CREATE TABLE IF NOT EXISTS flash_sales (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      initial_stock BIGINT NOT NULL CHECK (initial_stock >= 0),
      remaining_stock BIGINT NOT NULL CHECK (remaining_stock >= 0),
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Indexes for flash_sales table
    CREATE INDEX IF NOT EXISTS idx_flash_sales_product ON flash_sales(product_id);
    CREATE INDEX IF NOT EXISTS idx_flash_sales_time ON flash_sales(start_at, end_at);
  `,
  down: `
    DROP TABLE IF EXISTS flash_sales;
  `,
};

