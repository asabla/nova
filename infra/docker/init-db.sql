-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pgvector extension removed — vector search moved to Qdrant
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Ensure tables are created in the public schema (drizzle-kit generates
-- FK references to "public".<table>, so everything must live there).
ALTER ROLE nova SET search_path TO public;
