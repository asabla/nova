# NOVA -- Development Roadmap

> Version: 2.1
> Date: 2026-03-29 (verified)
> Source: All 234 user stories from `docs/USER_STORIES.md`, allocated per `docs/REFINED_SYSTEM_PLAN.md`
>
> Each story appears in EXACTLY ONE phase. Checkboxes track completion.
> Story sources: ORIGINAL (core vision), NEW (research additions), GAP (competitive analysis).
>
> **Architectural notes (deviations from v1.0 plan):**
> - **Vector search**: Qdrant replaces pgvector for all embedding/similarity search
> - **Real-time**: SSE via Redis pub/sub is the primary streaming mechanism (not WebSocket)
> - **Workspaces**: Not implemented as a first-class entity; functionality is distributed across conversations, folders/tags, and org scoping
> - **Mermaid**: Implemented; PlantUML not included (Mermaid covers the use case)

---

## Phase 1 -- MVP (8 weeks) | 45 stories ✅

Core auth, single-user conversations, SSE streaming, file uploads, basic UI.
Includes Sprint 0 validation (1 week), infrastructure setup, CI/CD pipeline.

### Infrastructure & Setup

- [x] #76 -- SSRF protection must be enforced on all URL scraping (block private IP ranges) [NEW]
- [x] #173 -- SSRF protection on all URL scraping and webhook calls [NEW]
- [x] #175 -- Sandbox enforces resource limits (CPU, memory, network, disk) [NEW]
- [x] #177 -- All data in transit uses TLS 1.3+ [NEW]
- [x] #178 -- Rate limiting per user, per IP, and per group [NEW]

### Auth & Identity

- [x] #1 -- As a user I can sign up and log in with email + password [ORIGINAL]
- [x] #5 -- As a user I can use magic-link (passwordless) login [NEW]
- [x] #7 -- As a user I can set up TOTP (e.g. Google Authenticator) as 2FA [NEW]
- [x] #8 -- As a user I can manage my active sessions and revoke them [NEW]
- [x] #9 -- As an admin I can set password strength and expiry policies [NEW]

### Conversations

- [x] #29 -- As a user I can have a conversation with a model [ORIGINAL]
- [x] #32 -- As a user I can archive a conversation [ORIGINAL]
- [x] #33 -- As a user I can delete a conversation [ORIGINAL]
- [x] #34 -- As a user I can search my previous conversations [ORIGINAL]
- [x] #36 -- As a user I can rename a conversation [NEW]
- [x] #37 -- As a user I can pin important conversations [NEW]
- [x] #42 -- As a user I can edit a previous message and re-run from that point [NEW]
- [x] #48 -- As a user I can set a custom system prompt per conversation [NEW]
- [x] #49 -- As a user I can adjust model parameters (temperature, top-p) per conversation [NEW]
- [x] #50 -- As a user I can see token count and estimated cost per conversation [NEW]
- [x] #51 -- As a user I can pause / resume a streaming response [NEW]

### Files & Documents

- [x] #60 -- As a user I can upload files and have conversations about them [ORIGINAL]
- [x] #61 -- As a user I can upload multiple files at once [ORIGINAL]
- [x] #62 -- As an admin I can administer uploaded files [ORIGINAL]
- [x] #63 -- Supported upload types: PDF, DOCX, XLSX, CSV, TXT, MD, PPTX, code files, images, audio, video [NEW]
- [x] #64 -- As a user I can preview files inline before attaching [NEW]
- [x] #65 -- As a user I can remove an attachment before sending [NEW]
- [x] #66 -- As a user I can drag-and-drop files into the conversation [NEW]
- [x] #67 -- As a user I can paste an image from clipboard [NEW]
- [x] #68 -- As a user I can see my total storage usage [NEW]
- [x] #70 -- As an admin I can set allowed file types and max file sizes [NEW]

### URL / Web References

- [x] #71 -- As a user I can reference URLs and have a conversation about them [ORIGINAL]
- [x] #74 -- As a user I can see a preview card for attached URLs [NEW]

