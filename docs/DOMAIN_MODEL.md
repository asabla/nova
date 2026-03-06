# NOVA -- Domain Model

> Version: 1.0
> Date: 2026-03-06
> Status: Complete -- covers all 234 user stories

---

## Conventions

| Convention | Rule |
|---|---|
| Table names | `snake_case` plural (e.g. `conversation_participants`) |
| Column names | `snake_case` |
| Primary keys | `id` UUID v7 (time-sortable) |
| Foreign keys | `{table_singular}_id` |
| Timestamps | `timestamptz` -- every table has `created_at`, `updated_at`, `deleted_at` |
| Soft-delete | `deleted_at timestamptz NULL` on every table |
| Tenancy | `org_id UUID NOT NULL` on every org-scoped table (FK to `organisations`) |
| Booleans | Default `false` unless otherwise noted |
| Text enums | Stored as `text` with CHECK constraints (not Postgres ENUM types) for easier migration |

---

## 1. Organisation & Settings

### 1.1 `organisations`

Tenant boundary. All org-scoped data references this table.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `name` | `text` | NO | | Display name |
| `slug` | `text` | NO | | URL-safe unique slug |
| `domain` | `text` | YES | | Custom domain (e.g. `chat.acme.com`) |
| `logo_url` | `text` | YES | | S3/MinIO path |
| `favicon_url` | `text` | YES | | S3/MinIO path |
| `primary_color` | `text` | YES | | Hex color for theming |
| `custom_css` | `text` | YES | | Injected CSS for white-labeling |
| `billing_plan` | `text` | YES | | `free`, `pro`, `enterprise` (SaaS mode) |
| `billing_customer_id` | `text` | YES | | Stripe customer ID |
| `is_saas` | `boolean` | NO | `false` | Whether this org is in SaaS mode |
| `setup_completed_at` | `timestamptz` | YES | | Set after admin setup wizard |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | Soft-delete |

**Indexes:** UNIQUE(`slug`), UNIQUE(`domain`) WHERE `domain IS NOT NULL`

**Stories covered:** 11-16, 203-210

---

### 1.2 `org_settings`

Key-value settings per org. Extensible without schema changes.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `key` | `text` | NO | | Setting key (e.g. `password_min_length`, `max_file_size_mb`, `default_model_id`, `allowed_file_types`, `url_whitelist`, `url_blacklist`, `mfa_enforced`, `password_expiry_days`, `data_retention_days`, `sandbox_timeout_seconds`) |
| `value` | `jsonb` | NO | | Setting value |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`org_id`, `key`) WHERE `deleted_at IS NULL`

**Stories covered:** 6, 9, 12, 25-26, 28, 69-70, 75-76, 121, 175

---

## 2. Users & Identity

### 2.1 `users`

Core user identity. One row per person across all orgs.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `email` | `text` | NO | | Unique email address |
| `email_verified_at` | `timestamptz` | YES | | |
| `password_hash` | `text` | YES | | NULL for SSO-only users |
| `password_changed_at` | `timestamptz` | YES | | For expiry policy |
| `is_super_admin` | `boolean` | NO | `false` | Platform-wide admin |
| `is_active` | `boolean` | NO | `true` | Deactivated = false |
| `last_login_at` | `timestamptz` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`email`) WHERE `deleted_at IS NULL`

**Stories covered:** 1, 5, 19-24

---

### 2.2 `user_profiles`

Per-org profile for a user. A user can belong to multiple orgs.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `user_id` | `uuid` | NO | | FK `users` |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `display_name` | `text` | YES | | |
| `avatar_url` | `text` | YES | | S3/MinIO path |
| `timezone` | `text` | YES | `'UTC'` | IANA timezone |
| `locale` | `text` | YES | `'en'` | i18n locale |
| `theme` | `text` | YES | `'system'` | `light`, `dark`, `system` |
| `font_size` | `text` | YES | `'medium'` | `small`, `medium`, `large` |
| `role` | `text` | NO | `'member'` | `org-admin`, `power-user`, `member`, `viewer` |
| `onboarding_completed_at` | `timestamptz` | YES | | Set after tutorial |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`user_id`, `org_id`) WHERE `deleted_at IS NULL`

**Stories covered:** 19, 24, 165-168, 207-210, 220-223

---

### 2.3 `sessions`

Active user sessions. Managed by Better Auth.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `user_id` | `uuid` | NO | | FK `users` |
| `token_hash` | `text` | NO | | Hashed session token |
| `ip_address` | `inet` | YES | | |
| `user_agent` | `text` | YES | | |
| `expires_at` | `timestamptz` | NO | | |
| `revoked_at` | `timestamptz` | YES | | Explicit revocation |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`token_hash`), INDEX(`user_id`)

**Stories covered:** 8

---

### 2.4 `mfa_credentials`

TOTP / WebAuthn credentials for 2FA.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `user_id` | `uuid` | NO | | FK `users` |
| `type` | `text` | NO | | `totp`, `webauthn` |
| `secret_encrypted` | `text` | NO | | Encrypted TOTP secret or WebAuthn credential |
| `label` | `text` | YES | | User-chosen label |
| `last_used_at` | `timestamptz` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`user_id`)

**Stories covered:** 6, 7

---

## 3. Groups & Membership

### 3.1 `groups`

User groups within an org for permissions and quotas.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `sso_group_id` | `text` | YES | | External group ID for SSO sync (e.g. Entra ID group) |
| `model_access` | `jsonb` | YES | | Array of allowed model IDs; NULL = all models |
| `monthly_token_limit` | `bigint` | YES | | NULL = unlimited |
| `monthly_cost_limit_cents` | `integer` | YES | | NULL = unlimited |
| `storage_quota_mb` | `integer` | YES | | NULL = org default |
| `data_retention_days` | `integer` | YES | | NULL = org default |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), UNIQUE(`org_id`, `name`) WHERE `deleted_at IS NULL`

**Stories covered:** 17-18, 25-28, 69, 85, 156

---

### 3.2 `group_memberships`

Many-to-many: users belong to groups within an org.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `group_id` | `uuid` | NO | | FK `groups` |
| `user_id` | `uuid` | NO | | FK `users` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`group_id`, `user_id`) WHERE `deleted_at IS NULL`

**Stories covered:** 17-18

---

## 4. SSO & External Identity

### 4.1 `sso_providers`

