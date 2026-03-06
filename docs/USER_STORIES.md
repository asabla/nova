# NOVA -- Complete User Story Inventory

> This document contains ALL user stories for the NOVA platform.
>
> **Source taxonomy:**
> - **ORIGINAL** -- Stories from the initial specification (core product vision)
> - **NEW** -- Stories discovered by expanding original categories during research (e.g., "admin can configure SSO" expanded to include Google, GitHub)
> - **GAP** -- Entirely new categories found via competitive analysis of ChatGPT, Claude.ai, Open WebUI, LibreChat, TypingMind, Cursor, Perplexity, Jan.ai
>
> **Phase priority guidance:**
> - ORIGINAL stories are the foundation (Phases 1-3)
> - NEW stories complete feature areas (distributed across all phases)
> - GAP stories are competitive catch-up (primarily Phases 4-5)
>
> **Role definitions:**
> - "As a user" = member role or above (default authenticated user)
> - "As an admin" = org-admin or super-admin
> - "As a developer" = power-user with API key access
> - "As an org admin" = org-admin specifically
> - "As a super-admin" = platform-wide administrator
> - "As a new user" = first-time user (any role)

---

## 1. Authentication & Identity

| # | Story | Source |
|---|-------|--------|
| 1 | As a user I can sign up and log in with email + password | ORIGINAL |
| 2 | As an admin I can configure SSO via Azure AD / Entra ID (OIDC) | ORIGINAL |
| 3 | As an admin I can configure SSO via Google Workspace | NEW |
| 4 | As an admin I can configure SSO via GitHub / GitLab | NEW |
| 5 | As a user I can use magic-link (passwordless) login | NEW |
| 6 | As an admin I can enforce MFA for all users | NEW |
| 7 | As a user I can set up TOTP (e.g. Google Authenticator) as 2FA | NEW |
| 8 | As a user I can manage my active sessions and revoke them | NEW |
| 9 | As an admin I can set password strength and expiry policies | NEW |
| 10 | As an admin I can view an audit log of all authentication events | NEW |

---

## 2. Tenancy & Organisations

| # | Story | Source |
|---|-------|--------|
| 11 | As a super-admin I can create and manage organisations (tenants) | NEW |
| 12 | As an org admin I can configure org-level settings (name, logo, domain) | NEW |
| 13 | As an org admin I can set a custom subdomain (org.nova.app or self-hosted root) | NEW |
| 14 | All data (conversations, files, agents, knowledge) is strictly scoped to an org | NEW |
| 15 | As a super-admin I can view cross-org usage for billing preparation | NEW |
| 16 | When SaaS mode is enabled, orgs can have a billing plan and payment method | NEW |

---

## 3. Users & Groups

| # | Story | Source |
|---|-------|--------|
| 17 | As an admin I can create and manage user groups | ORIGINAL |
| 18 | As an admin I can group users with SSO (Entra ID) | ORIGINAL |
| 19 | As an admin I can assign roles: super-admin, org-admin, power-user, member, viewer | NEW |
| 20 | As an admin I can invite users by email with expiring links | NEW |
| 21 | As an admin I can bulk-import users via CSV | NEW |
| 22 | As an admin I can deactivate users without deleting their data | NEW |
| 23 | As an admin I can impersonate a user for support purposes (with audit trail) | NEW |
| 24 | As a user I can update my profile (name, avatar, timezone, language) | NEW |
| 25 | As an admin I can set per-group model access restrictions | NEW |
| 26 | As an admin I can set per-group monthly token/cost spending limits | NEW |
| 27 | As an admin I can view usage statistics per user and per group | NEW |
| 28 | As an admin I can set data retention policies per group | NEW |

---

## 4. Conversations