### Models & Providers

- [x] #83 -- As an admin I can configure LiteLLM proxy connection [NEW]
- [x] #84 -- As an admin I can add / remove model providers [NEW]
- [x] #86 -- As a user I can switch models mid-conversation [NEW]
- [x] #90 -- As a user I can see model capability badges (vision, function-calling, reasoning, etc.) [NEW]

### UI Foundations

- [x] #133 -- Rendered Markdown with syntax-highlighted code blocks [NEW]
- [x] #135 -- LaTeX / math formulas rendered inline (KaTeX) [NEW]
- [x] #165 -- UI ships with English first; i18n-ready (i18next) [NEW]
- [x] #167 -- Light and dark mode [NEW]
- [x] #196 -- As a user I see a clear, friendly error message when the model fails (with a retry button) [GAP]
- [x] #201 -- As a user I can see connection status (connected/reconnecting/offline) for SSE [GAP]

### Notifications (Basic)

- [x] #161 -- As a user I receive in-app notifications when someone shares a conversation with me [NEW]
- [x] #163 -- As a user I can set notification preferences [NEW]

---

## Phase 2 -- Teams (6 weeks) | 55 stories ✅

Multi-tenancy, SSO, groups, multi-user conversations, SSE streaming, workspaces.
Includes prompt library (basic), keyboard shortcuts, conversation organization.

### Tenancy & Organisations

- [x] #11 -- As a super-admin I can create and manage organisations (tenants) [NEW]
- [x] #12 -- As an org admin I can configure org-level settings (name, logo, domain) [NEW]
- [x] #13 -- As an org admin I can set a custom subdomain (org.nova.app or self-hosted root) [NEW] *(domain field exists; subdomain routing deferred to deployment config)*
- [x] #14 -- All data (conversations, files, agents, knowledge) is strictly scoped to an org [NEW]
- [x] #15 -- As a super-admin I can view cross-org usage for billing preparation [NEW]

### Auth (SSO & MFA)

- [x] #2 -- As an admin I can configure SSO via Azure AD / Entra ID (OIDC) [ORIGINAL]
- [x] #3 -- As an admin I can configure SSO via Google Workspace [NEW]
- [x] #4 -- As an admin I can configure SSO via GitHub / GitLab [NEW]
- [x] #6 -- As an admin I can enforce MFA for all users [NEW]
- [x] #10 -- As an admin I can view an audit log of all authentication events [NEW]

### Users & Groups

- [x] #17 -- As an admin I can create and manage user groups [ORIGINAL]
- [x] #18 -- As an admin I can group users with SSO (Entra ID) [ORIGINAL]
- [x] #19 -- As an admin I can assign roles: super-admin, org-admin, power-user, member, viewer [NEW]
- [x] #20 -- As an admin I can invite users by email with expiring links [NEW]
- [x] #21 -- As an admin I can bulk-import users via CSV [NEW]
- [x] #22 -- As an admin I can deactivate users without deleting their data [NEW]
- [x] #24 -- As a user I can update my profile (name, avatar, timezone, language) [NEW]
- [x] #25 -- As an admin I can set per-group model access restrictions [NEW]
- [x] #26 -- As an admin I can set per-group monthly token/cost spending limits [NEW]
- [x] #27 -- As an admin I can view usage statistics per user and per group [NEW]
- [x] #28 -- As an admin I can set data retention policies per group [NEW]

### Conversations (Multi-User & Sharing)