Configured SSO providers per org.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `type` | `text` | NO | | `oidc`, `saml` |
| `provider_name` | `text` | NO | | `azure_ad`, `google`, `github`, `gitlab`, `custom` |
| `client_id` | `text` | NO | | |
| `client_secret_encrypted` | `text` | NO | | Encrypted |
| `issuer_url` | `text` | YES | | OIDC issuer |
| `metadata_url` | `text` | YES | | SAML metadata |
| `is_enabled` | `boolean` | NO | `true` | |
| `auto_provision_users` | `boolean` | NO | `false` | Create user on first login |
| `default_role` | `text` | NO | `'member'` | Role assigned to auto-provisioned users |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`)

**Stories covered:** 2-4, 18

---

### 4.2 `sso_sessions`

Links an SSO login event to a user session.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `session_id` | `uuid` | NO | | FK `sessions` |
| `sso_provider_id` | `uuid` | NO | | FK `sso_providers` |
| `external_user_id` | `text` | NO | | User ID from the identity provider |
| `access_token_encrypted` | `text` | YES | | For downstream API calls |
| `refresh_token_encrypted` | `text` | YES | | |
| `token_expires_at` | `timestamptz` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`session_id`), INDEX(`sso_provider_id`, `external_user_id`)

**Stories covered:** 2-4

---

## 5. API Keys

### 5.1 `api_keys`

Developer API keys for programmatic access.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `user_id` | `uuid` | NO | | FK `users` (owner) |
| `name` | `text` | NO | | Descriptive label |
| `key_prefix` | `text` | NO | | First 8 chars for display (e.g. `nova_abc1`) |
| `key_hash` | `text` | NO | | SHA-256 hash of the full key |
| `scopes` | `jsonb` | NO | `'[]'` | Allowed scopes/permissions |
| `last_used_at` | `timestamptz` | YES | | |
| `expires_at` | `timestamptz` | YES | | NULL = no expiry |
| `revoked_at` | `timestamptz` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`key_hash`), INDEX(`org_id`, `user_id`)

**Stories covered:** 108, 172, 219, 233

---

## 6. Workspaces

### 6.1 `workspaces`

Project containers within an org.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `owner_id` | `uuid` | NO | | FK `users` |
| `default_agent_id` | `uuid` | YES | | FK `agents` |
| `default_model_id` | `uuid` | YES | | FK `models` |
| `default_system_prompt` | `text` | YES | | |
| `is_archived` | `boolean` | NO | `false` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`owner_id`)

**Stories covered:** 122-129

---

### 6.2 `workspace_memberships`

Users or groups with access to a workspace.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `workspace_id` | `uuid` | NO | | FK `workspaces` |
| `user_id` | `uuid` | YES | | FK `users` (either user or group, not both) |
| `group_id` | `uuid` | YES | | FK `groups` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `role` | `text` | NO | `'member'` | `admin`, `member`, `viewer` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Constraints:** CHECK(`(user_id IS NOT NULL) != (group_id IS NOT NULL)`) -- exactly one must be set

**Indexes:** UNIQUE(`workspace_id`, `user_id`) WHERE `user_id IS NOT NULL AND deleted_at IS NULL`, UNIQUE(`workspace_id`, `group_id`) WHERE `group_id IS NOT NULL AND deleted_at IS NULL`

**Stories covered:** 125, 128

---

## 7. Conversations

### 7.1 `conversations`

A conversation thread.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `workspace_id` | `uuid` | YES | | FK `workspaces` (NULL = personal) |
| `owner_id` | `uuid` | NO | | FK `users` |
| `title` | `text` | YES | | Auto-generated or user-set |
| `visibility` | `text` | NO | `'private'` | `private`, `team`, `public` |
| `model_id` | `uuid` | YES | | FK `models` (current model) |
| `system_prompt` | `text` | YES | | Custom system prompt |
| `model_params` | `jsonb` | YES | | `{temperature, top_p, max_tokens, ...}` |
| `is_pinned` | `boolean` | NO | `false` | |
| `is_archived` | `boolean` | NO | `false` | |
| `forked_from_message_id` | `uuid` | YES | | FK `messages` (fork source) |
| `public_share_token` | `text` | YES | | Random token for public links |
| `total_tokens` | `bigint` | NO | `0` | Running total |
| `estimated_cost_cents` | `integer` | NO | `0` | Running cost estimate |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`, `owner_id`), INDEX(`workspace_id`), INDEX(`public_share_token`) WHERE `public_share_token IS NOT NULL`

**Stories covered:** 29-52, 124, 211-214, 226

---

### 7.2 `conversation_participants`

Users participating in a multi-user conversation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `conversation_id` | `uuid` | NO | | FK `conversations` |
| `user_id` | `uuid` | NO | | FK `users` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `role` | `text` | NO | `'participant'` | `owner`, `participant`, `viewer` |
| `last_read_at` | `timestamptz` | YES | | For unread tracking |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`conversation_id`, `user_id`) WHERE `deleted_at IS NULL`

**Stories covered:** 30-31, 45, 47

---

### 7.3 `messages`

Individual messages within a conversation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `conversation_id` | `uuid` | NO | | FK `conversations` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `parent_message_id` | `uuid` | YES | | FK `messages` (for branching / edits) |
| `sender_type` | `text` | NO | | `user`, `assistant`, `system`, `tool` |
| `sender_user_id` | `uuid` | YES | | FK `users` (NULL for assistant/system/tool) |
| `agent_id` | `uuid` | YES | | FK `agents` (which agent produced this) |
| `model_id` | `uuid` | YES | | FK `models` (which model generated this) |
| `content` | `text` | YES | | Message text (Markdown) |
| `content_type` | `text` | NO | `'text'` | `text`, `image`, `audio`, `video`, `file` |
| `metadata` | `jsonb` | YES | | Mentions, model params, etc. |
| `token_count_prompt` | `integer` | YES | | |
| `token_count_completion` | `integer` | YES | | |
| `cost_cents` | `integer` | YES | | |
| `is_edited` | `boolean` | NO | `false` | |
| `edit_history` | `jsonb` | YES | | Array of previous content versions |
| `status` | `text` | NO | `'completed'` | `streaming`, `completed`, `failed`, `cancelled` |
| `error_message` | `text` | YES | | Error details if failed |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`conversation_id`, `created_at`), INDEX(`org_id`), INDEX(`parent_message_id`)

**Stories covered:** 29, 35, 41-42, 44-46, 48-52, 55, 130-143, 196, 200-202, 231

