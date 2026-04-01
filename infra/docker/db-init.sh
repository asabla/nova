#!/bin/sh
set -e
echo "=== NOVA DB Init ==="

cd /app/packages/api

echo "[1/3] Applying database schema..."
# Use db:push for dev — ensures schema matches code regardless of migration state
bunx drizzle-kit push

# Ensure Better Auth tables exist (they're not in drizzle-kit migrations)
bun -e "
const { drizzle } = await import('drizzle-orm/postgres-js');
const { sql } = await import('drizzle-orm');
const pg = await import('postgres');
const postgres = pg.default;
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
await db.execute(sql\`
  CREATE TABLE IF NOT EXISTS \"user\" (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    email_verified boolean NOT NULL DEFAULT false,
    image text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS account (
    id text PRIMARY KEY,
    account_id text NOT NULL,
    provider_id text NOT NULL,
    user_id text NOT NULL REFERENCES \"user\"(id),
    access_token text,
    refresh_token text,
    id_token text,
    access_token_expires_at timestamp,
    refresh_token_expires_at timestamp,
    scope text,
    password text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS session (
    id text PRIMARY KEY,
    expires_at timestamp NOT NULL,
    token text NOT NULL UNIQUE,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text,
    user_id text NOT NULL REFERENCES \"user\"(id),
    active_organization_id text
  );
  CREATE TABLE IF NOT EXISTS verification (
    id text PRIMARY KEY,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS organization (
    id text PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE,
    logo text,
    created_at timestamp NOT NULL DEFAULT now(),
    metadata text
  );
  CREATE TABLE IF NOT EXISTS member (
    id text PRIMARY KEY,
    organization_id text NOT NULL REFERENCES organization(id),
    user_id text NOT NULL REFERENCES \"user\"(id),
    role text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS invitation (
    id text PRIMARY KEY,
    organization_id text NOT NULL REFERENCES organization(id),
    email text NOT NULL,
    role text,
    status text NOT NULL,
    expires_at timestamp NOT NULL,
    inviter_id text NOT NULL REFERENCES \"user\"(id)
  );
\`);
await client.end();
console.log('  Better Auth tables ensured.');
"

echo "[2/3] Seeding database..."
bun run src/lib/seed.ts

echo "[3/3] Ensuring MinIO bucket..."
bun run /app/db-init-bucket.ts

echo "=== DB Init complete ==="