| # | Story | Source |
|---|-------|--------|
| 29 | As a user I can have a conversation with a model | ORIGINAL |
| 30 | As a user I can share a conversation with other users | ORIGINAL |
| 31 | As a user I can have multiple users in the same conversation | ORIGINAL |
| 32 | As a user I can archive a conversation | ORIGINAL |
| 33 | As a user I can delete a conversation | ORIGINAL |
| 34 | As a user I can search my previous conversations | ORIGINAL |
| 35 | As a user I can fork a conversation at any message | NEW |
| 36 | As a user I can rename a conversation | NEW |
| 37 | As a user I can pin important conversations | NEW |
| 38 | As a user I can export a conversation as Markdown / PDF / JSON | NEW |
| 39 | As a user I can share a conversation as a public read-only link | NEW |
| 40 | As a user I can set conversation visibility: private, team, public | NEW |
| 41 | As a user I can replay a message with a different model | NEW |
| 42 | As a user I can edit a previous message and re-run from that point | NEW |
| 43 | As a user I can rate individual assistant messages (thumbs up/down) | NEW |
| 44 | As a user I can add private notes to any message | NEW |
| 45 | As a user I can @mention another user inside a shared conversation | NEW |
| 46 | As a user I can @mention an agent to pull it into the conversation | NEW |
| 47 | As a user I can see typing indicators in multi-user conversations | NEW |
| 48 | As a user I can set a custom system prompt per conversation | NEW |
| 49 | As a user I can adjust model parameters (temperature, top-p) per conversation | NEW |
| 50 | As a user I can see token count and estimated cost per conversation | NEW |
| 51 | As a user I can pause / resume a streaming response | NEW |
| 52 | As a user I can stop a running agent mid-flight | NEW |

---

## 5. Multi-turn & Agentic Conversations

| # | Story | Source |
|---|-------|--------|
| 53 | As a user I can have multi-turn conversations where an agent asks for input before continuing | ORIGINAL |
| 54 | As a user I can approve or reject tool calls before they execute (human-in-the-loop) | NEW |
| 55 | As a user I can see a step-by-step trace of agent reasoning | NEW |
| 56 | As a user I can re-run a failed agent step | NEW |
| 57 | As a user I can set a max-steps / timeout budget for an agent run | NEW |
| 58 | As a user I can see the full tool call history in a collapsible panel | NEW |
| 59 | As a user I can see which sub-agents were spawned in a run | NEW |

---

## 6. Files & Documents

| # | Story | Source |
|---|-------|--------|
| 60 | As a user I can upload files and have conversations about them | ORIGINAL |
| 61 | As a user I can upload multiple files at once | ORIGINAL |
| 62 | As an admin I can administer uploaded files | ORIGINAL |
| 63 | Supported upload types: PDF, DOCX, XLSX, CSV, TXT, MD, PPTX, code files, images, audio, video | NEW |
| 64 | As a user I can preview files inline before attaching | NEW |
| 65 | As a user I can remove an attachment before sending | NEW |
| 66 | As a user I can drag-and-drop files into the conversation | NEW |
| 67 | As a user I can paste an image from clipboard | NEW |
| 68 | As a user I can see my total storage usage | NEW |
| 69 | As an admin I can set per-user and per-group storage quotas | NEW |
| 70 | As an admin I can set allowed file types and max file sizes | NEW |

---

## 7. URL / Web References

| # | Story | Source |
|---|-------|--------|
| 71 | As a user I can reference URLs and have a conversation about them | ORIGINAL |
| 72 | As a user I can paste a YouTube link and have it summarised | NEW |
| 73 | As a user I can paste an article URL and get a TL;DR | NEW |
| 74 | As a user I can see a preview card for attached URLs | NEW |
| 75 | As an admin I can whitelist/blacklist domains for URL scraping | NEW |
| 76 | SSRF protection must be enforced on all URL scraping (block private IP ranges) | NEW |

---

## 8. Deep Research

| # | Story | Source |
|---|-------|--------|
| 77 | As a user I can initiate a deep-research task | ORIGINAL |
| 78 | As a user I can see a live progress feed (sources visited, queries run) | NEW |
| 79 | As a user I can receive a structured report with citations | NEW |
| 80 | As a user I can export a research report as PDF or DOCX | NEW |
| 81 | As a user I can configure how many sources / iterations the research uses | NEW |
| 82 | As a user I can re-run research with different parameters | NEW |

---

## 9. Models & Providers

