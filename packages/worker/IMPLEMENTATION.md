# packages/worker -- Implementation Guide

> Runtime: **Node.js 20 LTS**
> Framework: **Temporal Worker SDK**
> No exposed port (connects outbound to Temporal server on 7233)

---

## Why Node.js (Not Bun)

The Temporal Worker SDK (`@temporalio/worker`) has hard dependencies on Node.js-specific APIs:

- **`worker_threads`** -- Temporal runs each workflow in an isolated V8 context via worker threads
- **`vm` module** -- Workflow code is loaded into sandboxed V8 contexts for deterministic replay
- **Node-API (N-API)** -- Native Rust bridge (`@temporalio/core-bridge`) compiled for Node.js

These cannot be polyfilled. The worker MUST run on Node.js. This is a Temporal architectural requirement, not a NOVA design choice.

The API server (`packages/api`) uses only `@temporalio/client` which makes gRPC calls and is compatible with Bun.

---

## Directory Structure

```
packages/worker/
├── src/
│   ├── index.ts                  # Worker bootstrap (connects to Temporal, registers workflows/activities)
│   ├── workflows/
│   │   ├── agent-conversation.ts # Multi-turn agent loop with human-in-the-loop
│   │   ├── deep-research.ts      # Multi-step research with progress reporting
│   │   ├── rag-ingestion.ts      # File chunking, embedding, vector indexing
│   │   ├── file-processing.ts    # Upload processing (virus scan, text extraction, thumbnail)
│   │   ├── data-export.ts        # GDPR data export, conversation export
│   │   └── scheduled-agent.ts    # Cron-triggered agent runs
│   ├── activities/
│   │   ├── llm.ts                # LLM calls via LiteLLM (chat completion, embedding)
│   │   ├── file-ops.ts           # MinIO operations (read, write, delete, list)
│   │   ├── db.ts                 # Database operations (read/write via Drizzle)
│   │   ├── sandbox.ts            # Code execution in nsjail/gVisor/Firecracker
│   │   ├── scraper.ts            # URL scraping with SSRF protection
│   │   ├── embedding.ts          # Text chunking + embedding generation
│   │   ├── notification.ts       # Send in-app notifications, email, webhook
│   │   └── mcp.ts                # MCP server tool invocations
│   ├── clients/
│   │   ├── db.ts                 # Drizzle client (same schema as API, separate connection)
│   │   ├── redis.ts              # ioredis client (pub/sub for streaming progress to API)
│   │   ├── minio.ts              # MinIO client
│   │   └── litellm.ts            # HTTP client for LiteLLM API
│   └── utils/
│       ├── chunker.ts            # Text chunking strategies (fixed-size, sentence, recursive)
│       └── ssrf.ts               # URL validation (block private IPs, DNS rebinding)
├── Dockerfile                    # Node.js 20 Alpine, NOT Bun
├── package.json
└── tsconfig.json
```

---

## Temporal Worker Setup

```typescript
// src/index.ts
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });

  const worker = await Worker.create({
    connection,
    namespace: "default",
    taskQueue: "nova-workers",
    workflowsPath: require.resolve("./workflows"),
    activities,
    maxConcurrentWorkflowTaskExecutions: 100,
    maxConcurrentActivityTaskExecutions: 50,
  });

  console.log("Temporal worker started on task queue: nova-workers");
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
```

Key configuration:
- `taskQueue: "nova-workers"` -- must match what the API server uses when starting workflows
- `workflowsPath` -- Temporal bundles and sandboxes workflow code automatically
- `activities` -- imported as a module, Temporal wraps them with retry/timeout logic

---

## Workflows

### 1. `agentConversationWorkflow`

The core agent loop. Handles multi-turn conversations with tool calling and human-in-the-loop approval.