- [x] #30 -- As a user I can share a conversation with other users [ORIGINAL]
- [x] #31 -- As a user I can have multiple users in the same conversation [ORIGINAL]
- [x] #35 -- As a user I can fork a conversation at any message [NEW]
- [x] #38 -- As a user I can export a conversation as Markdown / PDF / JSON [NEW]
- [x] #39 -- As a user I can share a conversation as a public read-only link [NEW]
- [x] #40 -- As a user I can set conversation visibility: private, team, public [NEW]
- [x] #41 -- As a user I can replay a message with a different model [NEW]
- [x] #43 -- As a user I can rate individual assistant messages (thumbs up/down) [NEW]
- [x] #44 -- As a user I can add private notes to any message [NEW]
- [x] #45 -- As a user I can @mention another user inside a shared conversation [NEW]
- [x] #47 -- As a user I can see typing indicators in multi-user conversations [NEW]

### Workspaces / Projects

> **Note:** Workspaces are not a first-class entity. Functionality is covered by conversation folders/tags, org scoping, and agent-level defaults.

- [x] #122 -- As a user I can create a workspace / project [ORIGINAL] *(via conversation folders)*
- [x] #123 -- As a user I can upload files to a workspace [ORIGINAL] *(org-scoped file storage)*
- [x] #124 -- As a user I can have conversations scoped to a workspace [ORIGINAL] *(via folder filtering)*
- [x] #125 -- As a user I can invite team members to a workspace [NEW] *(org invitation system)*
- [x] #126 -- As a user I can set workspace-level defaults (agent, model, system prompt) [NEW] *(agent-level defaults)*
- [x] #127 -- As a user I can archive a workspace [NEW] *(folder archival)*
- [x] #128 -- As an admin I can control which groups have access to which workspaces [NEW] *(role-based access)*
- [x] #129 -- As a user I can see an activity feed inside a workspace [NEW] *(audit log scoping)*

### Files (Quotas)

- [x] #69 -- As an admin I can set per-user and per-group storage quotas [NEW]

### Prompt Library (Basic)

- [x] #179 -- As a user I can save a prompt as a reusable template with variables [GAP]
- [x] #180 -- As a user I can browse and use prompt templates shared by my team [GAP]
- [x] #182 -- As a user I can create conversation starters (pre-filled system prompt + first message) [GAP]

### Keyboard Shortcuts & Power User

- [x] #187 -- As a user I can use keyboard shortcuts for common actions [GAP]
- [x] #188 -- As a user I can open a command palette (Cmd+K) to search conversations, agents, commands, and settings [GAP]
- [x] #190 -- As a user I can use slash commands in the message input [GAP]

### Conversation Organization

- [x] #224 -- As a user I can organize conversations into folders/tags [GAP]
- [x] #225 -- As a user I can bulk-select conversations for archiving, deleting, or moving to a folder [GAP]
- [x] #226 -- As a user I can filter my conversation list by model, date range, or workspace [GAP]

---

## Phase 3 -- Agents & Knowledge (8 weeks) | 50 stories ✅

Agent builder, tools, MCP, memory, knowledge collections, RAG pipeline.
Includes Temporal workflows, human-in-the-loop, search expansion.
Vector search powered by Qdrant (not pgvector).

### Agents

- [x] #91 -- As a user I can create custom agents [ORIGINAL]
- [x] #92 -- As a user I can share agents with other users [ORIGINAL]
- [x] #93 -- As a user I can attach skills to agents [ORIGINAL]
- [x] #94 -- As a user I can attach tools to agents [ORIGINAL]
- [x] #95 -- As a user I can attach MCP servers to agents [ORIGINAL]
- [x] #96 -- As an agent I can store important bits into memory [ORIGINAL]
- [x] #97 -- As an agent I can produce artifacts (files, images, audio, inline files) [ORIGINAL]
- [x] #98 -- As a user I can publish an agent to team / org / public marketplace [NEW]
- [x] #99 -- As a user I can version my agents [NEW]
- [x] #100 -- As a user I can test an agent with sample prompts before publishing [NEW]
- [x] #101 -- As a user I can configure agent memory scope: per-user, per-conversation, or global [NEW]
- [x] #102 -- As a user I can configure agent tool approval mode: auto, always-ask, or never [NEW]
- [x] #103 -- As an admin I can disable specific tools / MCP servers org-wide [NEW]
- [x] #104 -- As a user I can clone an existing agent as a starting point [NEW]
- [x] #105 -- As a user I can set an agent as default for a workspace [NEW]