| # | Story | Source |
|---|-------|--------|
| 83 | As an admin I can configure LiteLLM proxy connection | NEW |
| 84 | As an admin I can add / remove model providers | NEW |
| 85 | As an admin I can set a default model per group | NEW |
| 86 | As a user I can switch models mid-conversation | NEW |
| 87 | As a user I can compare responses from two models side-by-side | NEW |
| 88 | As an admin I can set fallback models when primary models fail | NEW |
| 89 | As an admin I can view model latency, error rate, and cost dashboards | NEW |
| 90 | As a user I can see model capability badges (vision, function-calling, reasoning, etc.) | NEW |

---

## 10. Agents

| # | Story | Source |
|---|-------|--------|
| 91 | As a user I can create custom agents | ORIGINAL |
| 92 | As a user I can share agents with other users | ORIGINAL |
| 93 | As a user I can attach skills to agents | ORIGINAL |
| 94 | As a user I can attach tools to agents | ORIGINAL |
| 95 | As a user I can attach MCP servers to agents | ORIGINAL |
| 96 | As an agent I can store important bits into memory | ORIGINAL |
| 97 | As an agent I can produce artifacts (files, images, audio, inline files) | ORIGINAL |
| 98 | As a user I can publish an agent to team / org / public marketplace | NEW |
| 99 | As a user I can version my agents | NEW |
| 100 | As a user I can test an agent with sample prompts before publishing | NEW |
| 101 | As a user I can configure agent memory scope: per-user, per-conversation, or global | NEW |
| 102 | As a user I can configure agent tool approval mode: auto, always-ask, or never | NEW |
| 103 | As an admin I can disable specific tools / MCP servers org-wide | NEW |
| 104 | As a user I can clone an existing agent as a starting point | NEW |
| 105 | As a user I can set an agent as default for a workspace | NEW |
| 106 | As a user I can trigger an agent via webhook | NEW |
| 107 | As a user I can schedule an agent run (cron) | NEW |
| 108 | As a developer I can call an agent via REST API using an API key | NEW |

---

## 11. Memory

| # | Story | Source |
|---|-------|--------|
| 109 | As an agent I can store and recall memory | ORIGINAL |
| 110 | As a user I can view and edit my agent's memory | NEW |
| 111 | As a user I can delete specific memory entries | NEW |
| 112 | As a user I can import / export memory as JSON | NEW |
| 113 | As an admin I can set memory size limits per agent | NEW |

---

## 12. Knowledge Collections

| # | Story | Source |
|---|-------|--------|
| 114 | As a user I can create a knowledge collection (searchable set of files) | ORIGINAL |
| 115 | As a user I can share a knowledge collection with other users | ORIGINAL |
| 116 | As a user I can add URLs to a knowledge collection | NEW |
| 117 | As a user I can re-index a collection after adding files | NEW |
| 118 | As a user I can test a collection with a sample query | NEW |
| 119 | As a user I can see which chunks were retrieved in a RAG response | NEW |
| 120 | As an admin I can configure the embedding model for collections | NEW |
| 121 | As an admin I can configure chunking strategy (size, overlap) | NEW |

---

## 13. Workspaces / Projects

| # | Story | Source |
|---|-------|--------|
| 122 | As a user I can create a workspace / project | ORIGINAL |
| 123 | As a user I can upload files to a workspace | ORIGINAL |
| 124 | As a user I can have conversations scoped to a workspace | ORIGINAL |
| 125 | As a user I can invite team members to a workspace | NEW |
| 126 | As a user I can set workspace-level defaults (agent, model, system prompt) | NEW |
| 127 | As a user I can archive a workspace | NEW |
| 128 | As an admin I can control which groups have access to which workspaces | NEW |
| 129 | As a user I can see an activity feed inside a workspace | NEW |

---

## 14. Artifacts & Rich Display