---

### 7.4 `message_attachments`

Files or URLs attached to a message.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `message_id` | `uuid` | NO | | FK `messages` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `file_id` | `uuid` | YES | | FK `files` (if file attachment) |
| `url` | `text` | YES | | External URL (if URL reference) |
| `url_title` | `text` | YES | | Scraped page title |
| `url_preview` | `jsonb` | YES | | OG metadata for preview card |
| `attachment_type` | `text` | NO | | `file`, `url`, `image_paste` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`message_id`), INDEX(`file_id`)

**Stories covered:** 60-67, 71-74

---

### 7.5 `message_ratings`

Thumbs up/down on assistant messages.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `message_id` | `uuid` | NO | | FK `messages` |
| `user_id` | `uuid` | NO | | FK `users` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `rating` | `smallint` | NO | | `1` (thumbs up), `-1` (thumbs down) |
| `feedback` | `text` | YES | | Optional text feedback |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`message_id`, `user_id`) WHERE `deleted_at IS NULL`

**Stories covered:** 43, 186

---

### 7.6 `message_notes`

Private annotations on messages.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `message_id` | `uuid` | NO | | FK `messages` |
| `user_id` | `uuid` | NO | | FK `users` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `content` | `text` | NO | | Note text |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`message_id`, `user_id`)

**Stories covered:** 44

---

## 8. Conversation Organisation

### 8.1 `conversation_folders`

User-created folders to organise conversations.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `user_id` | `uuid` | NO | | FK `users` |
| `name` | `text` | NO | | |
| `parent_folder_id` | `uuid` | YES | | FK `conversation_folders` (nested folders) |
| `sort_order` | `integer` | NO | `0` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`, `user_id`)

**Stories covered:** 224-226

---

### 8.2 `conversation_tags`

Tags on conversations. A conversation can have many tags, a tag can be on many conversations.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `user_id` | `uuid` | NO | | FK `users` |
| `name` | `text` | NO | | |
| `color` | `text` | YES | | Hex color |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`org_id`, `user_id`, `name`) WHERE `deleted_at IS NULL`

**Stories covered:** 224

---

### 8.3 `conversation_tag_assignments`

Join table between conversations and tags. Also links to folders.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `conversation_id` | `uuid` | NO | | FK `conversations` |
| `conversation_tag_id` | `uuid` | YES | | FK `conversation_tags` |
| `conversation_folder_id` | `uuid` | YES | | FK `conversation_folders` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Constraints:** CHECK(`conversation_tag_id IS NOT NULL OR conversation_folder_id IS NOT NULL`)

**Indexes:** INDEX(`conversation_id`), INDEX(`conversation_tag_id`), INDEX(`conversation_folder_id`)

**Stories covered:** 224-226

---

## 9. Files & Storage

### 9.1 `files`

Uploaded files stored in MinIO.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `user_id` | `uuid` | NO | | FK `users` (uploader) |
| `workspace_id` | `uuid` | YES | | FK `workspaces` |
| `filename` | `text` | NO | | Original filename |
| `content_type` | `text` | NO | | MIME type |
| `size_bytes` | `bigint` | NO | | |
| `storage_path` | `text` | NO | | MinIO object key |
| `storage_bucket` | `text` | NO | | MinIO bucket name |
| `checksum_sha256` | `text` | YES | | For dedup and integrity |
| `is_public` | `boolean` | NO | `false` | Public URL access |
| `metadata` | `jsonb` | YES | | Extracted metadata (page count, dimensions, etc.) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`, `user_id`), INDEX(`workspace_id`)

**Stories covered:** 60-70, 123, 137, 139

---

### 9.2 `file_chunks`

Chunked text from files for RAG. Embeddings stored via pgvector.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `file_id` | `uuid` | NO | | FK `files` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `chunk_index` | `integer` | NO | | Order within file |
| `content` | `text` | NO | | Chunk text |
| `embedding` | `vector(1536)` | YES | | pgvector embedding |
| `token_count` | `integer` | YES | | |
| `metadata` | `jsonb` | YES | | Page number, section, etc. |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`file_id`, `chunk_index`), HNSW INDEX on `embedding` using `vector_cosine_ops` (partitioned by `org_id`)

**Stories covered:** 60, 119, 211

---

## 10. Knowledge Collections

### 10.1 `knowledge_collections`