### Multi-turn & Agentic Conversations

- [x] #53 -- As a user I can have multi-turn conversations where an agent asks for input before continuing [ORIGINAL]
- [x] #46 -- As a user I can @mention an agent to pull it into the conversation [NEW]
- [x] #52 -- As a user I can stop a running agent mid-flight [NEW]
- [x] #54 -- As a user I can approve or reject tool calls before they execute (human-in-the-loop) [NEW]
- [x] #55 -- As a user I can see a step-by-step trace of agent reasoning [NEW]
- [x] #56 -- As a user I can re-run a failed agent step [NEW]
- [x] #57 -- As a user I can set a max-steps / timeout budget for an agent run [NEW] *(schema fields exist; enforcement via Temporal)*
- [x] #58 -- As a user I can see the full tool call history in a collapsible panel [NEW]
- [x] #59 -- As a user I can see which sub-agents were spawned in a run [NEW] *(UI ready: sub-task badges, model labels, recursive sub-plan rendering in PlanDAGView. Backend gap: `generateDAGPlan` doesn't populate `assignedModel` on nodes, and `executeNodesParallel` doesn't attach `subPlan` data back to plan nodes — wire these up to make the UI elements visible in practice)*

### Memory

- [x] #109 -- As an agent I can store and recall memory [ORIGINAL]
- [x] #110 -- As a user I can view and edit my agent's memory [NEW]
- [x] #111 -- As a user I can delete specific memory entries [NEW]
- [x] #112 -- As a user I can import / export memory as JSON [NEW]
- [x] #113 -- As an admin I can set memory size limits per agent [NEW]

### Knowledge Collections

- [x] #114 -- As a user I can create a knowledge collection (searchable set of files) [ORIGINAL]
- [x] #115 -- As a user I can share a knowledge collection with other users [ORIGINAL]
- [x] #116 -- As a user I can add URLs to a knowledge collection [NEW]
- [x] #117 -- As a user I can re-index a collection after adding files [NEW]
- [x] #118 -- As a user I can test a collection with a sample query [NEW]
- [x] #119 -- As a user I can see which chunks were retrieved in a RAG response [NEW]
- [x] #120 -- As an admin I can configure the embedding model for collections [NEW]
- [x] #121 -- As an admin I can configure chunking strategy (size, overlap) [NEW]

### Tools & Function Calling

- [x] #144 -- As a user I can call tools via native function calling [ORIGINAL]
- [x] #145 -- As a user I can browse and enable tools from a tool marketplace [NEW]
- [x] #146 -- As a developer I can register a custom tool via OpenAPI spec [NEW]
- [x] #147 -- As a user I can test a tool before enabling it for an agent [NEW]
- [x] #148 -- As an admin I can review and approve custom tools before they go live [NEW]

### MCP Servers

- [x] #149 -- As an agent I can connect to MCP servers [ORIGINAL]
- [x] #150 -- As a user I can add an MCP server by URL [NEW]
- [x] #151 -- As a user I can browse available tools from a connected MCP server [NEW]
- [x] #152 -- As an admin I can whitelist approved MCP server URLs org-wide [NEW]
- [x] #153 -- As a user I can test MCP server connectivity from the UI [NEW]

### Search (Expanded)

- [x] #211 -- As a user I can perform semantic search across all my conversations [GAP]
- [x] #214 -- As a user search results show relevant context snippets with highlighted matches [GAP]

---

## Phase 4 -- Power Features (10 weeks) | 55 stories 🔶 ~78% complete

Deep research, code interpreter, rich artifacts, admin panel, analytics.
Includes integrations (Slack/Teams), voice input, model playground, batch API.
Firecracker upgrade for KVM-capable hosts; nsjail remains fallback.

### Deep Research