```typescript
// src/workflows/agent-conversation.ts
import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  sleep,
} from "@temporalio/workflow";
import type * as activities from "../activities";

const { callLLM, executeToolCall, saveTurn, publishProgress } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "2m",
  retry: { maximumAttempts: 3 },
});

// Signals (API server sends these)
export const approveToolCall = defineSignal<[{ toolCallId: string; approved: boolean }]>(
  "approveToolCall"
);
export const stopAgent = defineSignal("stopAgent");
export const userMessage = defineSignal<[{ content: string }]>("userMessage");

// Queries (API server reads these)
export const getProgress = defineQuery<AgentProgress>("getProgress");

interface AgentProgress {
  status: "running" | "waiting_approval" | "waiting_input" | "completed" | "stopped" | "error";
  steps: AgentStep[];
  currentStep: number;
  totalTokens: number;
}

export async function agentConversationWorkflow(input: AgentInput): Promise<AgentResult> {
  let stopped = false;
  let pendingApproval: { toolCallId: string; resolve: (approved: boolean) => void } | null = null;
  let pendingUserInput: { resolve: (content: string) => void } | null = null;
  const progress: AgentProgress = {
    status: "running",
    steps: [],
    currentStep: 0,
    totalTokens: 0,
  };

  // Signal handlers
  setHandler(stopAgent, () => { stopped = true; });
  setHandler(getProgress, () => progress);
  setHandler(approveToolCall, ({ toolCallId, approved }) => {
    if (pendingApproval?.toolCallId === toolCallId) {
      pendingApproval.resolve(approved);
    }
  });
  setHandler(userMessage, ({ content }) => {
    if (pendingUserInput) {
      pendingUserInput.resolve(content);
    }
  });

  const messages = [...input.messages];
  let stepCount = 0;
  const maxSteps = input.maxSteps ?? 25;

  while (!stopped && stepCount < maxSteps) {
    stepCount++;

    // 1. Call LLM
    const response = await callLLM({
      model: input.model,
      messages,
      tools: input.tools,
      orgId: input.orgId,
    });

    progress.totalTokens += response.usage.totalTokens;

    // 2. If LLM wants to call tools
    if (response.toolCalls?.length) {
      for (const toolCall of response.toolCalls) {
        // Human-in-the-loop: wait for approval if configured
        if (input.toolApprovalMode === "always-ask") {
          progress.status = "waiting_approval";
          await publishProgress(input.conversationId, progress);

          const approved = await new Promise<boolean>((resolve) => {
            pendingApproval = { toolCallId: toolCall.id, resolve };
          });
          pendingApproval = null;

          if (!approved) {
            messages.push({ role: "tool", content: "Tool call rejected by user", toolCallId: toolCall.id });
            continue;
          }
        }

        progress.status = "running";
        const result = await executeToolCall(toolCall, input.orgId);
        messages.push({ role: "tool", content: JSON.stringify(result), toolCallId: toolCall.id });

        progress.steps.push({
          type: "tool_call",
          name: toolCall.name,
          input: toolCall.arguments,
          output: result,
        });
      }
      continue; // Loop back to LLM with tool results
    }

    // 3. If LLM produced a final response
    messages.push({ role: "assistant", content: response.content });
    await saveTurn(input.conversationId, input.orgId, messages);
    progress.steps.push({ type: "response", content: response.content });

    // 4. Check if agent wants more user input
    if (response.requiresInput) {
      progress.status = "waiting_input";
      await publishProgress(input.conversationId, progress);

      const userContent = await new Promise<string>((resolve) => {
        pendingUserInput = { resolve };
      });
      pendingUserInput = null;
      messages.push({ role: "user", content: userContent });
      continue;
    }

    break; // Agent completed
  }

  progress.status = stopped ? "stopped" : "completed";
  await publishProgress(input.conversationId, progress);
  return { messages, progress };
}
```

### 2. `deepResearchWorkflow`

Multi-step research that searches the web, reads sources, synthesises findings, and produces a structured report.

