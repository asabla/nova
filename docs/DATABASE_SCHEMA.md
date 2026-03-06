# NOVA -- Database Schema (PostgreSQL 16)

> Version: 1.0
> Date: 2026-03-06
> Generated from: `DOMAIN_MODEL.md` (59 entities), `SECURITY.md`, `TECHNOLOGY_RESEARCH.md`

---

## Overview

This document contains the complete SQL DDL for the NOVA AI chat platform. It is designed for PostgreSQL 16 with the following extensions:

- **pgcrypto** -- cryptographic functions (`gen_random_uuid()`)
- **vector** -- pgvector for RAG embeddings (HNSW indexes)
- **pg_trgm** -- trigram-based fuzzy text search (GIN indexes)
- **uuid-ossp** -- UUID generation utilities

All tables follow these conventions:

| Convention | Implementation |
|---|---|
| Primary keys | UUID v7 (app-generated, `gen_random_uuid()` as DB default fallback) |
| Timestamps | `created_at`, `updated_at` (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`) |
| Soft delete | `deleted_at TIMESTAMPTZ` (nullable) on every table except append-only tables |
| Tenancy | `org_id UUID NOT NULL` on every org-scoped table |
| Text enums | `CHECK` constraints (not Postgres ENUM types) for easier migration |
| Foreign keys | `ON DELETE CASCADE` for child records, `SET NULL` for optional refs, `RESTRICT` for critical refs |

---

## Full DDL

```sql
-- ============================================================================
-- NOVA Database Schema -- PostgreSQL 16
-- ============================================================================

-- --------------------------------------------------------------------------
-- 0. Extensions
-- --------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------------
-- 0.1 Shared trigger function for updated_at
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. Organisation & Settings
-- ============================================================================

-- 1.1 organisations
CREATE TABLE organisations (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name            TEXT        NOT NULL,
    slug            TEXT        NOT NULL,
    domain          TEXT,
    logo_url        TEXT,
    favicon_url     TEXT,
    primary_color   TEXT,
    custom_css      TEXT,
    billing_plan    TEXT        CHECK (billing_plan IN ('free', 'pro', 'enterprise')),
    billing_customer_id TEXT,
    is_saas         BOOLEAN     NOT NULL DEFAULT false,
    setup_completed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_organisations_slug ON organisations (slug);
CREATE UNIQUE INDEX idx_organisations_domain ON organisations (domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_organisations_active ON organisations (id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_organisations_updated_at
    BEFORE UPDATE ON organisations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 1.2 org_settings
CREATE TABLE org_settings (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    key         TEXT        NOT NULL,
    value       JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_org_settings_org_key ON org_settings (org_id, key) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_org_settings_updated_at
    BEFORE UPDATE ON org_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. Users & Identity
-- ============================================================================

-- 2.1 users
CREATE TABLE users (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email               TEXT        NOT NULL,
    email_verified_at   TIMESTAMPTZ,
    password_hash       TEXT,
    password_changed_at TIMESTAMPTZ,
    is_super_admin      BOOLEAN     NOT NULL DEFAULT false,
    is_active           BOOLEAN     NOT NULL DEFAULT true,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users (id) WHERE deleted_at IS NULL AND is_active = true;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2.2 user_profiles
CREATE TABLE user_profiles (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    display_name            TEXT,
    avatar_url              TEXT,
    timezone                TEXT        DEFAULT 'UTC',
    locale                  TEXT        DEFAULT 'en',
    theme                   TEXT        DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    font_size               TEXT        DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
    role                    TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('org-admin', 'power-user', 'member', 'viewer')),
    onboarding_completed_at TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_user_profiles_user_org ON user_profiles (user_id, org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_profiles_org_id ON user_profiles (org_id);

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2.3 sessions
CREATE TABLE sessions (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_active ON sessions (user_id, expires_at) WHERE revoked_at IS NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2.4 mfa_credentials
CREATE TABLE mfa_credentials (
    id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type              TEXT        NOT NULL CHECK (type IN ('totp', 'webauthn')),
    secret_encrypted  TEXT        NOT NULL,
    label             TEXT,
    last_used_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_mfa_credentials_user_id ON mfa_credentials (user_id);

CREATE TRIGGER trg_mfa_credentials_updated_at
    BEFORE UPDATE ON mfa_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. Groups & Membership
-- ============================================================================

-- 3.1 groups
CREATE TABLE groups (
    id                          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name                        TEXT        NOT NULL,
    description                 TEXT,
    sso_group_id                TEXT,
    model_access                JSONB,
    monthly_token_limit         BIGINT,
    monthly_cost_limit_cents    INTEGER,
    storage_quota_mb            INTEGER,
    data_retention_days         INTEGER,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX idx_groups_org_id ON groups (org_id);
CREATE UNIQUE INDEX idx_groups_org_name ON groups (org_id, name) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3.2 group_memberships
CREATE TABLE group_memberships (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_group_memberships_group_user ON group_memberships (group_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_group_memberships_org_id ON group_memberships (org_id);
CREATE INDEX idx_group_memberships_user_id ON group_memberships (user_id);

CREATE TRIGGER trg_group_memberships_updated_at
    BEFORE UPDATE ON group_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 4. SSO & External Identity
-- ============================================================================

-- 4.1 sso_providers
CREATE TABLE sso_providers (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    type                    TEXT        NOT NULL CHECK (type IN ('oidc', 'saml')),
    provider_name           TEXT        NOT NULL CHECK (provider_name IN ('azure_ad', 'google', 'github', 'gitlab', 'custom')),
    client_id               TEXT        NOT NULL,
    client_secret_encrypted TEXT        NOT NULL,
    issuer_url              TEXT,
    metadata_url            TEXT,
    is_enabled              BOOLEAN     NOT NULL DEFAULT true,
    auto_provision_users    BOOLEAN     NOT NULL DEFAULT false,
    default_role            TEXT        NOT NULL DEFAULT 'member' CHECK (default_role IN ('org-admin', 'power-user', 'member', 'viewer')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_sso_providers_org_id ON sso_providers (org_id);

CREATE TRIGGER trg_sso_providers_updated_at
    BEFORE UPDATE ON sso_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4.2 sso_sessions
CREATE TABLE sso_sessions (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id              UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sso_provider_id         UUID        NOT NULL REFERENCES sso_providers(id) ON DELETE RESTRICT,
    external_user_id        TEXT        NOT NULL,
    access_token_encrypted  TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_sso_sessions_session_id ON sso_sessions (session_id);
CREATE INDEX idx_sso_sessions_provider_external ON sso_sessions (sso_provider_id, external_user_id);

CREATE TRIGGER trg_sso_sessions_updated_at
    BEFORE UPDATE ON sso_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 5. API Keys
-- ============================================================================

-- 5.1 api_keys
CREATE TABLE api_keys (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    key_prefix  TEXT        NOT NULL,
    key_hash    TEXT        NOT NULL,
    scopes      JSONB       NOT NULL DEFAULT '[]',
    last_used_at TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_org_user ON api_keys (org_id, user_id);
CREATE INDEX idx_api_keys_active ON api_keys (org_id) WHERE revoked_at IS NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 6. Workspaces
-- ============================================================================

-- 6.1 workspaces
-- Note: default_agent_id and default_model_id FKs are added after agents/models tables are created.
CREATE TABLE workspaces (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name                    TEXT        NOT NULL,
    description             TEXT,
    owner_id                UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    default_agent_id        UUID,
    default_model_id        UUID,
    default_system_prompt   TEXT,
    is_archived             BOOLEAN     NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_workspaces_org_id ON workspaces (org_id);
CREATE INDEX idx_workspaces_owner_id ON workspaces (owner_id);
CREATE INDEX idx_workspaces_org_active ON workspaces (org_id) WHERE deleted_at IS NULL AND is_archived = false;

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6.2 workspace_memberships
CREATE TABLE workspace_memberships (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
    group_id        UUID        REFERENCES groups(id) ON DELETE CASCADE,
    org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_workspace_memberships_target CHECK ((user_id IS NOT NULL) != (group_id IS NOT NULL))
);

CREATE UNIQUE INDEX idx_workspace_memberships_user ON workspace_memberships (workspace_id, user_id)
    WHERE user_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_workspace_memberships_group ON workspace_memberships (workspace_id, group_id)
    WHERE group_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_workspace_memberships_org_id ON workspace_memberships (org_id);

CREATE TRIGGER trg_workspace_memberships_updated_at
    BEFORE UPDATE ON workspace_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 7. Conversations
-- ============================================================================

-- 7.1 conversations
-- Note: model_id FK added after models table is created.
CREATE TABLE conversations (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    workspace_id            UUID        REFERENCES workspaces(id) ON DELETE SET NULL,
    owner_id                UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title                   TEXT,
    visibility              TEXT        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
    model_id                UUID,
    system_prompt           TEXT,
    model_params            JSONB,
    is_pinned               BOOLEAN     NOT NULL DEFAULT false,
    is_archived             BOOLEAN     NOT NULL DEFAULT false,
    forked_from_message_id  UUID,
    public_share_token      TEXT,
    total_tokens            BIGINT      NOT NULL DEFAULT 0,
    estimated_cost_cents    INTEGER     NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_conversations_org_owner ON conversations (org_id, owner_id, created_at DESC);
CREATE INDEX idx_conversations_workspace ON conversations (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX idx_conversations_share_token ON conversations (public_share_token) WHERE public_share_token IS NOT NULL;
CREATE INDEX idx_conversations_org_active ON conversations (org_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_title_trgm ON conversations USING gin (title gin_trgm_ops) WHERE title IS NOT NULL;

CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7.2 conversation_participants
CREATE TABLE conversation_participants (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    role                TEXT        NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'participant', 'viewer')),
    last_read_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_conversation_participants_conv_user ON conversation_participants (conversation_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversation_participants_org_id ON conversation_participants (org_id);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants (user_id);

CREATE TRIGGER trg_conversation_participants_updated_at
    BEFORE UPDATE ON conversation_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7.3 messages
-- Note: agent_id and model_id FKs added after agents/models tables are created.
CREATE TABLE messages (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id         UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    parent_message_id       UUID        REFERENCES messages(id) ON DELETE SET NULL,
    sender_type             TEXT        NOT NULL CHECK (sender_type IN ('user', 'assistant', 'system', 'tool')),
    sender_user_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
    agent_id                UUID,
    model_id                UUID,
    content                 TEXT,
    content_type            TEXT        NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'video', 'file')),
    metadata                JSONB,
    token_count_prompt      INTEGER,
    token_count_completion  INTEGER,
    cost_cents              INTEGER,
    is_edited               BOOLEAN     NOT NULL DEFAULT false,
    edit_history            JSONB,
    status                  TEXT        NOT NULL DEFAULT 'completed' CHECK (status IN ('streaming', 'completed', 'failed', 'cancelled')),
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_org_id ON messages (org_id);
CREATE INDEX idx_messages_parent ON messages (parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX idx_messages_sender_user ON messages (sender_user_id) WHERE sender_user_id IS NOT NULL;
CREATE INDEX idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops) WHERE content IS NOT NULL;
CREATE INDEX idx_messages_active ON messages (conversation_id, created_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7.4 message_attachments
CREATE TABLE message_attachments (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id          UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    file_id             UUID,
    url                 TEXT,
    url_title           TEXT,
    url_preview         JSONB,
    attachment_type     TEXT        NOT NULL CHECK (attachment_type IN ('file', 'url', 'image_paste')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments (message_id);
CREATE INDEX idx_message_attachments_file_id ON message_attachments (file_id) WHERE file_id IS NOT NULL;
CREATE INDEX idx_message_attachments_org_id ON message_attachments (org_id);

CREATE TRIGGER trg_message_attachments_updated_at
    BEFORE UPDATE ON message_attachments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7.5 message_ratings
CREATE TABLE message_ratings (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id  UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    rating      SMALLINT    NOT NULL CHECK (rating IN (1, -1)),
    feedback    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_message_ratings_message_user ON message_ratings (message_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_message_ratings_org_id ON message_ratings (org_id);

CREATE TRIGGER trg_message_ratings_updated_at
    BEFORE UPDATE ON message_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7.6 message_notes
CREATE TABLE message_notes (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id  UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_message_notes_message_user ON message_notes (message_id, user_id);
CREATE INDEX idx_message_notes_org_id ON message_notes (org_id);

CREATE TRIGGER trg_message_notes_updated_at
    BEFORE UPDATE ON message_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 8. Conversation Organisation
-- ============================================================================

-- 8.1 conversation_folders
CREATE TABLE conversation_folders (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    parent_folder_id    UUID        REFERENCES conversation_folders(id) ON DELETE CASCADE,
    sort_order          INTEGER     NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_conversation_folders_org_user ON conversation_folders (org_id, user_id);
CREATE INDEX idx_conversation_folders_parent ON conversation_folders (parent_folder_id) WHERE parent_folder_id IS NOT NULL;

CREATE TRIGGER trg_conversation_folders_updated_at
    BEFORE UPDATE ON conversation_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8.2 conversation_tags
CREATE TABLE conversation_tags (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    color       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_conversation_tags_org_user_name ON conversation_tags (org_id, user_id, name) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_conversation_tags_updated_at
    BEFORE UPDATE ON conversation_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8.3 conversation_tag_assignments
CREATE TABLE conversation_tag_assignments (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id         UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    conversation_tag_id     UUID        REFERENCES conversation_tags(id) ON DELETE CASCADE,
    conversation_folder_id  UUID        REFERENCES conversation_folders(id) ON DELETE CASCADE,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT chk_tag_assignments_target CHECK (conversation_tag_id IS NOT NULL OR conversation_folder_id IS NOT NULL)
);

CREATE INDEX idx_conversation_tag_assignments_conv ON conversation_tag_assignments (conversation_id);
CREATE INDEX idx_conversation_tag_assignments_tag ON conversation_tag_assignments (conversation_tag_id) WHERE conversation_tag_id IS NOT NULL;
CREATE INDEX idx_conversation_tag_assignments_folder ON conversation_tag_assignments (conversation_folder_id) WHERE conversation_folder_id IS NOT NULL;
CREATE INDEX idx_conversation_tag_assignments_org ON conversation_tag_assignments (org_id);

-- Note: conversation_tag_assignments has no updated_at (only created_at and deleted_at per domain model)

-- ============================================================================
-- 9. Files & Storage
-- ============================================================================

-- 9.1 files
CREATE TABLE files (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    workspace_id        UUID        REFERENCES workspaces(id) ON DELETE SET NULL,
    filename            TEXT        NOT NULL,
    content_type        TEXT        NOT NULL,
    size_bytes          BIGINT      NOT NULL,
    storage_path        TEXT        NOT NULL,
    storage_bucket      TEXT        NOT NULL,
    checksum_sha256     TEXT,
    is_public           BOOLEAN     NOT NULL DEFAULT false,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_files_org_user ON files (org_id, user_id);
CREATE INDEX idx_files_workspace ON files (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX idx_files_org_active ON files (org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_filename_trgm ON files USING gin (filename gin_trgm_ops);

CREATE TRIGGER trg_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Now add the file_id FK on message_attachments
ALTER TABLE message_attachments
    ADD CONSTRAINT fk_message_attachments_file
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL;

-- 9.2 file_chunks
CREATE TABLE file_chunks (
    id              UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id         UUID            NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    org_id          UUID            NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    chunk_index     INTEGER         NOT NULL,
    content         TEXT            NOT NULL,
    embedding       vector(1536),
    token_count     INTEGER,
    metadata        JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_file_chunks_file_index ON file_chunks (file_id, chunk_index);
CREATE INDEX idx_file_chunks_org_id ON file_chunks (org_id);
CREATE INDEX idx_file_chunks_embedding ON file_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_file_chunks_content_trgm ON file_chunks USING gin (content gin_trgm_ops);

CREATE TRIGGER trg_file_chunks_updated_at
    BEFORE UPDATE ON file_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 10. Knowledge Collections
-- ============================================================================

-- 10.1 knowledge_collections
-- Note: embedding_model_id FK added after models table is created.
CREATE TABLE knowledge_collections (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    owner_id            UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name                TEXT        NOT NULL,
    description         TEXT,
    visibility          TEXT        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
    embedding_model_id  UUID,
    chunk_size          INTEGER     NOT NULL DEFAULT 512,
    chunk_overlap       INTEGER     NOT NULL DEFAULT 64,
    version             INTEGER     NOT NULL DEFAULT 1,
    last_indexed_at     TIMESTAMPTZ,
    status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'ready', 'error')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_collections_org_owner ON knowledge_collections (org_id, owner_id);
CREATE INDEX idx_knowledge_collections_org_active ON knowledge_collections (org_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_knowledge_collections_updated_at
    BEFORE UPDATE ON knowledge_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 10.2 knowledge_documents
CREATE TABLE knowledge_documents (
    id                          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_collection_id     UUID        NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    org_id                      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    file_id                     UUID        REFERENCES files(id) ON DELETE SET NULL,
    source_url                  TEXT,
    title                       TEXT,
    status                      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    error_message               TEXT,
    token_count                 INTEGER,
    chunk_count                 INTEGER,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_documents_collection ON knowledge_documents (knowledge_collection_id);
CREATE INDEX idx_knowledge_documents_file ON knowledge_documents (file_id) WHERE file_id IS NOT NULL;
CREATE INDEX idx_knowledge_documents_org_id ON knowledge_documents (org_id);

CREATE TRIGGER trg_knowledge_documents_updated_at
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 10.3 knowledge_chunks
CREATE TABLE knowledge_chunks (
    id                          UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_document_id       UUID            NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    knowledge_collection_id     UUID            NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    org_id                      UUID            NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    chunk_index                 INTEGER         NOT NULL,
    content                     TEXT            NOT NULL,
    embedding                   vector(1536),
    token_count                 INTEGER,
    metadata                    JSONB,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_chunks_document_index ON knowledge_chunks (knowledge_document_id, chunk_index);
CREATE INDEX idx_knowledge_chunks_collection ON knowledge_chunks (knowledge_collection_id);
CREATE INDEX idx_knowledge_chunks_org_id ON knowledge_chunks (org_id);
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_chunks_content_trgm ON knowledge_chunks USING gin (content gin_trgm_ops);

CREATE TRIGGER trg_knowledge_chunks_updated_at
    BEFORE UPDATE ON knowledge_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 11. Agents
-- ============================================================================

-- 11.1 agents
CREATE TABLE agents (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    owner_id                UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name                    TEXT        NOT NULL,
    description             TEXT,
    avatar_url              TEXT,
    system_prompt           TEXT,
    model_id                UUID,
    model_params            JSONB,
    visibility              TEXT        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'org', 'public')),
    is_published            BOOLEAN     NOT NULL DEFAULT false,
    tool_approval_mode      TEXT        NOT NULL DEFAULT 'always-ask' CHECK (tool_approval_mode IN ('auto', 'always-ask', 'never')),
    memory_scope            TEXT        NOT NULL DEFAULT 'per-user' CHECK (memory_scope IN ('per-user', 'per-conversation', 'global')),
    max_steps               INTEGER,
    timeout_seconds         INTEGER,
    webhook_url             TEXT,
    cron_schedule           TEXT,
    is_enabled              BOOLEAN     NOT NULL DEFAULT true,
    cloned_from_agent_id    UUID        REFERENCES agents(id) ON DELETE SET NULL,
    current_version         INTEGER     NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_agents_org_id ON agents (org_id);
CREATE INDEX idx_agents_owner_id ON agents (owner_id);
CREATE INDEX idx_agents_visibility ON agents (visibility);
CREATE INDEX idx_agents_org_active ON agents (org_id) WHERE deleted_at IS NULL AND is_enabled = true;

CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11.2 agent_versions
CREATE TABLE agent_versions (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id            UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    version             INTEGER     NOT NULL,
    system_prompt       TEXT,
    model_id            UUID,
    model_params        JSONB,
    config_snapshot     JSONB       NOT NULL,
    changelog           TEXT,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_agent_versions_agent_version ON agent_versions (agent_id, version) WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_versions_org_id ON agent_versions (org_id);

CREATE TRIGGER trg_agent_versions_updated_at
    BEFORE UPDATE ON agent_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11.3 agent_skills
CREATE TABLE agent_skills (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id    UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    skill_name  TEXT        NOT NULL,
    config      JSONB,
    is_enabled  BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_agent_skills_agent_skill ON agent_skills (agent_id, skill_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_skills_org_id ON agent_skills (org_id);

CREATE TRIGGER trg_agent_skills_updated_at
    BEFORE UPDATE ON agent_skills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11.4 agent_tools (FK to tools added after tools table)
CREATE TABLE agent_tools (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id            UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tool_id             UUID        NOT NULL,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    config_overrides    JSONB,
    is_enabled          BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_agent_tools_agent_tool ON agent_tools (agent_id, tool_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_tools_org_id ON agent_tools (org_id);

CREATE TRIGGER trg_agent_tools_updated_at
    BEFORE UPDATE ON agent_tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11.5 agent_mcp_servers (FK to mcp_servers added after mcp_servers table)
CREATE TABLE agent_mcp_servers (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id        UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    mcp_server_id   UUID        NOT NULL,
    org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    is_enabled      BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_agent_mcp_servers_agent_mcp ON agent_mcp_servers (agent_id, mcp_server_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_mcp_servers_org_id ON agent_mcp_servers (org_id);

CREATE TRIGGER trg_agent_mcp_servers_updated_at
    BEFORE UPDATE ON agent_mcp_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11.6 agent_memory_entries
CREATE TABLE agent_memory_entries (
    id                  UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id            UUID            NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    org_id              UUID            NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id             UUID            REFERENCES users(id) ON DELETE CASCADE,
    conversation_id     UUID            REFERENCES conversations(id) ON DELETE CASCADE,
    scope               TEXT            NOT NULL CHECK (scope IN ('per-user', 'per-conversation', 'global')),
    key                 TEXT            NOT NULL,
    value               JSONB           NOT NULL,
    embedding           vector(1536),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_agent_memory_agent_scope ON agent_memory_entries (agent_id, scope);
CREATE INDEX idx_agent_memory_agent_user ON agent_memory_entries (agent_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_agent_memory_agent_conv ON agent_memory_entries (agent_id, conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_agent_memory_org_id ON agent_memory_entries (org_id);
CREATE INDEX idx_agent_memory_embedding ON agent_memory_entries USING hnsw (embedding vector_cosine_ops);

CREATE TRIGGER trg_agent_memory_entries_updated_at
    BEFORE UPDATE ON agent_memory_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11.7 agent_knowledge_collections
CREATE TABLE agent_knowledge_collections (
    id                          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id                    UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    knowledge_collection_id     UUID        NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    org_id                      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_agent_knowledge_collections_agent_kc ON agent_knowledge_collections (agent_id, knowledge_collection_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agent_knowledge_collections_org_id ON agent_knowledge_collections (org_id);

-- Note: agent_knowledge_collections has no updated_at per domain model

-- ============================================================================
-- 12. MCP Servers
-- ============================================================================

-- 12.1 mcp_servers
CREATE TABLE mcp_servers (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name                    TEXT        NOT NULL,
    description             TEXT,
    url                     TEXT        NOT NULL,
    auth_type               TEXT        CHECK (auth_type IN ('none', 'bearer', 'api_key')),
    auth_token_encrypted    TEXT,
    is_approved             BOOLEAN     NOT NULL DEFAULT false,
    is_enabled              BOOLEAN     NOT NULL DEFAULT true,
    health_status           TEXT        CHECK (health_status IN ('healthy', 'degraded', 'down', 'unknown')),
    last_health_check_at    TIMESTAMPTZ,
    registered_by_id        UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_mcp_servers_org_id ON mcp_servers (org_id);
CREATE UNIQUE INDEX idx_mcp_servers_org_url ON mcp_servers (org_id, url) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_mcp_servers_updated_at
    BEFORE UPDATE ON mcp_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add deferred FK for agent_mcp_servers
ALTER TABLE agent_mcp_servers
    ADD CONSTRAINT fk_agent_mcp_servers_mcp_server
    FOREIGN KEY (mcp_server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE;

-- 12.2 mcp_tools
CREATE TABLE mcp_tools (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    mcp_server_id   UUID        NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    description     TEXT,
    input_schema    JSONB,
    is_enabled      BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_mcp_tools_server_name ON mcp_tools (mcp_server_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_mcp_tools_org_id ON mcp_tools (org_id);

CREATE TRIGGER trg_mcp_tools_updated_at
    BEFORE UPDATE ON mcp_tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 13. Tools & Function Calling
-- ============================================================================

-- 13.1 tools
CREATE TABLE tools (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    description         TEXT,
    type                TEXT        NOT NULL CHECK (type IN ('builtin', 'openapi', 'custom')),
    openapi_spec        JSONB,
    function_schema     JSONB       NOT NULL,
    is_approved         BOOLEAN     NOT NULL DEFAULT false,
    is_enabled          BOOLEAN     NOT NULL DEFAULT true,
    registered_by_id    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    current_version     INTEGER     NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_tools_org_id ON tools (org_id);
CREATE UNIQUE INDEX idx_tools_org_name ON tools (org_id, name) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tools_updated_at
    BEFORE UPDATE ON tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add deferred FK for agent_tools
ALTER TABLE agent_tools
    ADD CONSTRAINT fk_agent_tools_tool
    FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE CASCADE;

-- 13.2 tool_versions
CREATE TABLE tool_versions (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tool_id         UUID        NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    version         INTEGER     NOT NULL,
    function_schema JSONB       NOT NULL,
    openapi_spec    JSONB,
    changelog       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_tool_versions_tool_version ON tool_versions (tool_id, version) WHERE deleted_at IS NULL;
CREATE INDEX idx_tool_versions_org_id ON tool_versions (org_id);

CREATE TRIGGER trg_tool_versions_updated_at
    BEFORE UPDATE ON tool_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 13.3 tool_calls
CREATE TABLE tool_calls (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id          UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    tool_id             UUID        REFERENCES tools(id) ON DELETE SET NULL,
    mcp_tool_id         UUID        REFERENCES mcp_tools(id) ON DELETE SET NULL,
    tool_name           TEXT        NOT NULL,
    input               JSONB       NOT NULL,
    output              JSONB,
    status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'running', 'completed', 'failed')),
    approved_by_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMPTZ,
    duration_ms         INTEGER,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_tool_calls_message_id ON tool_calls (message_id);
CREATE INDEX idx_tool_calls_conversation_id ON tool_calls (conversation_id);
CREATE INDEX idx_tool_calls_org_id ON tool_calls (org_id);
CREATE INDEX idx_tool_calls_tool_id ON tool_calls (tool_id) WHERE tool_id IS NOT NULL;
CREATE INDEX idx_tool_calls_mcp_tool_id ON tool_calls (mcp_tool_id) WHERE mcp_tool_id IS NOT NULL;

CREATE TRIGGER trg_tool_calls_updated_at
    BEFORE UPDATE ON tool_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 14. Artifacts
-- ============================================================================

-- 14.1 artifacts
CREATE TABLE artifacts (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id          UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    type                TEXT        NOT NULL CHECK (type IN ('code', 'image', 'audio', 'video', 'document', 'chart', 'mermaid', 'latex', 'html', 'csv_table', 'widget')),
    title               TEXT,
    content             TEXT,
    file_id             UUID        REFERENCES files(id) ON DELETE SET NULL,
    language            TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_artifacts_message_id ON artifacts (message_id);
CREATE INDEX idx_artifacts_conversation_id ON artifacts (conversation_id);
CREATE INDEX idx_artifacts_org_id ON artifacts (org_id);
CREATE INDEX idx_artifacts_file_id ON artifacts (file_id) WHERE file_id IS NOT NULL;

CREATE TRIGGER trg_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 15. Workflows
-- ============================================================================

-- 15.1 workflows
CREATE TABLE workflows (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    temporal_workflow_id    TEXT        NOT NULL,
    temporal_run_id         TEXT,
    type                    TEXT        NOT NULL CHECK (type IN ('agent_run', 'deep_research', 'file_ingestion', 'knowledge_index', 'scheduled_agent', 'batch_job', 'data_export', 'data_import')),
    status                  TEXT        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'timed_out', 'waiting_for_input')),
    conversation_id         UUID        REFERENCES conversations(id) ON DELETE SET NULL,
    agent_id                UUID        REFERENCES agents(id) ON DELETE SET NULL,
    initiated_by_id         UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    input                   JSONB,
    output                  JSONB,
    error_message           TEXT,
    progress                JSONB,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_workflows_org_id ON workflows (org_id);
CREATE INDEX idx_workflows_temporal_wf_id ON workflows (temporal_workflow_id);
CREATE INDEX idx_workflows_conversation_id ON workflows (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_workflows_agent_id ON workflows (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_workflows_org_status ON workflows (org_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 16. Audit Logs
-- ============================================================================

-- 16.1 audit_logs
-- Immutable, append-only. No updated_at, no deleted_at.
CREATE TABLE audit_logs (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID        REFERENCES organisations(id) ON DELETE RESTRICT,
    actor_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    actor_type      TEXT        NOT NULL CHECK (actor_type IN ('user', 'system', 'api_key', 'agent')),
    impersonator_id UUID        REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT        NOT NULL,
    resource_type   TEXT        NOT NULL,
    resource_id     UUID,
    details         JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_created ON audit_logs (org_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- No trigger: audit_logs has no updated_at

-- ============================================================================
-- 17. Notifications
-- ============================================================================

-- 17.1 notifications
CREATE TABLE notifications (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT        NOT NULL CHECK (type IN ('mention', 'share', 'agent_complete', 'budget_warning', 'system_status')),
    title           TEXT        NOT NULL,
    body            TEXT,
    resource_type   TEXT,
    resource_id     UUID,
    channel         TEXT        NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'webhook', 'slack')),
    is_read         BOOLEAN     NOT NULL DEFAULT false,
    read_at         TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_org_id ON notifications (org_id);
CREATE INDEX idx_notifications_active ON notifications (user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 17.2 notification_preferences
CREATE TABLE notification_preferences (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    notification_type   TEXT        NOT NULL,
    channel             TEXT        NOT NULL CHECK (channel IN ('in_app', 'email', 'webhook', 'slack')),
    is_enabled          BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_notification_prefs_unique ON notification_preferences (user_id, org_id, notification_type, channel) WHERE deleted_at IS NULL;
CREATE INDEX idx_notification_preferences_org_id ON notification_preferences (org_id);

CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 18. Usage & Analytics
-- ============================================================================

-- 18.1 usage_stats
CREATE TABLE usage_stats (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id             UUID        REFERENCES users(id) ON DELETE SET NULL,
    group_id            UUID        REFERENCES groups(id) ON DELETE SET NULL,
    model_id            UUID,
    period              TEXT        NOT NULL CHECK (period IN ('hourly', 'daily', 'monthly')),
    period_start        TIMESTAMPTZ NOT NULL,
    prompt_tokens       BIGINT      NOT NULL DEFAULT 0,
    completion_tokens   BIGINT      NOT NULL DEFAULT 0,
    total_tokens        BIGINT      NOT NULL DEFAULT 0,
    cost_cents          INTEGER     NOT NULL DEFAULT 0,
    request_count       INTEGER     NOT NULL DEFAULT 0,
    error_count         INTEGER     NOT NULL DEFAULT 0,
    avg_latency_ms      INTEGER,
    storage_bytes       BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_usage_stats_org_period ON usage_stats (org_id, period, period_start);
CREATE INDEX idx_usage_stats_user_period ON usage_stats (user_id, period) WHERE user_id IS NOT NULL;
CREATE INDEX idx_usage_stats_group_period ON usage_stats (group_id, period) WHERE group_id IS NOT NULL;
CREATE INDEX idx_usage_stats_model_period ON usage_stats (model_id, period) WHERE model_id IS NOT NULL;

CREATE TRIGGER trg_usage_stats_updated_at
    BEFORE UPDATE ON usage_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 19. Models & Providers
-- ============================================================================

-- 19.1 model_providers
CREATE TABLE model_providers (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL,
    type                TEXT        NOT NULL CHECK (type IN ('openai', 'anthropic', 'azure', 'ollama', 'custom')),
    api_base_url        TEXT,
    api_key_encrypted   TEXT,
    litellm_params      JSONB,
    is_enabled          BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_model_providers_org_id ON model_providers (org_id);

CREATE TRIGGER trg_model_providers_updated_at
    BEFORE UPDATE ON model_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 19.2 models
CREATE TABLE models (
    id                                  UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                              UUID            NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    model_provider_id                   UUID            NOT NULL REFERENCES model_providers(id) ON DELETE CASCADE,
    name                                TEXT            NOT NULL,
    model_id_external                   TEXT            NOT NULL,
    capabilities                        JSONB           NOT NULL DEFAULT '[]',
    context_window                      INTEGER,
    cost_per_prompt_token_cents         NUMERIC(10,6),
    cost_per_completion_token_cents     NUMERIC(10,6),
    is_default                          BOOLEAN         NOT NULL DEFAULT false,
    is_fallback                         BOOLEAN         NOT NULL DEFAULT false,
    fallback_order                      INTEGER,
    is_enabled                          BOOLEAN         NOT NULL DEFAULT true,
    created_at                          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at                          TIMESTAMPTZ
);

CREATE INDEX idx_models_org_id ON models (org_id);
CREATE INDEX idx_models_provider ON models (model_provider_id);
CREATE UNIQUE INDEX idx_models_org_external_id ON models (org_id, model_id_external) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_models_updated_at
    BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- Add deferred FKs that reference models and agents
-- --------------------------------------------------------------------------

ALTER TABLE workspaces
    ADD CONSTRAINT fk_workspaces_default_agent
    FOREIGN KEY (default_agent_id) REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE workspaces
    ADD CONSTRAINT fk_workspaces_default_model
    FOREIGN KEY (default_model_id) REFERENCES models(id) ON DELETE SET NULL;

ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_model
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL;

ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_forked_from
    FOREIGN KEY (forked_from_message_id) REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE messages
    ADD CONSTRAINT fk_messages_agent
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE messages
    ADD CONSTRAINT fk_messages_model
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL;

ALTER TABLE agent_versions
    ADD CONSTRAINT fk_agent_versions_model
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL;

ALTER TABLE knowledge_collections
    ADD CONSTRAINT fk_knowledge_collections_embedding_model
    FOREIGN KEY (embedding_model_id) REFERENCES models(id) ON DELETE SET NULL;

ALTER TABLE usage_stats
    ADD CONSTRAINT fk_usage_stats_model
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL;

ALTER TABLE agents
    ADD CONSTRAINT fk_agents_model
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL;

-- ============================================================================
-- 20. Content Moderation & DLP
-- ============================================================================

-- 20.1 content_filters
CREATE TABLE content_filters (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    type        TEXT        NOT NULL CHECK (type IN ('input', 'output', 'both')),
    pattern     TEXT,
    action      TEXT        NOT NULL CHECK (action IN ('block', 'warn', 'redact', 'log')),
    severity    TEXT        NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_enabled  BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_content_filters_org_id ON content_filters (org_id);
CREATE INDEX idx_content_filters_org_active ON content_filters (org_id) WHERE deleted_at IS NULL AND is_enabled = true;

CREATE TRIGGER trg_content_filters_updated_at
    BEFORE UPDATE ON content_filters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 20.2 dlp_rules
CREATE TABLE dlp_rules (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    description     TEXT,
    detector_type   TEXT        NOT NULL CHECK (detector_type IN ('pii', 'credit_card', 'ssn', 'email', 'phone', 'custom_regex', 'keyword_list')),
    pattern         TEXT,
    keywords        JSONB,
    action          TEXT        NOT NULL CHECK (action IN ('block', 'redact', 'warn', 'log')),
    applies_to      TEXT        NOT NULL DEFAULT 'both' CHECK (applies_to IN ('input', 'output', 'both')),
    is_enabled      BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_dlp_rules_org_id ON dlp_rules (org_id);
CREATE INDEX idx_dlp_rules_org_active ON dlp_rules (org_id) WHERE deleted_at IS NULL AND is_enabled = true;

CREATE TRIGGER trg_dlp_rules_updated_at
    BEFORE UPDATE ON dlp_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 21. Prompt Templates
-- ============================================================================

-- 21.1 prompt_templates
CREATE TABLE prompt_templates (
    id                          UUID            NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                      UUID            NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    owner_id                    UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name                        TEXT            NOT NULL,
    description                 TEXT,
    content                     TEXT            NOT NULL,
    variables                   JSONB,
    system_prompt               TEXT,
    first_message               TEXT,
    category                    TEXT,
    tags                        JSONB,
    visibility                  TEXT            NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'org')),
    is_approved                 BOOLEAN         NOT NULL DEFAULT false,
    current_version             INTEGER         NOT NULL DEFAULT 1,
    forked_from_template_id     UUID            REFERENCES prompt_templates(id) ON DELETE SET NULL,
    usage_count                 INTEGER         NOT NULL DEFAULT 0,
    avg_rating                  NUMERIC(3,2),
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at                  TIMESTAMPTZ
);

CREATE INDEX idx_prompt_templates_org_id ON prompt_templates (org_id);
CREATE INDEX idx_prompt_templates_owner_id ON prompt_templates (owner_id);
CREATE INDEX idx_prompt_templates_visibility_approved ON prompt_templates (visibility, is_approved);
CREATE INDEX idx_prompt_templates_org_active ON prompt_templates (org_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_prompt_templates_updated_at
    BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 21.2 prompt_template_versions
CREATE TABLE prompt_template_versions (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_template_id      UUID        NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    version                 INTEGER     NOT NULL,
    content                 TEXT        NOT NULL,
    variables               JSONB,
    system_prompt           TEXT,
    changelog               TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_prompt_template_versions_template_ver ON prompt_template_versions (prompt_template_id, version) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompt_template_versions_org_id ON prompt_template_versions (org_id);

CREATE TRIGGER trg_prompt_template_versions_updated_at
    BEFORE UPDATE ON prompt_template_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 22. Integrations
-- ============================================================================

-- 22.1 integrations
CREATE TABLE integrations (
    id                      UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id                  UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    type                    TEXT        NOT NULL CHECK (type IN ('slack', 'teams', 'email', 'google_drive', 'onedrive')),
    name                    TEXT        NOT NULL,
    config                  JSONB       NOT NULL,
    credentials_encrypted   TEXT,
    is_enabled              BOOLEAN     NOT NULL DEFAULT true,
    status                  TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected')),
    last_sync_at            TIMESTAMPTZ,
    configured_by_id        UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_integrations_org_id ON integrations (org_id);
CREATE UNIQUE INDEX idx_integrations_org_type_name ON integrations (org_id, type, name) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 23. Keyboard Shortcuts
-- ============================================================================

-- 23.1 user_keyboard_shortcuts
CREATE TABLE user_keyboard_shortcuts (
    id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id      UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    action      TEXT        NOT NULL,
    keybinding  TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_user_keyboard_shortcuts_user_org_action ON user_keyboard_shortcuts (user_id, org_id, action) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_user_keyboard_shortcuts_updated_at
    BEFORE UPDATE ON user_keyboard_shortcuts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 24. System Health
-- ============================================================================

-- 24.1 system_health_checks
-- Append-only, system-wide. No updated_at, no deleted_at, no org_id.
CREATE TABLE system_health_checks (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    service             TEXT        NOT NULL CHECK (service IN ('postgresql', 'redis', 'minio', 'litellm', 'temporal')),
    status              TEXT        NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
    response_time_ms    INTEGER,
    details             JSONB,
    checked_by_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_health_checks_service_created ON system_health_checks (service, created_at DESC);

-- No trigger: system_health_checks has no updated_at

-- ============================================================================
-- 25. Data Import/Export Jobs
-- ============================================================================

-- 25.1 data_jobs
CREATE TABLE data_jobs (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type                TEXT        NOT NULL CHECK (type IN ('import_chatgpt', 'import_claude', 'export_full', 'gdpr_export', 'gdpr_delete')),
    status              TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    source_file_id      UUID        REFERENCES files(id) ON DELETE SET NULL,
    result_file_id      UUID        REFERENCES files(id) ON DELETE SET NULL,
    progress_pct        INTEGER     CHECK (progress_pct >= 0 AND progress_pct <= 100),
    error_message       TEXT,
    metadata            JSONB,
    workflow_id         UUID        REFERENCES workflows(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_data_jobs_org_user ON data_jobs (org_id, user_id);
CREATE INDEX idx_data_jobs_workflow ON data_jobs (workflow_id) WHERE workflow_id IS NOT NULL;

CREATE TRIGGER trg_data_jobs_updated_at
    BEFORE UPDATE ON data_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 26. Invitations
-- ============================================================================

-- 26.1 invitations
CREATE TABLE invitations (
    id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id          UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    email           TEXT        NOT NULL,
    role            TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('org-admin', 'power-user', 'member', 'viewer')),
    group_ids       JSONB,
    invited_by_id   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    token_hash      TEXT        NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_invitations_org_id ON invitations (org_id);
CREATE INDEX idx_invitations_token_hash ON invitations (token_hash);
CREATE INDEX idx_invitations_email ON invitations (email);
CREATE INDEX idx_invitations_pending ON invitations (org_id, expires_at) WHERE accepted_at IS NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_invitations_updated_at
    BEFORE UPDATE ON invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 27. Rate Limiting
-- ============================================================================

-- 27.1 rate_limit_rules
CREATE TABLE rate_limit_rules (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    scope               TEXT        NOT NULL CHECK (scope IN ('user', 'group', 'ip', 'api_key')),
    target_id           UUID,
    window_seconds      INTEGER     NOT NULL,
    max_requests        INTEGER     NOT NULL,
    max_tokens          BIGINT,
    is_enabled          BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_rate_limit_rules_org_scope ON rate_limit_rules (org_id, scope);
CREATE INDEX idx_rate_limit_rules_org_active ON rate_limit_rules (org_id) WHERE deleted_at IS NULL AND is_enabled = true;

CREATE TRIGGER trg_rate_limit_rules_updated_at
    BEFORE UPDATE ON rate_limit_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 28. Sandbox Executions
-- ============================================================================

-- 28.1 sandbox_executions
CREATE TABLE sandbox_executions (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    tool_call_id        UUID        REFERENCES tool_calls(id) ON DELETE SET NULL,
    message_id          UUID        REFERENCES messages(id) ON DELETE SET NULL,
    language            TEXT        NOT NULL CHECK (language IN ('python', 'nodejs', 'bash')),
    code                TEXT        NOT NULL,
    stdout              TEXT,
    stderr              TEXT,
    exit_code           INTEGER,
    duration_ms         INTEGER,
    memory_used_bytes   BIGINT,
    sandbox_backend     TEXT        NOT NULL CHECK (sandbox_backend IN ('nsjail', 'gvisor', 'firecracker')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_sandbox_executions_org_id ON sandbox_executions (org_id);
CREATE INDEX idx_sandbox_executions_tool_call ON sandbox_executions (tool_call_id) WHERE tool_call_id IS NOT NULL;
CREATE INDEX idx_sandbox_executions_message ON sandbox_executions (message_id) WHERE message_id IS NOT NULL;

CREATE TRIGGER trg_sandbox_executions_updated_at
    BEFORE UPDATE ON sandbox_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 29. Deep Research
-- ============================================================================

-- 29.1 research_reports
CREATE TABLE research_reports (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id              UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    workflow_id         UUID        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    query               TEXT        NOT NULL,
    config              JSONB,
    report_content      TEXT,
    sources             JSONB,
    status              TEXT        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    file_id             UUID        REFERENCES files(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_research_reports_org_id ON research_reports (org_id);
CREATE INDEX idx_research_reports_conversation ON research_reports (conversation_id);
CREATE INDEX idx_research_reports_workflow ON research_reports (workflow_id);

CREATE TRIGGER trg_research_reports_updated_at
    BEFORE UPDATE ON research_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 30. Row-Level Security (RLS)
-- ============================================================================

-- Enable RLS on all org-scoped tables.
-- Policy: USING (org_id = current_setting('app.current_org_id')::uuid)
--
-- NOTE: RLS is a defense-in-depth layer. Primary org scoping is enforced
-- in the application layer via the Drizzle query builder middleware.
-- The app sets the session variable before each request:
--   SET LOCAL app.current_org_id = '<uuid>';

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlp_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_keyboard_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for org-scoped tables.
-- Using a DO block to avoid repetition.
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'org_settings', 'user_profiles', 'groups', 'group_memberships',
            'sso_providers', 'api_keys', 'workspaces', 'workspace_memberships',
            'conversations', 'conversation_participants', 'messages',
            'message_attachments', 'message_ratings', 'message_notes',
            'conversation_folders', 'conversation_tags', 'conversation_tag_assignments',
            'files', 'file_chunks', 'knowledge_collections', 'knowledge_documents',
            'knowledge_chunks', 'agents', 'agent_versions', 'agent_skills',
            'agent_tools', 'agent_mcp_servers', 'agent_memory_entries',
            'agent_knowledge_collections', 'mcp_servers', 'mcp_tools',
            'tools', 'tool_versions', 'tool_calls', 'artifacts', 'workflows',
            'notifications', 'notification_preferences', 'usage_stats',
            'model_providers', 'models', 'content_filters', 'dlp_rules',
            'prompt_templates', 'prompt_template_versions', 'integrations',
            'user_keyboard_shortcuts', 'data_jobs', 'invitations',
            'rate_limit_rules', 'sandbox_executions', 'research_reports'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY rls_org_isolation ON %I
             FOR ALL
             USING (org_id = current_setting(''app.current_org_id'')::uuid)
             WITH CHECK (org_id = current_setting(''app.current_org_id'')::uuid)',
            tbl
        );
    END LOOP;
END;
$$;

-- audit_logs has a nullable org_id, so it gets a separate policy
CREATE POLICY rls_org_isolation ON audit_logs
    FOR ALL
    USING (org_id IS NULL OR org_id = current_setting('app.current_org_id')::uuid)
    WITH CHECK (org_id IS NULL OR org_id = current_setting('app.current_org_id')::uuid);

-- Tables NOT under RLS (system-wide, no org_id):
--   organisations  -- tenant root (no org_id on itself)
--   users          -- cross-org identity
--   sessions       -- user-scoped, not org-scoped
--   mfa_credentials -- user-scoped
--   sso_sessions   -- session-scoped
--   system_health_checks -- system-wide
```

---

## Row-Level Security Strategy

RLS provides **defense-in-depth** org isolation at the database level:

1. **Application layer (primary):** Every Drizzle query builder call includes `WHERE org_id = $currentOrgId` via middleware. This is the first line of defense.

2. **Database layer (secondary):** PostgreSQL RLS policies enforce `org_id = current_setting('app.current_org_id')::uuid` on every row operation. The API server sets this session variable at the start of each request:
   ```sql
   SET LOCAL app.current_org_id = '<org-uuid>';
   ```

3. **Superuser bypass:** The database migration user and connection pooler (PgBouncer) bypass RLS via `ALTER ROLE ... BYPASSRLS`. The application connection role does NOT have `BYPASSRLS`.

4. **Non-org-scoped tables** (`organisations`, `users`, `sessions`, `mfa_credentials`, `sso_sessions`, `system_health_checks`) do not have RLS enabled because they either are the tenant root or are scoped by `user_id` rather than `org_id`.

---

## Migration Strategy

| Principle | Detail |
|---|---|
| **Tool** | Drizzle Kit generates forward-only SQL migration files |
| **Review** | All generated migrations are reviewed by a developer before applying |
| **Non-destructive** | Destructive changes (column drops, type changes) require a two-phase migration: (1) add new column/table, (2) backfill data, (3) drop old column/table in a subsequent migration |
| **Rollback** | No automatic rollback; each migration is a forward step. Rollback is a new forward migration that reverses the change |
| **Testing** | Migrations run against a test database in CI before production |
| **Locking** | Use `CREATE INDEX CONCURRENTLY` for indexes on large tables to avoid locking |
| **Baseline** | This DDL serves as the initial migration (migration 0001) |

---

## Table Count Summary

| Group | Tables |
|---|---|
| 1. Organisation & Settings | `organisations`, `org_settings` |
| 2. Users & Identity | `users`, `user_profiles`, `sessions`, `mfa_credentials` |
| 3. Groups & Membership | `groups`, `group_memberships` |
| 4. SSO & External Identity | `sso_providers`, `sso_sessions` |
| 5. API Keys | `api_keys` |
| 6. Workspaces | `workspaces`, `workspace_memberships` |
| 7. Conversations | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_ratings`, `message_notes` |
| 8. Conversation Organisation | `conversation_folders`, `conversation_tags`, `conversation_tag_assignments` |
| 9. Files & Storage | `files`, `file_chunks` |
| 10. Knowledge Collections | `knowledge_collections`, `knowledge_documents`, `knowledge_chunks` |
| 11. Agents | `agents`, `agent_versions`, `agent_skills`, `agent_tools`, `agent_mcp_servers`, `agent_memory_entries`, `agent_knowledge_collections` |
| 12. MCP Servers | `mcp_servers`, `mcp_tools` |
| 13. Tools & Function Calling | `tools`, `tool_versions`, `tool_calls` |
| 14. Artifacts | `artifacts` |
| 15. Workflows | `workflows` |
| 16. Audit Logs | `audit_logs` |
| 17. Notifications | `notifications`, `notification_preferences` |
| 18. Usage & Analytics | `usage_stats` |
| 19. Models & Providers | `model_providers`, `models` |
| 20. Content Moderation & DLP | `content_filters`, `dlp_rules` |
| 21. Prompt Templates | `prompt_templates`, `prompt_template_versions` |
| 22. Integrations | `integrations` |
| 23. Keyboard Shortcuts | `user_keyboard_shortcuts` |
| 24. System Health | `system_health_checks` |
| 25. Data Import/Export | `data_jobs` |
| 26. Invitations | `invitations` |
| 27. Rate Limiting | `rate_limit_rules` |
| 28. Sandbox Executions | `sandbox_executions` |
| 29. Deep Research | `research_reports` |

**Total: 59 tables**