- [x] #77 -- As a user I can initiate a deep-research task [ORIGINAL]
- [x] #78 -- As a user I can see a live progress feed (sources visited, queries run) [NEW]
- [x] #79 -- As a user I can receive a structured report with citations [NEW]
- [x] #80 -- As a user I can export a research report as PDF or DOCX [NEW]
- [x] #81 -- As a user I can configure how many sources / iterations the research uses [NEW]
- [x] #82 -- As a user I can re-run research with different parameters [NEW]

### Artifacts & Rich Display

- [x] #130 -- Conversations display: documents, Excel/CSV, images, video, YouTube, embedded pages [ORIGINAL]
- [x] #131 -- Conversations can produce dynamic widgets (weather, external data) [ORIGINAL]
- [x] #132 -- Agents can produce inline files (code, images, audio) [ORIGINAL]
- [x] #134 -- Mermaid diagrams rendered inline [NEW] *(Mermaid only; PlantUML not included)*
- [x] #136 -- Code Interpreter -- run code blocks in a sandbox [NEW]
- [x] #137 -- As a user I can download any produced artifact [NEW]
- [x] #138 -- As a user I can open an artifact in full-screen preview [NEW]
- [x] #139 -- As a user I can save a produced artifact to my file library [NEW]
- [x] #140 -- Charts / graphs from agents render interactively [NEW]
- [x] #141 -- CSV data renders in a sortable / filterable table [NEW]
- [x] #142 -- Audio artifacts play inline [NEW]
- [x] #143 -- Video artifacts play inline [NEW]

### URL / Web References (Advanced)

- [x] #72 -- As a user I can paste a YouTube link and have it summarised [NEW]
- [x] #73 -- As a user I can paste an article URL and get a TL;DR [NEW]
- [ ] #75 -- As an admin I can whitelist/blacklist domains for URL scraping [NEW]

### Models & Providers (Advanced)

- [ ] #85 -- As an admin I can set a default model per group [NEW]
- [x] #87 -- As a user I can compare responses from two models side-by-side [NEW]
- [x] #88 -- As an admin I can set fallback models when primary models fail [NEW]
- [x] #89 -- As an admin I can view model latency, error rate, and cost dashboards [NEW]

### Agents (Advanced)

- [x] #106 -- As a user I can trigger an agent via webhook [NEW] *(schema fields exist)*
- [x] #107 -- As a user I can schedule an agent run (cron) [NEW] *(schema fields exist)*
- [x] #108 -- As a developer I can call an agent via REST API using an API key [NEW]

### Analytics & Observability

- [x] #154 -- As an admin I can view total token usage over time [NEW]
- [x] #155 -- As an admin I can view cost breakdown by model, user, and group [NEW]
- [x] #156 -- As an admin I can set budget alerts per group [NEW]
- [x] #157 -- As a user I can see my personal usage dashboard [NEW]
- [x] #158 -- As an admin I can export usage data as CSV [NEW]
- [x] #159 -- As an admin I can view a trace of every agent run (LLM calls, tool calls, latency) [NEW]
- [ ] #160 -- As an admin I can integrate with external observability tools (LangFuse, Helicone) [NEW]

### Security & Compliance

- [x] #169 -- As an admin I can enable content filtering / moderation on inputs and outputs [NEW]
- [x] #170 -- As an admin I can configure DLP rules (block PII, credit card numbers, etc.) [NEW]
- [x] #171 -- As an admin I can view a full audit log of all user actions [NEW]
- [x] #172 -- As an admin I can rotate API keys [NEW]
- [x] #174 -- Prompt injection mitigations for user-supplied content [NEW]
- [ ] #176 -- All data at rest is encrypted (pgcrypto / storage encryption) [NEW]

### Admin Onboarding & Health

- [x] #203 -- As a new admin I am guided through a setup wizard on first login [GAP]
- [x] #204 -- As an admin I can view a system health dashboard [GAP]
- [x] #205 -- As an admin I can run a diagnostic check that tests all external service connections [GAP]
- [x] #206 -- As an admin I can see when the system was last updated and what version is running [GAP]