```typescript
// src/workflows/deep-research.ts
export async function deepResearchWorkflow(input: ResearchInput): Promise<ResearchReport> {
  const progress: ResearchProgress = { status: "planning", sources: [], currentPhase: "" };
  setHandler(getResearchProgress, () => progress);

  // Phase 1: Generate research plan (sub-queries)
  progress.currentPhase = "Generating research plan";
  const plan = await generateResearchPlan(input.query, input.model);

  // Phase 2: Execute sub-queries (parallel)
  progress.currentPhase = "Searching sources";
  const searchResults = await Promise.all(
    plan.subQueries.map((q) => searchWeb(q, input.maxSources ?? 10))
  );

  // Phase 3: Scrape and extract content from top sources
  progress.currentPhase = "Reading sources";
  for (const result of searchResults.flat()) {
    const content = await scrapeUrl(result.url);
    progress.sources.push({ url: result.url, title: result.title, status: "read" });
    await publishResearchProgress(input.conversationId, progress);
  }

  // Phase 4: Synthesise into structured report
  progress.currentPhase = "Synthesising report";
  const report = await synthesiseReport(input.query, progress.sources, input.model);

  progress.status = "completed";
  return report;
}
```

### 3. `ragIngestionWorkflow`

Processes files for a knowledge collection: chunk text, generate embeddings, index in pgvector.

```typescript
// src/workflows/rag-ingestion.ts
export async function ragIngestionWorkflow(input: IngestionInput): Promise<IngestionResult> {
  // 1. Read file from MinIO
  const fileContent = await readFileFromMinio(input.fileKey);

  // 2. Extract text (PDF, DOCX, etc.)
  const text = await extractText(fileContent, input.mimeType);

  // 3. Chunk text (strategy configurable per collection)
  const chunks = await chunkText(text, {
    strategy: input.chunkingStrategy ?? "recursive",
    chunkSize: input.chunkSize ?? 512,
    chunkOverlap: input.chunkOverlap ?? 50,
  });

  // 4. Generate embeddings (batch, via LiteLLM embeddings endpoint)
  const embeddings = await generateEmbeddings(chunks, input.embeddingModel);

  // 5. Upsert into knowledge_chunks table with pgvector
  await upsertChunks({
    collectionId: input.collectionId,
    orgId: input.orgId,
    fileId: input.fileId,
    chunks: chunks.map((text, i) => ({
      content: text,
      embedding: embeddings[i],
      metadata: { source: input.filename, chunkIndex: i },
    })),
  });

  return { chunksProcessed: chunks.length };
}
```

### 4. `fileProcessingWorkflow`

Processes uploaded files: virus scan, text extraction, thumbnail generation.

```typescript
// src/workflows/file-processing.ts
export async function fileProcessingWorkflow(input: FileInput): Promise<FileResult> {
  // 1. Download from MinIO to temp
  const localPath = await downloadFile(input.fileKey);

  // 2. Virus scan (ClamAV or similar)
  const scanResult = await virusScan(localPath);
  if (scanResult.infected) {
    await markFileInfected(input.fileId, input.orgId);
    await deleteFileFromMinio(input.fileKey);
    return { status: "infected", virus: scanResult.virus };
  }

  // 3. Extract text content (for search indexing)
  const text = await extractText(localPath, input.mimeType);
  await updateFileTextContent(input.fileId, input.orgId, text);

  // 4. Generate thumbnail (images, PDFs, videos)
  if (isPreviewable(input.mimeType)) {
    const thumbnailKey = await generateThumbnail(localPath, input.fileKey);
    await updateFileThumbnail(input.fileId, input.orgId, thumbnailKey);
  }

  return { status: "processed" };
}
```

### 5. `dataExportWorkflow`

GDPR-compliant data export. Collects all user data and bundles into a downloadable archive.

```typescript
// src/workflows/data-export.ts
export async function dataExportWorkflow(input: ExportInput): Promise<ExportResult> {
  // 1. Collect all user data across tables
  const conversations = await exportUserConversations(input.userId, input.orgId);
  const files = await exportUserFiles(input.userId, input.orgId);
  const agents = await exportUserAgents(input.userId, input.orgId);
  const profile = await exportUserProfile(input.userId, input.orgId);
  const memories = await exportUserMemories(input.userId, input.orgId);

  // 2. Bundle into ZIP archive
  const archiveKey = await createExportArchive(input.userId, {
    conversations,
    files,
    agents,
    profile,
    memories,
  });

  // 3. Notify user (in-app + email)
  await notifyExportReady(input.userId, input.orgId, archiveKey);

  return { archiveKey, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
}
```