A curated set of documents for RAG retrieval.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `owner_id` | `uuid` | NO | | FK `users` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `visibility` | `text` | NO | `'private'` | `private`, `team`, `public` |
| `embedding_model_id` | `uuid` | YES | | FK `models` |
| `chunk_size` | `integer` | NO | `512` | Tokens per chunk |
| `chunk_overlap` | `integer` | NO | `64` | Overlap tokens |
| `version` | `integer` | NO | `1` | Incremented on re-index |
| `last_indexed_at` | `timestamptz` | YES | | |
| `status` | `text` | NO | `'pending'` | `pending`, `indexing`, `ready`, `error` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`, `owner_id`)

**Stories covered:** 114-121, 232

---

### 10.2 `knowledge_documents`

A document (file or URL) within a knowledge collection.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `knowledge_collection_id` | `uuid` | NO | | FK `knowledge_collections` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `file_id` | `uuid` | YES | | FK `files` (if file-based) |
| `source_url` | `text` | YES | | If URL-based |
| `title` | `text` | YES | | Document title |
| `status` | `text` | NO | `'pending'` | `pending`, `processing`, `ready`, `error` |
| `error_message` | `text` | YES | | |
| `token_count` | `integer` | YES | | Total tokens in document |
| `chunk_count` | `integer` | YES | | Number of chunks generated |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`knowledge_collection_id`), INDEX(`file_id`)

**Stories covered:** 114, 116-117

---

### 10.3 `knowledge_chunks`

Chunked and embedded text from knowledge documents.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `knowledge_document_id` | `uuid` | NO | | FK `knowledge_documents` |
| `knowledge_collection_id` | `uuid` | NO | | FK `knowledge_collections` (denormalized for query) |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `chunk_index` | `integer` | NO | | Order within document |
| `content` | `text` | NO | | Chunk text |
| `embedding` | `vector(1536)` | YES | | pgvector embedding |
| `token_count` | `integer` | YES | | |
| `metadata` | `jsonb` | YES | | Page, section, headings |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`knowledge_document_id`, `chunk_index`), INDEX(`knowledge_collection_id`), HNSW INDEX on `embedding` using `vector_cosine_ops` (partitioned by `org_id`)

**Stories covered:** 114, 118-119

---

## 11. Agents

### 11.1 `agents`

Custom AI agents.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `owner_id` | `uuid` | NO | | FK `users` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `avatar_url` | `text` | YES | | |
| `system_prompt` | `text` | YES | | |
| `model_id` | `uuid` | YES | | FK `models` |
| `model_params` | `jsonb` | YES | | Temperature, etc. |
| `visibility` | `text` | NO | `'private'` | `private`, `team`, `org`, `public` |
| `is_published` | `boolean` | NO | `false` | |
| `tool_approval_mode` | `text` | NO | `'always-ask'` | `auto`, `always-ask`, `never` |
| `memory_scope` | `text` | NO | `'per-user'` | `per-user`, `per-conversation`, `global` |
| `max_steps` | `integer` | YES | | Max agent loop steps |
| `timeout_seconds` | `integer` | YES | | Max execution time |
| `webhook_url` | `text` | YES | | Trigger URL |
| `cron_schedule` | `text` | YES | | Cron expression for scheduled runs |
| `is_enabled` | `boolean` | NO | `true` | Admin can disable |
| `cloned_from_agent_id` | `uuid` | YES | | FK `agents` (if cloned) |
| `current_version` | `integer` | NO | `1` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`owner_id`), INDEX(`visibility`)

**Stories covered:** 46, 52, 57, 91-108, 234

---

### 11.2 `agent_versions`

Versioned snapshots of agent configuration.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `agent_id` | `uuid` | NO | | FK `agents` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `version` | `integer` | NO | | Version number |
| `system_prompt` | `text` | YES | | Snapshot |
| `model_id` | `uuid` | YES | | FK `models` |
| `model_params` | `jsonb` | YES | | |
| `config_snapshot` | `jsonb` | NO | | Full config (skills, tools, MCP servers) |
| `changelog` | `text` | YES | | Description of changes |
| `published_at` | `timestamptz` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`agent_id`, `version`) WHERE `deleted_at IS NULL`

**Stories covered:** 99

---

### 11.3 `agent_skills`

Skills attached to an agent (predefined capabilities).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `agent_id` | `uuid` | NO | | FK `agents` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `skill_name` | `text` | NO | | e.g. `web_search`, `code_interpreter`, `deep_research`, `rag_retrieval` |
| `config` | `jsonb` | YES | | Skill-specific configuration |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`agent_id`, `skill_name`) WHERE `deleted_at IS NULL`

**Stories covered:** 93

---

### 11.4 `agent_tools`

Tools attached to an agent.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `agent_id` | `uuid` | NO | | FK `agents` |
| `tool_id` | `uuid` | NO | | FK `tools` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `config_overrides` | `jsonb` | YES | | Agent-specific tool config |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`agent_id`, `tool_id`) WHERE `deleted_at IS NULL`

**Stories covered:** 94, 102

---

### 11.5 `agent_mcp_servers`

MCP servers connected to an agent.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `agent_id` | `uuid` | NO | | FK `agents` |
| `mcp_server_id` | `uuid` | NO | | FK `mcp_servers` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`agent_id`, `mcp_server_id`) WHERE `deleted_at IS NULL`

**Stories covered:** 95

---

### 11.6 `agent_memory_entries`

Agent memory (per-user, per-conversation, or global scope).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `agent_id` | `uuid` | NO | | FK `agents` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `user_id` | `uuid` | YES | | FK `users` (for per-user scope) |
| `conversation_id` | `uuid` | YES | | FK `conversations` (for per-conversation scope) |
| `scope` | `text` | NO | | `per-user`, `per-conversation`, `global` |
| `key` | `text` | NO | | Memory key |
| `value` | `jsonb` | NO | | Memory value |
| `embedding` | `vector(1536)` | YES | | For semantic memory recall |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`agent_id`, `scope`), INDEX(`agent_id`, `user_id`), INDEX(`agent_id`, `conversation_id`)

**Stories covered:** 96, 101, 109-113

---

### 11.7 `agent_knowledge_collections`

Knowledge collections attached to an agent for RAG.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `agent_id` | `uuid` | NO | | FK `agents` |
| `knowledge_collection_id` | `uuid` | NO | | FK `knowledge_collections` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`agent_id`, `knowledge_collection_id`) WHERE `deleted_at IS NULL`

**Stories covered:** 114-115 (agent uses knowledge for RAG)

---

## 12. MCP Servers

### 12.1 `mcp_servers`

Registered Model Context Protocol servers.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `url` | `text` | NO | | Server URL |
| `auth_type` | `text` | YES | | `none`, `bearer`, `api_key` |
| `auth_token_encrypted` | `text` | YES | | Encrypted auth credential |
| `is_approved` | `boolean` | NO | `false` | Admin-approved |
| `is_enabled` | `boolean` | NO | `true` | |
| `health_status` | `text` | YES | | `healthy`, `degraded`, `down`, `unknown` |
| `last_health_check_at` | `timestamptz` | YES | | |
| `registered_by_id` | `uuid` | NO | | FK `users` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), UNIQUE(`org_id`, `url`) WHERE `deleted_at IS NULL`

**Stories covered:** 149-153

---

### 12.2 `mcp_tools`

Tools discovered from an MCP server.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `mcp_server_id` | `uuid` | NO | | FK `mcp_servers` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `name` | `text` | NO | | Tool name from MCP |
| `description` | `text` | YES | | |
| `input_schema` | `jsonb` | YES | | JSON Schema for input |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`mcp_server_id`, `name`) WHERE `deleted_at IS NULL`

**Stories covered:** 151

---

## 13. Tools & Function Calling

### 13.1 `tools`

Registered tools (native or custom via OpenAPI spec).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `type` | `text` | NO | | `builtin`, `openapi`, `custom` |
| `openapi_spec` | `jsonb` | YES | | OpenAPI definition |
| `function_schema` | `jsonb` | NO | | JSON Schema for function calling |
| `is_approved` | `boolean` | NO | `false` | Admin-reviewed |
| `is_enabled` | `boolean` | NO | `true` | |
| `registered_by_id` | `uuid` | NO | | FK `users` |
| `current_version` | `integer` | NO | `1` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), UNIQUE(`org_id`, `name`) WHERE `deleted_at IS NULL`

**Stories covered:** 94, 103, 144-148

---

### 13.2 `tool_versions`

Versioned snapshots of tool definitions.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `tool_id` | `uuid` | NO | | FK `tools` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `version` | `integer` | NO | | |
| `function_schema` | `jsonb` | NO | | Snapshot of schema |
| `openapi_spec` | `jsonb` | YES | | Snapshot of spec |
| `changelog` | `text` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`tool_id`, `version`) WHERE `deleted_at IS NULL`

**Stories covered:** 146

---

### 13.3 `tool_calls`

Log of every tool invocation during a conversation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `message_id` | `uuid` | NO | | FK `messages` (the assistant message that invoked the tool) |
| `conversation_id` | `uuid` | NO | | FK `conversations` (denormalized for query) |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `tool_id` | `uuid` | YES | | FK `tools` (NULL for MCP tools) |
| `mcp_tool_id` | `uuid` | YES | | FK `mcp_tools` (NULL for native tools) |
| `tool_name` | `text` | NO | | Tool name at time of call |
| `input` | `jsonb` | NO | | Arguments passed |
| `output` | `jsonb` | YES | | Result returned |
| `status` | `text` | NO | `'pending'` | `pending`, `approved`, `rejected`, `running`, `completed`, `failed` |
| `approved_by_id` | `uuid` | YES | | FK `users` (for human-in-the-loop) |
| `approved_at` | `timestamptz` | YES | | |
| `duration_ms` | `integer` | YES | | Execution time |
| `error_message` | `text` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`message_id`), INDEX(`conversation_id`), INDEX(`org_id`)

**Stories covered:** 54-56, 58-59, 144, 159

---

## 14. Artifacts

### 14.1 `artifacts`

Rich outputs produced by agents or tool calls.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `message_id` | `uuid` | NO | | FK `messages` |
| `conversation_id` | `uuid` | NO | | FK `conversations` (denormalized) |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `type` | `text` | NO | | `code`, `image`, `audio`, `video`, `document`, `chart`, `mermaid`, `latex`, `html`, `csv_table`, `widget` |
| `title` | `text` | YES | | |
| `content` | `text` | YES | | Inline content (code, markdown, SVG, etc.) |
| `file_id` | `uuid` | YES | | FK `files` (if stored as file) |
| `language` | `text` | YES | | Programming language (for code artifacts) |
| `metadata` | `jsonb` | YES | | Type-specific metadata |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`message_id`), INDEX(`conversation_id`), INDEX(`org_id`)

**Stories covered:** 97, 130-143

---

## 15. Workflows

### 15.1 `workflows`

Temporal workflow tracking. Links durable workflows to NOVA entities.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `temporal_workflow_id` | `text` | NO | | Temporal's workflow ID |
| `temporal_run_id` | `text` | YES | | Temporal's run ID |
| `type` | `text` | NO | | `agent_run`, `deep_research`, `file_ingestion`, `knowledge_index`, `scheduled_agent`, `batch_job`, `data_export`, `data_import` |
| `status` | `text` | NO | `'running'` | `running`, `completed`, `failed`, `cancelled`, `timed_out`, `waiting_for_input` |
| `conversation_id` | `uuid` | YES | | FK `conversations` |
| `agent_id` | `uuid` | YES | | FK `agents` |
| `initiated_by_id` | `uuid` | NO | | FK `users` |
| `input` | `jsonb` | YES | | Workflow input params |
| `output` | `jsonb` | YES | | Workflow result |
| `error_message` | `text` | YES | | |
| `progress` | `jsonb` | YES | | Live progress data (sources visited, steps completed) |
| `started_at` | `timestamptz` | NO | `now()` | |
| `completed_at` | `timestamptz` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`temporal_workflow_id`), INDEX(`conversation_id`), INDEX(`agent_id`)

**Stories covered:** 53-59, 77-82, 106-107, 117, 191-195, 233

---

## 16. Audit Log

### 16.1 `audit_logs`

Immutable audit trail. Append-only (no `updated_at` or `deleted_at` -- never mutated or soft-deleted).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | YES | | FK `organisations` (NULL for system-level events) |
| `actor_id` | `uuid` | YES | | FK `users` (NULL for system events) |
| `actor_type` | `text` | NO | | `user`, `system`, `api_key`, `agent` |
| `impersonator_id` | `uuid` | YES | | FK `users` (if impersonating) |
| `action` | `text` | NO | | e.g. `user.login`, `conversation.create`, `agent.publish`, `api_key.rotate`, `admin.impersonate` |
| `resource_type` | `text` | NO | | e.g. `user`, `conversation`, `agent`, `file` |
| `resource_id` | `uuid` | YES | | ID of the affected resource |
| `details` | `jsonb` | YES | | Action-specific payload |
| `ip_address` | `inet` | YES | | |
| `user_agent` | `text` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |

**Note:** No `updated_at` or `deleted_at` -- audit logs are immutable.

**Indexes:** INDEX(`org_id`, `created_at`), INDEX(`actor_id`), INDEX(`resource_type`, `resource_id`), INDEX(`action`)

**Stories covered:** 10, 23, 171, 194

---

## 17. Notifications

### 17.1 `notifications`

In-app and push notifications.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `user_id` | `uuid` | NO | | FK `users` (recipient) |
| `type` | `text` | NO | | `mention`, `share`, `agent_complete`, `budget_warning`, `system_status` |
| `title` | `text` | NO | | |
| `body` | `text` | YES | | |
| `resource_type` | `text` | YES | | e.g. `conversation`, `agent`, `workflow` |
| `resource_id` | `uuid` | YES | | Link to related entity |
| `channel` | `text` | NO | `'in_app'` | `in_app`, `email`, `webhook`, `slack` |
| `is_read` | `boolean` | NO | `false` | |
| `read_at` | `timestamptz` | YES | | |
| `sent_at` | `timestamptz` | YES | | For email/webhook delivery tracking |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`user_id`, `is_read`, `created_at`), INDEX(`org_id`)

**Stories covered:** 161-164, 197, 199

---

### 17.2 `notification_preferences`

Per-user notification settings.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `user_id` | `uuid` | NO | | FK `users` |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `notification_type` | `text` | NO | | e.g. `mention`, `share`, `agent_complete`, `budget_warning` |
| `channel` | `text` | NO | | `in_app`, `email`, `webhook`, `slack` |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`user_id`, `org_id`, `notification_type`, `channel`) WHERE `deleted_at IS NULL`

**Stories covered:** 163

---

## 18. Usage & Analytics

### 18.1 `usage_stats`

Aggregated usage data for dashboards and billing.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `user_id` | `uuid` | YES | | FK `users` (NULL for org-level aggregates) |
| `group_id` | `uuid` | YES | | FK `groups` (NULL for user/org-level) |
| `model_id` | `uuid` | YES | | FK `models` (NULL for cross-model aggregates) |
| `period` | `text` | NO | | `hourly`, `daily`, `monthly` |
| `period_start` | `timestamptz` | NO | | Start of period |
| `prompt_tokens` | `bigint` | NO | `0` | |
| `completion_tokens` | `bigint` | NO | `0` | |
| `total_tokens` | `bigint` | NO | `0` | |
| `cost_cents` | `integer` | NO | `0` | |
| `request_count` | `integer` | NO | `0` | |
| `error_count` | `integer` | NO | `0` | |
| `avg_latency_ms` | `integer` | YES | | |
| `storage_bytes` | `bigint` | YES | | File storage used |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`, `period`, `period_start`), INDEX(`user_id`, `period`), INDEX(`group_id`, `period`), INDEX(`model_id`, `period`)