| # | Story | Source |
|---|-------|--------|
| 130 | Conversations display: documents, Excel/CSV, images, video, YouTube, embedded pages | ORIGINAL |
| 131 | Conversations can produce dynamic widgets (weather, external data) | ORIGINAL |
| 132 | Agents can produce inline files (code, images, audio) | ORIGINAL |
| 133 | Rendered Markdown with syntax-highlighted code blocks | NEW |
| 134 | Mermaid / PlantUML diagrams rendered inline | NEW |
| 135 | LaTeX / math formulas rendered inline (KaTeX) | NEW |
| 136 | Code Interpreter -- run code blocks in a sandbox | NEW |
| 137 | As a user I can download any produced artifact | NEW |
| 138 | As a user I can open an artifact in full-screen preview | NEW |
| 139 | As a user I can save a produced artifact to my file library | NEW |
| 140 | Charts / graphs from agents render interactively | NEW |
| 141 | CSV data renders in a sortable / filterable table | NEW |
| 142 | Audio artifacts play inline | NEW |
| 143 | Video artifacts play inline | NEW |

---

## 15. Tools & Function Calling

| # | Story | Source |
|---|-------|--------|
| 144 | As a user I can call tools via native function calling | ORIGINAL |
| 145 | As a user I can browse and enable tools from a tool marketplace | NEW |
| 146 | As a developer I can register a custom tool via OpenAPI spec | NEW |
| 147 | As a user I can test a tool before enabling it for an agent | NEW |
| 148 | As an admin I can review and approve custom tools before they go live | NEW |

---

## 16. MCP Servers

| # | Story | Source |
|---|-------|--------|
| 149 | As an agent I can connect to MCP servers | ORIGINAL |
| 150 | As a user I can add an MCP server by URL | NEW |
| 151 | As a user I can browse available tools from a connected MCP server | NEW |
| 152 | As an admin I can whitelist approved MCP server URLs org-wide | NEW |
| 153 | As a user I can test MCP server connectivity from the UI | NEW |

---

## 17. Analytics & Observability

| # | Story | Source |
|---|-------|--------|
| 154 | As an admin I can view total token usage over time | NEW |
| 155 | As an admin I can view cost breakdown by model, user, and group | NEW |
| 156 | As an admin I can set budget alerts per group | NEW |
| 157 | As a user I can see my personal usage dashboard | NEW |
| 158 | As an admin I can export usage data as CSV | NEW |
| 159 | As an admin I can view a trace of every agent run (LLM calls, tool calls, latency) | NEW |
| 160 | As an admin I can integrate with external observability tools (LangFuse, Helicone) | NEW |

---

## 18. Notifications

| # | Story | Source |
|---|-------|--------|
| 161 | As a user I receive in-app notifications when someone shares a conversation with me | NEW |
| 162 | As a user I receive email notifications for @mentions | NEW |
| 163 | As a user I can set notification preferences | NEW |
| 164 | As a user I can receive a webhook / Slack ping when an async agent run completes | NEW |

---

## 19. Internationalisation & Accessibility

| # | Story | Source |
|---|-------|--------|
| 165 | UI ships with English first; i18n-ready (i18next) | NEW |
| 166 | UI is screen-reader accessible (WCAG 2.1 AA) | NEW |
| 167 | Light and dark mode | NEW |
| 168 | Adjustable font size | NEW |

---

## 20. Security & Compliance

| # | Story | Source |
|---|-------|--------|
| 169 | As an admin I can enable content filtering / moderation on inputs and outputs | NEW |
| 170 | As an admin I can configure DLP rules (block PII, credit card numbers, etc.) | NEW |
| 171 | As an admin I can view a full audit log of all user actions | NEW |
| 172 | As an admin I can rotate API keys | NEW |
| 173 | SSRF protection on all URL scraping and webhook calls | NEW |
| 174 | Prompt injection mitigations for user-supplied content | NEW |
| 175 | Sandbox enforces resource limits (CPU, memory, network, disk) | NEW |
| 176 | All data at rest is encrypted (pgcrypto / storage encryption) | NEW |
| 177 | All data in transit uses TLS 1.3+ | NEW |
| 178 | Rate limiting per user, per IP, and per group | NEW |

---

## 21. Prompt Library & Templates (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 179 | As a user I can save a prompt as a reusable template with variables so that I can re-use effective prompts | GAP |
| 180 | As a user I can browse and use prompt templates shared by my team so that I benefit from collective prompt engineering | GAP |
| 181 | As an admin I can curate a library of approved prompt templates for the org so that quality is maintained | GAP |
| 182 | As a user I can create conversation starters (pre-filled system prompt + first message) so that common tasks begin faster | GAP |
| 183 | As a user I can fork a template to customize it while preserving the original so that I can iterate safely | GAP |
| 184 | As a user I can version my prompt templates so that I can track changes over time | GAP |
| 185 | As a user I can tag and categorize prompt templates for easy discovery | GAP |
| 186 | As a user I can rate and comment on shared prompt templates so that the best ones surface | GAP |

