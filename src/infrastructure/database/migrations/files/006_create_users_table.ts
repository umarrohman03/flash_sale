import { Migration } from '../MigrationRunner';

export const migration: Migration = {
  name: '006_create_users_table',
  up: `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Indexes for users table
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `,
  down: `
    DROP INDEX IF EXISTS idx_users_email;
    DROP INDEX IF EXISTS idx_users_username;
    DROP TABLE IF EXISTS users;
  `,
};