**Stories covered:** 15, 27, 50, 68, 89, 154-160, 197

---

## 19. Models & Providers

### 19.1 `model_providers`

External model providers configured via LiteLLM.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `name` | `text` | NO | | e.g. `OpenAI`, `Anthropic`, `Azure OpenAI`, `Local Ollama` |
| `type` | `text` | NO | | `openai`, `anthropic`, `azure`, `ollama`, `custom` |
| `api_base_url` | `text` | YES | | |
| `api_key_encrypted` | `text` | YES | | Encrypted |
| `litellm_params` | `jsonb` | YES | | Extra LiteLLM config |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`)

**Stories covered:** 83-84

---

### 19.2 `models`

Individual models available via a provider.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `model_provider_id` | `uuid` | NO | | FK `model_providers` |
| `name` | `text` | NO | | Display name |
| `model_id_external` | `text` | NO | | LiteLLM model identifier (e.g. `gpt-4o`, `claude-sonnet-4-20250514`) |
| `capabilities` | `jsonb` | NO | `'[]'` | Array: `vision`, `function_calling`, `reasoning`, `streaming`, `embeddings` |
| `context_window` | `integer` | YES | | Max tokens |
| `cost_per_prompt_token_cents` | `numeric(10,6)` | YES | | |
| `cost_per_completion_token_cents` | `numeric(10,6)` | YES | | |
| `is_default` | `boolean` | NO | `false` | Default model for this org |
| `is_fallback` | `boolean` | NO | `false` | Used as fallback |
| `fallback_order` | `integer` | YES | | Priority when falling back |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`model_provider_id`), UNIQUE(`org_id`, `model_id_external`) WHERE `deleted_at IS NULL`

**Stories covered:** 85-90, 120, 200

---

## 20. Content Moderation & DLP

### 20.1 `content_filters`

Content moderation rules per org.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `name` | `text` | NO | | |
| `type` | `text` | NO | | `input`, `output`, `both` |
| `pattern` | `text` | YES | | Regex pattern |
| `action` | `text` | NO | | `block`, `warn`, `redact`, `log` |
| `severity` | `text` | NO | `'medium'` | `low`, `medium`, `high`, `critical` |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`)