### 6. `scheduledAgentWorkflow`

Cron-triggered agent run. Configured per-agent with a schedule expression.

```typescript
// src/workflows/scheduled-agent.ts
export async function scheduledAgentWorkflow(input: ScheduledAgentInput): Promise<void> {
  // This workflow is started by Temporal's cron schedule feature
  // input.cronSchedule is set when the schedule is created via the API

  // 1. Load agent configuration
  const agent = await loadAgent(input.agentId, input.orgId);

  // 2. Execute agent with configured prompt
  const result = await agentConversationWorkflow({
    conversationId: input.conversationId,
    orgId: input.orgId,
    userId: input.userId,
    model: agent.model,
    messages: [{ role: "user", content: agent.scheduledPrompt }],
    tools: agent.tools,
    toolApprovalMode: "auto", // scheduled runs don't have a human to approve
    maxSteps: agent.maxSteps ?? 10,
  });

  // 3. Notify owner of results
  await notifyScheduledRunComplete(input.userId, input.orgId, result);
}
```

---

## Activities

Activities are the non-deterministic operations (I/O, API calls, DB queries). They run in the Node.js main thread, not in the Temporal sandbox.

### LLM Activity

```typescript
// src/activities/llm.ts
import { litellmClient } from "../clients/litellm";

export async function callLLM(input: {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  orgId: string;
}): Promise<LLMResponse> {
  const response = await litellmClient.post("/chat/completions", {
    model: input.model,
    messages: input.messages,
    tools: input.tools,
    stream: false, // Activities don't stream; streaming is done via SSE in the API layer
    metadata: { org_id: input.orgId }, // LiteLLM tracks per-org spend
  });

  return {
    content: response.choices[0].message.content,
    toolCalls: response.choices[0].message.tool_calls,
    usage: response.usage,
    requiresInput: false,
  };
}

export async function generateEmbeddings(
  texts: string[],
  model: string = "text-embedding-3-small"
): Promise<number[][]> {
  // Batch in groups of 100 (LiteLLM/OpenAI limit)
  const batches = chunk(texts, 100);
  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    const response = await litellmClient.post("/embeddings", {
      model,
      input: batch,
    });
    allEmbeddings.push(...response.data.map((d: any) => d.embedding));
  }

  return allEmbeddings;
}
```

### Sandbox Activity

```typescript
// src/activities/sandbox.ts
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function executeSandboxCode(input: {
  code: string;
  language: "python" | "javascript" | "bash";
  timeoutMs?: number;
  memoryMB?: number;
}): Promise<SandboxResult> {
  // Phase 1-3: nsjail
  // Phase 4+: Firecracker (selected via SANDBOX_BACKEND env var)
  const backend = process.env.SANDBOX_BACKEND ?? "nsjail";

  if (backend === "nsjail") {
    return executeNsjail(input);
  }
  // Future: FirecrackerBackend, GVisorBackend
  throw new Error(`Unknown sandbox backend: ${backend}`);
}

async function executeNsjail(input: SandboxInput): Promise<SandboxResult> {
  const timeout = input.timeoutMs ?? 30_000;
  const memory = input.memoryMB ?? 256;

  // Write code to temp file
  const tmpFile = `/tmp/${crypto.randomUUID()}.${extensionFor(input.language)}`;
  await writeFile(tmpFile, input.code);

  try {
    const { stdout, stderr } = await execFileAsync("nsjail", [
      "--mode", "once",
      "--time_limit", String(timeout / 1000),
      "--rlimit_as", String(memory),
      "--disable_clone_newnet",  // no network
      "--chroot", "/sandbox/rootfs",
      "--", interpreterFor(input.language), tmpFile,
    ], { timeout: timeout + 5000 });

    return { stdout, stderr, exitCode: 0, executionMs: 0, artifacts: [] };
  } catch (err: any) {
    return { stdout: "", stderr: err.stderr ?? err.message, exitCode: err.code ?? 1, executionMs: 0, artifacts: [] };
  }
}
```