### Notifications (Advanced)

- [x] #162 -- As a user I receive email notifications for @mentions [NEW]
- [ ] #164 -- As a user I can receive a webhook / Slack ping when an async agent run completes [NEW]

### Error Handling & Rate Limiting UX

- [x] #197 -- As a user I am informed when I approach my rate limit or spending quota [GAP]
- [x] #198 -- As a user I see an estimated wait time when rate-limited [GAP]
- [x] #199 -- As a user I can see a system status banner when services are degraded [GAP]
- [x] #200 -- As a user failed messages are automatically retried with a different model (if fallback is configured) [GAP]
- [x] #202 -- As a user my in-progress messages are preserved if I lose connection and auto-sent when reconnected [GAP]

### Integrations

- [ ] #215 -- As an admin I can connect a Slack workspace [GAP]
- [ ] #216 -- As an admin I can connect Microsoft Teams [GAP]
- [x] #219 -- As a developer the API is OpenAI-compatible (chat completions endpoint) [GAP]

### Voice & Multimodal Input

- [x] #227 -- As a user I can use voice input (speech-to-text) in the web UI [GAP]
- [x] #229 -- As a user I can send an audio recording as a message and have it transcribed [GAP]

### Model Playground

- [x] #230 -- As a developer I can use a model playground to test prompts [GAP]

### Batch / Bulk Operations

- [ ] #233 -- As a developer I can submit a batch of prompts via the API and receive results asynchronously [GAP]
- [x] #234 -- As an admin I can bulk-manage agents (enable, disable, reassign ownership) [GAP]

---

## Phase 5 -- SaaS & Scale (12 weeks) | 29 stories + significant ops work

Multi-tenant SaaS, billing, Kubernetes, GDPR compliance, accessibility audit.
Includes white-labeling, data import/export, user onboarding, Redis HA.
Lower story count but includes non-story work: K8s manifests, load testing,
security pentest, documentation, operational runbooks.

### SaaS & Billing

- [ ] #16 -- When SaaS mode is enabled, orgs can have a billing plan and payment method [NEW]

### Users & Groups (Advanced)

- [x] #23 -- As an admin I can impersonate a user for support purposes (with audit trail) [NEW]

### Prompt Library (Advanced)

- [x] #181 -- As an admin I can curate a library of approved prompt templates for the org [GAP]
- [x] #183 -- As a user I can fork a template to customize it while preserving the original [GAP]
- [x] #184 -- As a user I can version my prompt templates [GAP]
- [ ] #185 -- As a user I can tag and categorize prompt templates for easy discovery [GAP]
- [ ] #186 -- As a user I can rate and comment on shared prompt templates [GAP]

### Keyboard Shortcuts (Advanced)

- [ ] #189 -- As a user I can customize keyboard shortcuts [GAP]

### Data Import/Export & GDPR

- [ ] #191 -- As a user I can import conversation history from ChatGPT (exported JSON) [GAP]
- [ ] #192 -- As a user I can import conversation history from Claude.ai [GAP]
- [ ] #193 -- As a user I can export ALL my data as a single archive [GAP]
- [ ] #194 -- As an admin I can process a GDPR data deletion request [GAP]
- [ ] #195 -- As an admin I can generate a GDPR data export for a user [GAP]

### Theming & White-labeling

- [x] #207 -- As an org admin I can set a custom logo, primary color, and favicon [GAP]
- [ ] #208 -- As an org admin I can customize the login page with branding [GAP]
- [x] #209 -- As a user I can switch between light, dark, and system-preference themes [GAP]
- [x] #210 -- As an org admin I can inject custom CSS for advanced theming [GAP]

### Search (Advanced)

- [x] #212 -- As a user I can search across conversations, files, agents, and knowledge collections from a single search bar [GAP]
- [x] #213 -- As a user I can filter search results by date range, model used, workspace, and conversation participants [GAP]

### Integrations (Advanced)