**Stories covered:** 169, 174

---

### 20.2 `dlp_rules`

Data Loss Prevention rules for detecting and handling sensitive data.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `detector_type` | `text` | NO | | `pii`, `credit_card`, `ssn`, `email`, `phone`, `custom_regex`, `keyword_list` |
| `pattern` | `text` | YES | | Custom regex (for `custom_regex` type) |
| `keywords` | `jsonb` | YES | | Keyword list (for `keyword_list` type) |
| `action` | `text` | NO | | `block`, `redact`, `warn`, `log` |
| `applies_to` | `text` | NO | `'both'` | `input`, `output`, `both` |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`)

**Stories covered:** 170

---

## 21. Prompt Templates

### 21.1 `prompt_templates`

Reusable prompt templates with variables.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `owner_id` | `uuid` | NO | | FK `users` |
| `name` | `text` | NO | | |
| `description` | `text` | YES | | |
| `content` | `text` | NO | | Template with `{{variable}}` placeholders |
| `variables` | `jsonb` | YES | | Array of `{name, type, default, description}` |
| `system_prompt` | `text` | YES | | For conversation starters |
| `first_message` | `text` | YES | | Pre-filled first message (conversation starter) |
| `category` | `text` | YES | | For organisation |
| `tags` | `jsonb` | YES | | Array of tag strings |
| `visibility` | `text` | NO | `'private'` | `private`, `team`, `org` |
| `is_approved` | `boolean` | NO | `false` | Admin-curated |
| `current_version` | `integer` | NO | `1` | |
| `forked_from_template_id` | `uuid` | YES | | FK `prompt_templates` |
| `usage_count` | `integer` | NO | `0` | Times used |
| `avg_rating` | `numeric(3,2)` | YES | | Average user rating |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`owner_id`), INDEX(`visibility`, `is_approved`)

**Stories covered:** 179-186

---

### 21.2 `prompt_template_versions`

Version history for prompt templates.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `prompt_template_id` | `uuid` | NO | | FK `prompt_templates` |
| `org_id` | `uuid` | NO | | FK `organisations` (denormalized for RLS) |
| `version` | `integer` | NO | | |
| `content` | `text` | NO | | Template content at this version |
| `variables` | `jsonb` | YES | | Variables at this version |
| `system_prompt` | `text` | YES | | |
| `changelog` | `text` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`prompt_template_id`, `version`) WHERE `deleted_at IS NULL`

**Stories covered:** 184

---

## 22. Integrations

### 22.1 `integrations`

External service connections (Slack, Teams, email, cloud storage).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `type` | `text` | NO | | `slack`, `teams`, `email`, `google_drive`, `onedrive` |
| `name` | `text` | NO | | Display name |
| `config` | `jsonb` | NO | | Type-specific config (workspace ID, webhook URL, etc.) |
| `credentials_encrypted` | `text` | YES | | Encrypted tokens/keys |
| `is_enabled` | `boolean` | NO | `true` | |
| `status` | `text` | NO | `'active'` | `active`, `error`, `disconnected` |
| `last_sync_at` | `timestamptz` | YES | | For cloud storage sync |
| `configured_by_id` | `uuid` | NO | | FK `users` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), UNIQUE(`org_id`, `type`, `name`) WHERE `deleted_at IS NULL`

**Stories covered:** 215-218

---

## 23. Keyboard Shortcuts

### 23.1 `user_keyboard_shortcuts`

Custom keyboard shortcut overrides per user.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `user_id` | `uuid` | NO | | FK `users` |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `action` | `text` | NO | | e.g. `new_chat`, `search`, `send_message`, `command_palette` |
| `keybinding` | `text` | NO | | e.g. `Cmd+K`, `Ctrl+Enter` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** UNIQUE(`user_id`, `org_id`, `action`) WHERE `deleted_at IS NULL`

**Stories covered:** 187-190

---

## 24. System Health

### 24.1 `system_health_checks`

Results of admin diagnostic checks. Not org-scoped (system-wide).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `service` | `text` | NO | | `postgresql`, `redis`, `minio`, `litellm`, `temporal` |
| `status` | `text` | NO | | `healthy`, `degraded`, `down` |
| `response_time_ms` | `integer` | YES | | |
| `details` | `jsonb` | YES | | Version info, error details |
| `checked_by_id` | `uuid` | YES | | FK `users` (NULL for automated) |
| `created_at` | `timestamptz` | NO | `now()` | |

**Note:** No `updated_at`, `deleted_at`, or `org_id` -- these are system-level, append-only records.

**Indexes:** INDEX(`service`, `created_at`)

**Stories covered:** 204-206

---

## 25. Data Import/Export Jobs

### 25.1 `data_jobs`

Tracks import/export operations (ChatGPT import, GDPR export, full backup).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `user_id` | `uuid` | NO | | FK `users` |
| `type` | `text` | NO | | `import_chatgpt`, `import_claude`, `export_full`, `gdpr_export`, `gdpr_delete` |
| `status` | `text` | NO | `'pending'` | `pending`, `processing`, `completed`, `failed` |
| `source_file_id` | `uuid` | YES | | FK `files` (uploaded import file) |
| `result_file_id` | `uuid` | YES | | FK `files` (generated export archive) |
| `progress_pct` | `integer` | YES | | 0-100 |
| `error_message` | `text` | YES | | |
| `metadata` | `jsonb` | YES | | Stats: items imported/exported |
| `workflow_id` | `uuid` | YES | | FK `workflows` (Temporal workflow) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`, `user_id`), INDEX(`workflow_id`)

