import { Migration } from '../MigrationRunner';

export const migration: Migration = {
  name: '005_create_purchase_attempts_table',
  up: `
    -- Purchase attempts table (audit/log) - optional but recommended
    CREATE TABLE IF NOT EXISTS purchase_attempts (
      id BIGSERIAL PRIMARY KEY,
      attempt_uuid UUID NOT NULL DEFAULT uuid_generate_v4(),
      sale_id BIGINT NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL,
      attempt_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Indexes for purchase_attempts table
    CREATE INDEX IF NOT EXISTS idx_attempts_sale ON purchase_attempts (sale_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON purchase_attempts (user_id);
  `,
  down: `
    DROP TABLE IF EXISTS purchase_attempts;
  `,
};