### Progress Publishing (Redis)

Activities publish progress to Redis so the API server can stream it to clients via SSE/WebSocket.

```typescript
// src/activities/notification.ts
import { redisPub } from "../clients/redis";

export async function publishProgress(conversationId: string, progress: any): Promise<void> {
  await redisPub.publish(
    `conversation:${conversationId}:progress`,
    JSON.stringify(progress)
  );
}

export async function publishResearchProgress(conversationId: string, progress: any): Promise<void> {
  await redisPub.publish(
    `research:${conversationId}:progress`,
    JSON.stringify(progress)
  );
}
```

---

## Signal Handling (Human-in-the-Loop)

The flow for tool approval:

1. Workflow reaches a tool call that requires approval
2. Workflow sets `progress.status = "waiting_approval"` and publishes via Redis
3. API server receives the Redis message, forwards to client via WebSocket/SSE
4. Client displays approval UI
5. User clicks approve/reject
6. Client calls `POST /api/workflows/:id/approve-tool`
7. API server sends Temporal signal: `handle.signal("approveToolCall", { toolCallId, approved })`
8. Workflow resumes, executes or skips the tool call

---

## Dockerfile

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/worker/package.json packages/worker/
COPY packages/shared/package.json packages/shared/
RUN npm ci --production

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared packages/shared
COPY packages/worker packages/worker
COPY tsconfig.json .
RUN npx tsc --project packages/worker/tsconfig.json

FROM base AS runtime
COPY --from=build /app/packages/worker/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

Note: No `EXPOSE` -- the worker connects outbound to Temporal server, it does not listen on any port.

---

## Key Dependencies

```json
{
  "dependencies": {
    "@temporalio/worker": "^1.11.0",
    "@temporalio/workflow": "^1.11.0",
    "@temporalio/activity": "^1.11.0",
    "drizzle-orm": "1.0.0-beta.x",
    "postgres": "^3.4.0",
    "ioredis": "^5.4.0",
    "minio": "^8.0.0",
    "zod": "^3.23.0",
    "@nova/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.5.0"
  }
}
```

---

## Environment Variables

Required:
- `TEMPORAL_ADDRESS` -- Temporal server address (e.g. `temporal:7233`)
- `DATABASE_URL` -- PostgreSQL connection string (same DB as API)
- `REDIS_URL` -- Redis connection string
- `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET`
- `LITELLM_API_URL`, `LITELLM_MASTER_KEY`

Optional:
- `SANDBOX_BACKEND` -- `nsjail` (default), `gvisor`, `firecracker`
- `TEMPORAL_NAMESPACE` -- Temporal namespace (default: `default`)
- `TASK_QUEUE` -- Temporal task queue (default: `nova-workers`)
- `MAX_CONCURRENT_WORKFLOWS` -- (default: 100)
- `MAX_CONCURRENT_ACTIVITIES` -- (default: 50)

---

## Testing

Temporal provides `@temporalio/testing` for workflow unit tests with a time-skipping test server:

```typescript
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { agentConversationWorkflow } from "./workflows/agent-conversation";

describe("agentConversationWorkflow", () => {
  let env: TestWorkflowEnvironment;

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await env.teardown();
  });

  it("completes a simple conversation", async () => {
    // Register mock activities
    const worker = await env.createWorker({
      taskQueue: "test",
      workflowsPath: require.resolve("./workflows/agent-conversation"),
      activities: {
        callLLM: async () => ({ content: "Hello!", toolCalls: [], usage: { totalTokens: 10 } }),
        saveTurn: async () => {},
        publishProgress: async () => {},
      },
    });

    const result = await worker.runUntil(
      env.client.workflow.execute(agentConversationWorkflow, {
        taskQueue: "test",
        args: [{ /* input */ }],
      })
    );

    expect(result.progress.status).toBe("completed");
  });
});
```