**Stories covered:** 191-195

---

## 26. Invitations

### 26.1 `invitations`

Pending user invitations to an org.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `email` | `text` | NO | | Invited email |
| `role` | `text` | NO | `'member'` | Role to assign on accept |
| `group_ids` | `jsonb` | YES | | Groups to add user to |
| `invited_by_id` | `uuid` | NO | | FK `users` |
| `token_hash` | `text` | NO | | Hashed invite token |
| `expires_at` | `timestamptz` | NO | | |
| `accepted_at` | `timestamptz` | YES | | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`token_hash`), INDEX(`email`)

**Stories covered:** 20-21

---

## 27. Rate Limiting

### 27.1 `rate_limit_rules`

Configurable rate limit policies per org.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `scope` | `text` | NO | | `user`, `group`, `ip`, `api_key` |
| `target_id` | `uuid` | YES | | Specific user/group/api_key ID (NULL = all) |
| `window_seconds` | `integer` | NO | | Time window |
| `max_requests` | `integer` | NO | | Max requests per window |
| `max_tokens` | `bigint` | YES | | Max tokens per window |
| `is_enabled` | `boolean` | NO | `true` | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`, `scope`)

**Stories covered:** 178, 197-198

---

## 28. Sandbox Executions

### 28.1 `sandbox_executions`

Log of sandboxed code executions.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `tool_call_id` | `uuid` | YES | | FK `tool_calls` |
| `message_id` | `uuid` | YES | | FK `messages` |
| `language` | `text` | NO | | `python`, `nodejs`, `bash` |
| `code` | `text` | NO | | Source code executed |
| `stdout` | `text` | YES | | |
| `stderr` | `text` | YES | | |
| `exit_code` | `integer` | YES | | |
| `duration_ms` | `integer` | YES | | |
| `memory_used_bytes` | `bigint` | YES | | |
| `sandbox_backend` | `text` | NO | | `nsjail`, `gvisor`, `firecracker` |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`tool_call_id`), INDEX(`message_id`)

**Stories covered:** 136, 175

---

## 29. Deep Research

### 29.1 `research_reports`

Structured outputs from deep research workflows.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | UUIDv7 | PK |
| `org_id` | `uuid` | NO | | FK `organisations` |
| `conversation_id` | `uuid` | NO | | FK `conversations` |
| `workflow_id` | `uuid` | NO | | FK `workflows` |
| `user_id` | `uuid` | NO | | FK `users` |
| `query` | `text` | NO | | Original research query |
| `config` | `jsonb` | YES | | `{max_sources, max_iterations, ...}` |
| `report_content` | `text` | YES | | Final Markdown report |
| `sources` | `jsonb` | YES | | Array of `{url, title, snippet, relevance_score}` |
| `status` | `text` | NO | `'running'` | `running`, `completed`, `failed` |
| `file_id` | `uuid` | YES | | FK `files` (exported PDF/DOCX) |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |
| `deleted_at` | `timestamptz` | YES | | |

**Indexes:** INDEX(`org_id`), INDEX(`conversation_id`), INDEX(`workflow_id`)

**Stories covered:** 77-82

---

## User Story Cross-Reference

Every one of the 234 user stories maps to at least one entity. Below is a summary by story category:

| Category (Stories) | Primary Entities |
|---|---|
| 1. Auth & Identity (1-10) | `users`, `sessions`, `mfa_credentials`, `sso_providers`, `sso_sessions`, `org_settings`, `audit_logs` |
| 2. Tenancy & Orgs (11-16) | `organisations`, `org_settings`, `usage_stats` |
| 3. Users & Groups (17-28) | `users`, `user_profiles`, `groups`, `group_memberships`, `invitations`, `org_settings`, `usage_stats` |
| 4. Conversations (29-52) | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_ratings`, `message_notes`, `models` |
| 5. Multi-turn & Agentic (53-59) | `workflows`, `tool_calls`, `messages`, `agents` |
| 6. Files & Documents (60-70) | `files`, `file_chunks`, `message_attachments`, `org_settings` |
| 7. URL / Web References (71-76) | `message_attachments`, `org_settings` |
| 8. Deep Research (77-82) | `research_reports`, `workflows`, `conversations`, `files` |
| 9. Models & Providers (83-90) | `model_providers`, `models`, `org_settings`, `usage_stats` |
| 10. Agents (91-108) | `agents`, `agent_versions`, `agent_skills`, `agent_tools`, `agent_mcp_servers`, `agent_knowledge_collections`, `api_keys`, `workflows` |
| 11. Memory (109-113) | `agent_memory_entries` |
| 12. Knowledge Collections (114-121) | `knowledge_collections`, `knowledge_documents`, `knowledge_chunks`, `org_settings` |
| 13. Workspaces (122-129) | `workspaces`, `workspace_memberships`, `files`, `conversations` |
| 14. Artifacts & Rich Display (130-143) | `artifacts`, `messages`, `files` |
| 15. Tools & Function Calling (144-148) | `tools`, `tool_versions`, `tool_calls` |
| 16. MCP Servers (149-153) | `mcp_servers`, `mcp_tools`, `agent_mcp_servers` |
| 17. Analytics & Observability (154-160) | `usage_stats`, `tool_calls`, `workflows` |
| 18. Notifications (161-164) | `notifications`, `notification_preferences` |
| 19. i18n & Accessibility (165-168) | `user_profiles` (locale, theme, font_size) |
| 20. Security & Compliance (169-178) | `content_filters`, `dlp_rules`, `audit_logs`, `api_keys`, `rate_limit_rules`, `sandbox_executions`, `org_settings` |
| 21. Prompt Library (179-186) | `prompt_templates`, `prompt_template_versions`, `message_ratings` |
| 22. Keyboard Shortcuts (187-190) | `user_keyboard_shortcuts` |
| 23. Data Import/Export & GDPR (191-195) | `data_jobs`, `workflows`, `files`, `audit_logs` |
| 24. Error Handling & Rate Limiting (196-202) | `messages` (status, error_message), `rate_limit_rules`, `notifications` |
| 25. Admin Onboarding & Health (203-206) | `organisations` (setup_completed_at), `system_health_checks` |
| 26. Theming & White-labeling (207-210) | `organisations` (logo_url, primary_color, custom_css), `user_profiles` (theme) |
| 27. Search (211-214) | `messages`, `file_chunks`, `knowledge_chunks`, `conversations` (via pg_trgm + pgvector) |
| 28. Integrations (215-219) | `integrations`, `api_keys` |
| 29. User Onboarding (220-223) | `user_profiles` (onboarding_completed_at) |
| 30. Conversation Organisation (224-226) | `conversation_folders`, `conversation_tags`, `conversation_tag_assignments` |
| 31. Voice & Multimodal (227-229) | `messages` (content_type: audio), `message_attachments`, `files` |
| 32. Model Playground (230) | `models`, `model_providers` (no new entity -- uses existing models with ad-hoc params) |
| 33. Versioning & History (231-232) | `messages` (edit_history), `knowledge_collections` (version) |
| 34. Batch Operations (233-234) | `workflows` (type: batch_job), `agents`, `api_keys` |