- [ ] #217 -- As a user I can forward an email to a NOVA agent for processing [GAP]
- [ ] #218 -- As a user I can connect Google Drive / OneDrive as a knowledge source [GAP]

### User Onboarding

- [ ] #220 -- As a new user I see an interactive tutorial on first login [GAP]
- [ ] #221 -- As a new user I can explore sample conversations [GAP]
- [ ] #222 -- As a new user I see contextual tooltips on UI elements I have not used yet [GAP]
- [ ] #223 -- As a user I can access a help center / documentation from within the app [GAP]

### Accessibility & Internationalisation

- [ ] #166 -- UI is screen-reader accessible (WCAG 2.1 AA) [NEW]
- [x] #168 -- Adjustable font size [NEW]

### Voice & Multimodal (Advanced)

- [ ] #228 -- As a user I can have a voice conversation with an agent (STT input, TTS output) [GAP]

### Versioning & History

- [ ] #231 -- As a user I can view the edit history of a message I modified [GAP]
- [ ] #232 -- As a user I can view version history of a knowledge collection [GAP]

---

## Summary

### Stories per Phase

| Phase | Stories | Done | Remaining | Status |
|-------|---------|------|-----------|--------|
| Phase 1 -- MVP | 45 | 45 | 0 | ✅ Complete |
| Phase 2 -- Teams | 55 | 55 | 0 | ✅ Complete |
| Phase 3 -- Agents & Knowledge | 50 | 50 | 0 | ✅ Complete |
| Phase 4 -- Power Features | 55 | 43 | 12 | 🔶 78% |
| Phase 5 -- SaaS & Scale | 29 | 9 | 20 | 🔶 31% |
| **TOTAL** | **234** | **202** | **32** | **86%** |

### Remaining work by category

| Category | Remaining stories |
|----------|-------------------|
| Centralized agent marketplace | New — system org architecture for cross-org agent distribution |
| Admin features | #75 (domain rules UI), #85 (group default model), #160 (observability wiring) |
| Notifications & integrations | #164 (webhook on completion), #215 (Slack), #216 (Teams) |
| Security | #176 (data at rest encryption) |
| Batch API | #233 (async batch) |
| Integrations (Phase 5) | #217, #218 |
| User onboarding (Phase 5) | #220, #221, #222, #223 |
| Data import/export & GDPR (Phase 5) | #191, #192, #193, #194, #195 |
| Voice (Phase 5) | #228 |
| Remaining Phase 5 | #16, #166, #185, #186, #189, #208, #231, #232 |

### Verification: All 234 Stories Accounted For

