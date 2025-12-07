import { Migration } from '../MigrationRunner';

export const migration: Migration = {
  name: '002_create_products_table',
  up: `
    -- Products table (single product supported, but schema allows multiple)
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `,
  down: `
    DROP TABLE IF EXISTS products;
  `,
};