---

## Entity Count Summary

| # | Entity | Table Name |
|---|---|---|
| 1 | Organisation | `organisations` |
| 2 | OrgSetting | `org_settings` |
| 3 | User | `users` |
| 4 | UserProfile | `user_profiles` |
| 5 | Session | `sessions` |
| 6 | MfaCredential | `mfa_credentials` |
| 7 | Group | `groups` |
| 8 | GroupMembership | `group_memberships` |
| 9 | SsoProvider | `sso_providers` |
| 10 | SsoSession | `sso_sessions` |
| 11 | ApiKey | `api_keys` |
| 12 | Workspace | `workspaces` |
| 13 | WorkspaceMembership | `workspace_memberships` |
| 14 | Conversation | `conversations` |
| 15 | ConversationParticipant | `conversation_participants` |
| 16 | Message | `messages` |
| 17 | MessageAttachment | `message_attachments` |
| 18 | MessageRating | `message_ratings` |
| 19 | MessageNote | `message_notes` |
| 20 | ConversationFolder | `conversation_folders` |
| 21 | ConversationTag | `conversation_tags` |
| 22 | ConversationTagAssignment | `conversation_tag_assignments` |
| 23 | File | `files` |
| 24 | FileChunk | `file_chunks` |
| 25 | KnowledgeCollection | `knowledge_collections` |
| 26 | KnowledgeDocument | `knowledge_documents` |
| 27 | KnowledgeChunk | `knowledge_chunks` |
| 28 | Agent | `agents` |
| 29 | AgentVersion | `agent_versions` |
| 30 | AgentSkill | `agent_skills` |
| 31 | AgentTool | `agent_tools` |
| 32 | AgentMcpServer | `agent_mcp_servers` |
| 33 | AgentMemoryEntry | `agent_memory_entries` |
| 34 | AgentKnowledgeCollection | `agent_knowledge_collections` |
| 35 | McpServer | `mcp_servers` |
| 36 | McpTool | `mcp_tools` |
| 37 | Tool | `tools` |
| 38 | ToolVersion | `tool_versions` |
| 39 | ToolCall | `tool_calls` |
| 40 | Artifact | `artifacts` |
| 41 | Workflow | `workflows` |
| 42 | AuditLog | `audit_logs` |
| 43 | Notification | `notifications` |
| 44 | NotificationPreference | `notification_preferences` |
| 45 | UsageStat | `usage_stats` |
| 46 | ModelProvider | `model_providers` |
| 47 | Model | `models` |
| 48 | ContentFilter | `content_filters` |
| 49 | DlpRule | `dlp_rules` |
| 50 | PromptTemplate | `prompt_templates` |
| 51 | PromptTemplateVersion | `prompt_template_versions` |
| 52 | Integration | `integrations` |
| 53 | UserKeyboardShortcut | `user_keyboard_shortcuts` |
| 54 | SystemHealthCheck | `system_health_checks` |
| 55 | DataJob | `data_jobs` |
| 56 | Invitation | `invitations` |
| 57 | RateLimitRule | `rate_limit_rules` |
| 58 | SandboxExecution | `sandbox_executions` |
| 59 | ResearchReport | `research_reports` |

**Total: 59 entities**