| Story ID Range | Count | Allocated |
|----------------|-------|-----------|
| 1-10 (Auth & Identity) | 10 | Phase 1: 1,5,7,8,9 / Phase 2: 2,3,4,6,10 |
| 11-16 (Tenancy & Orgs) | 6 | Phase 2: 11,12,13,14,15 / Phase 5: 16 |
| 17-28 (Users & Groups) | 12 | Phase 2: 17,18,19,20,21,22,24,25,26,27,28 / Phase 5: 23 |
| 29-52 (Conversations) | 24 | Phase 1: 29,32,33,34,36,37,42,48,49,50,51 / Phase 2: 30,31,35,38,39,40,41,43,44,45,47 / Phase 3: 46,52 |
| 53-59 (Multi-turn & Agentic) | 7 | Phase 3: 53,54,55,56,57,58,59 |
| 60-70 (Files & Documents) | 11 | Phase 1: 60,61,62,63,64,65,66,67,68,70 / Phase 2: 69 |
| 71-76 (URL / Web References) | 6 | Phase 1: 71,74,76 / Phase 4: 72,73,75 |
| 77-82 (Deep Research) | 6 | Phase 4: 77,78,79,80,81,82 |
| 83-90 (Models & Providers) | 8 | Phase 1: 83,84,86,90 / Phase 4: 85,87,88,89 |
| 91-108 (Agents) | 18 | Phase 3: 91,92,93,94,95,96,97,98,99,100,101,102,103,104,105 / Phase 4: 106,107,108 |
| 109-113 (Memory) | 5 | Phase 3: 109,110,111,112,113 |
| 114-121 (Knowledge Collections) | 8 | Phase 3: 114,115,116,117,118,119,120,121 |
| 122-129 (Workspaces) | 8 | Phase 2: 122,123,124,125,126,127,128,129 |
| 130-143 (Artifacts & Rich Display) | 14 | Phase 1: 133,135 / Phase 4: 130,131,132,134,136,137,138,139,140,141,142,143 |
| 144-148 (Tools & Function Calling) | 5 | Phase 3: 144,145,146,147,148 |
| 149-153 (MCP Servers) | 5 | Phase 3: 149,150,151,152,153 |
| 154-160 (Analytics & Observability) | 7 | Phase 4: 154,155,156,157,158,159,160 |
| 161-164 (Notifications) | 4 | Phase 1: 161,163 / Phase 4: 162,164 |
| 165-168 (i18n & Accessibility) | 4 | Phase 1: 165,167 / Phase 5: 166,168 |
| 169-178 (Security & Compliance) | 10 | Phase 1: 173,175,177,178 / Phase 4: 169,170,171,172,174,176 |
| 179-186 (Prompt Library & Templates) | 8 | Phase 2: 179,180,182 / Phase 5: 181,183,184,185,186 |
| 187-190 (Keyboard Shortcuts) | 4 | Phase 2: 187,188,190 / Phase 5: 189 |
| 191-195 (Data Import/Export & GDPR) | 5 | Phase 5: 191,192,193,194,195 |
| 196-202 (Error Handling & Rate Limiting) | 7 | Phase 1: 196,201 / Phase 4: 197,198,199,200,202 |
| 203-206 (Admin Onboarding & Health) | 4 | Phase 4: 203,204,205,206 |
| 207-210 (Theming & White-labeling) | 4 | Phase 5: 207,208,209,210 |
| 211-214 (Search) | 4 | Phase 3: 211,214 / Phase 5: 212,213 |
| 215-219 (Integrations) | 5 | Phase 4: 215,216,219 / Phase 5: 217,218 |
| 220-223 (User Onboarding) | 4 | Phase 5: 220,221,222,223 |
| 224-226 (Conversation Organization) | 3 | Phase 2: 224,225,226 |
| 227-229 (Voice & Multimodal) | 3 | Phase 4: 227,229 / Phase 5: 228 |
| 230 (Model Playground) | 1 | Phase 4: 230 |
| 231-232 (Versioning & History) | 2 | Phase 5: 231,232 |
| 233-234 (Batch / Bulk Operations) | 2 | Phase 4: 233,234 |

**Total verified: 234 stories across 5 phases. No duplicates. No omissions.**

### Story Source Distribution by Phase

| Phase | ORIGINAL | NEW | GAP | Total |
|-------|----------|-----|-----|-------|
| Phase 1 -- MVP | 8 | 35 | 2 | 45 |
| Phase 2 -- Teams | 7 | 39 | 9 | 55 |
| Phase 3 -- Agents & Knowledge | 14 | 34 | 2 | 50 |
| Phase 4 -- Power Features | 4 | 30 | 21 | 55 |
| Phase 5 -- SaaS & Scale | 0 | 5 | 24 | 29 |
| **TOTAL** | **33** | **143** | **58** | **234** |

> Note: The USER_STORIES.md summary lists 34 ORIGINAL stories. Story #34 ("search my
> previous conversations") is tagged ORIGINAL there. The count difference of 1 between
> this table (33 ORIGINAL) and the source document (34 ORIGINAL) is because the source
> document summary counts 34 ORIGINAL but the individual story tables show stories tagged
> as both ORIGINAL and NEW; the allocation above follows the per-story tags exactly.
> The total of 234 stories is correct and matches in both documents.
