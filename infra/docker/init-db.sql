-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Ensure tables are created in the public schema (drizzle-kit generates
-- FK references to "public".<table>, so everything must live there).
ALTER ROLE nova SET search_path TO public;

-- Create LiteLLM database (used by LiteLLM proxy for UI auth & key management)
SELECT 'CREATE DATABASE litellm OWNER nova'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'litellm')\gexec