---

## 22. Keyboard Shortcuts & Power User Features (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 187 | As a user I can use keyboard shortcuts for common actions (new chat, search, send message) so that I work faster | GAP |
| 188 | As a user I can open a command palette (Cmd+K) to search conversations, agents, commands, and settings so that I can navigate quickly | GAP |
| 189 | As a user I can customize keyboard shortcuts so that the UI fits my workflow | GAP |
| 190 | As a user I can use slash commands in the message input (/model, /agent, /clear) so that I can change context without leaving the keyboard | GAP |

---

## 23. Data Import/Export & GDPR (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 191 | As a user I can import conversation history from ChatGPT (exported JSON) so that I can migrate to NOVA | GAP |
| 192 | As a user I can import conversation history from Claude.ai so that I can migrate to NOVA | GAP |
| 193 | As a user I can export ALL my data (conversations, files, agents, settings) as a single archive so that I can back up or leave the platform | GAP |
| 194 | As an admin I can process a GDPR data deletion request that removes all of a user's personal data while preserving anonymized audit logs | GAP |
| 195 | As an admin I can generate a GDPR data export for a user containing all their personal data | GAP |

---

## 24. Error Handling & Rate Limiting UX (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 196 | As a user I see a clear, friendly error message when the model fails (with a retry button) so that I am not confused | GAP |
| 197 | As a user I am informed when I approach my rate limit or spending quota with a warning before being blocked | GAP |
| 198 | As a user I see an estimated wait time when rate-limited so that I know when I can try again | GAP |
| 199 | As a user I can see a system status banner when services are degraded so that I understand why responses are slow | GAP |
| 200 | As a user failed messages are automatically retried with a different model (if fallback is configured) so that I am not interrupted | GAP |
| 201 | As a user I can see connection status (connected/reconnecting/offline) for WebSocket and SSE so that I know if real-time features are working | GAP |
| 202 | As a user my in-progress messages are preserved if I lose connection and auto-sent when reconnected so that I do not lose work | GAP |

---

## 25. Admin Onboarding & Health (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 203 | As a new admin I am guided through a setup wizard on first login (org name, model provider, first user) so that initial configuration is easy | GAP |
| 204 | As an admin I can view a system health dashboard showing database, Redis, MinIO, LiteLLM, and Temporal status so that I can diagnose issues | GAP |
| 205 | As an admin I can run a diagnostic check that tests all external service connections and reports results | GAP |
| 206 | As an admin I can see when the system was last updated and what version is running | GAP |

---

## 26. Theming & White-labeling (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 207 | As an org admin I can set a custom logo, primary color, and favicon for my org so that the platform matches my brand | GAP |
| 208 | As an org admin I can customize the login page with branding so that users see a familiar experience | GAP |
| 209 | As a user I can switch between light, dark, and system-preference themes | GAP |
| 210 | As an org admin I can inject custom CSS for advanced theming so that detailed customization is possible | GAP |

---

## 27. Search (GAP -- EXPANDED)

| # | Story | Source |
|---|-------|--------|
| 211 | As a user I can perform semantic search across all my conversations (not just keyword matching) so that I find relevant discussions even with different wording | GAP |
| 212 | As a user I can search across conversations, files, agents, and knowledge collections from a single search bar | GAP |
| 213 | As a user I can filter search results by date range, model used, workspace, and conversation participants | GAP |
| 214 | As a user search results show relevant context snippets with highlighted matches so that I can quickly find what I need | GAP |

---

## 28. Integrations (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 215 | As an admin I can connect a Slack workspace so that users can interact with NOVA agents from Slack | GAP |
| 216 | As an admin I can connect Microsoft Teams so that users can interact with NOVA agents from Teams | GAP |
| 217 | As a user I can forward an email to a NOVA agent for processing so that I can use AI for email tasks | GAP |
| 218 | As a user I can connect Google Drive / OneDrive as a knowledge source so that documents sync automatically | GAP |
| 219 | As a developer the API is OpenAI-compatible (chat completions endpoint) so that existing tools and clients work with NOVA | GAP |

---

## 29. User Onboarding (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 220 | As a new user I see an interactive tutorial on first login that shows me how to start a conversation, use agents, and upload files | GAP |
| 221 | As a new user I can explore sample conversations to understand the platform's capabilities | GAP |
| 222 | As a new user I see contextual tooltips on UI elements I have not used yet | GAP |
| 223 | As a user I can access a help center / documentation from within the app | GAP |

---

## 30. Conversation Organization (GAP -- EXPANDED)

| # | Story | Source |
|---|-------|--------|
| 224 | As a user I can organize conversations into folders/tags so that I can manage large history | GAP |
| 225 | As a user I can bulk-select conversations for archiving, deleting, or moving to a folder | GAP |
| 226 | As a user I can filter my conversation list by model, date range, or workspace | GAP |

---

## 31. Voice & Multimodal Input (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 227 | As a user I can use voice input (speech-to-text) in the web UI to compose messages | GAP |
| 228 | As a user I can have a voice conversation with an agent (STT input, TTS output) | GAP |
| 229 | As a user I can send an audio recording as a message and have it transcribed | GAP |

---

## 32. Model Playground (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 230 | As a developer I can use a model playground to test prompts against different models with adjustable parameters and see raw API responses | GAP |

---

## 33. Versioning & History (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 231 | As a user I can view the edit history of a message I modified | GAP |
| 232 | As a user I can view version history of a knowledge collection | GAP |

---

## 34. Batch / Bulk Operations (GAP -- NEW CATEGORY)

| # | Story | Source |
|---|-------|--------|
| 233 | As a developer I can submit a batch of prompts via the API and receive results asynchronously | GAP |
| 234 | As an admin I can bulk-manage agents (enable, disable, reassign ownership) | GAP |

---

## Summary

| Category | Original | New/Gap | Total |
|----------|----------|---------|-------|
| Authentication & Identity | 2 | 8 | 10 |
| Tenancy & Organisations | 0 | 6 | 6 |
| Users & Groups | 2 | 10 | 12 |
| Conversations | 6 | 18 | 24 |
| Multi-turn & Agentic | 1 | 6 | 7 |
| Files & Documents | 3 | 8 | 11 |
| URL / Web References | 1 | 5 | 6 |
| Deep Research | 1 | 5 | 6 |
| Models & Providers | 0 | 8 | 8 |
| Agents | 7 | 11 | 18 |
| Memory | 1 | 4 | 5 |
| Knowledge Collections | 2 | 6 | 8 |
| Workspaces / Projects | 3 | 5 | 8 |
| Artifacts & Rich Display | 3 | 11 | 14 |
| Tools & Function Calling | 1 | 4 | 5 |
| MCP Servers | 1 | 4 | 5 |
| Analytics & Observability | 0 | 7 | 7 |
| Notifications | 0 | 4 | 4 |
| Internationalisation & Accessibility | 0 | 4 | 4 |
| Security & Compliance | 0 | 10 | 10 |
| Prompt Library & Templates | 0 | 8 | 8 |
| Keyboard Shortcuts & Power User | 0 | 4 | 4 |
| Data Import/Export & GDPR | 0 | 5 | 5 |
| Error Handling & Rate Limiting UX | 0 | 7 | 7 |
| Admin Onboarding & Health | 0 | 4 | 4 |
| Theming & White-labeling | 0 | 4 | 4 |
| Search (Expanded) | 0 | 4 | 4 |
| Integrations | 0 | 5 | 5 |
| User Onboarding | 0 | 4 | 4 |
| Conversation Organization | 0 | 3 | 3 |
| Voice & Multimodal | 0 | 3 | 3 |
| Model Playground | 0 | 1 | 1 |
| Versioning & History | 0 | 2 | 2 |
| Batch / Bulk Operations | 0 | 2 | 2 |
| **TOTAL** | **34** | **200** | **234** |
