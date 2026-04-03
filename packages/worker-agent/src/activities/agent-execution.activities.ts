import { eq, and, isNull } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { openai } from "@nova/worker-shared/litellm";
import { getDefaultChatModel, buildChatParams } from "@nova/worker-shared/models";
import { agents, agentMemoryEntries, conversations, messages } from "@nova/shared/schemas";
import { logger } from "@nova/worker-shared/logger";

export async function getAgentConfig(orgId: string, agentId: string) {
  const [agent] = await db.select().from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId), isNull(agents.deletedAt)));
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  return agent;
}

export async function loadAgentMemory(agentId: string, scope: string, userId?: string) {
  const conditions = [
    eq(agentMemoryEntries.agentId, agentId),
    eq(agentMemoryEntries.scope, scope),
    isNull(agentMemoryEntries.deletedAt),
  ];
  if (userId) conditions.push(eq(agentMemoryEntries.userId, userId));

  const entries = await db.select().from(agentMemoryEntries)
    .where(and(...conditions));

  return entries.reduce((acc, e) => {
    acc[e.key] = e.value;
    return acc;
  }, {} as Record<string, unknown>);
}

export async function saveAgentMemory(
  agentId: string,
  orgId: string,
  scope: string,
  entries: Record<string, unknown>,
  userId?: string,
) {
  for (const [key, value] of Object.entries(entries)) {
    await db.insert(agentMemoryEntries)
      .values({ agentId, orgId, userId, scope, key, value })
      .onConflictDoUpdate({
        target: [agentMemoryEntries.agentId, agentMemoryEntries.scope, agentMemoryEntries.key],
        set: { value, updatedAt: new Date() },
      });
  }
}

export async function executeAgentStep(
  agentConfig: {
    systemPrompt: string | null;
    modelId: string | null;
    modelParams: unknown;
  },
  messageHistory: { role: string; content: string }[],
  tools: { name: string; description: string; parameters: unknown }[],
  stepNumber: number,
) {
  const model = agentConfig.modelId ?? await getDefaultChatModel();

  const msgs = [
    ...(agentConfig.systemPrompt
      ? [{ role: "system", content: agentConfig.systemPrompt }]
      : []),
    ...messageHistory,
  ];

  const rawParams: Record<string, unknown> = {
    model,
    messages: msgs,
    temperature: (agentConfig.modelParams as any)?.temperature ?? 0.7,
    max_tokens: (agentConfig.modelParams as any)?.maxTokens ?? 16384,
  };

  if (tools.length > 0) {
    rawParams.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const params = await buildChatParams(model, rawParams);
  const data = await openai.chat.completions.create(params as any);
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? "",
    toolCalls: (choice?.message?.tool_calls ?? []) as any[],
    finishReason: choice?.finish_reason ?? "stop",
    usage: data.usage as { prompt_tokens?: number; completion_tokens?: number } ?? {},
  };
}

export async function saveAgentMessage(
  orgId: string,
  conversationId: string,
  content: string,
  agentId: string,
  modelId: string | null,
  tokenCountPrompt?: number,
  tokenCountCompletion?: number,
) {
  const [msg] = await db.insert(messages).values({
    orgId,
    conversationId,
    senderType: "assistant",
    agentId,
    content,
    modelId,
    tokenCountPrompt,
    tokenCountCompletion,
  }).returning();
  return msg;
}

export interface StructuredToolResult {
  tool_call_id: string;
  success: boolean;
  data: unknown;
  summary: string;
  truncated: boolean;
  error?: string;
}

function summarizeToolResult(toolName: string, data: unknown, truncated: boolean): string {
  try {
    switch (toolName) {
      case "web_search": {
        if (Array.isArray(data)) return `Found ${data.length} search result${data.length === 1 ? "" : "s"}`;
        if (typeof data === "object" && data !== null && "relatedTopics" in data) {
          const topics = (data as any).relatedTopics;
          return `Found ${Array.isArray(topics) ? topics.length : 0} related topics`;
        }
        return "Search completed";
      }
      case "fetch_url": {
        const str = typeof data === "string" ? data : JSON.stringify(data);
        return `Fetched ${str.length.toLocaleString()} chars${truncated ? " (truncated)" : ""}`;
      }
      case "invoke_agent": {
        if (typeof data === "object" && data !== null && "agent_name" in data) {
          return `Delegated to ${(data as any).agent_name}`;
        }
        return "Agent invocation completed";
      }
      case "code_execute":
        return "Code execution result";
      case "read_file": {
        if (typeof data === "object" && data !== null && "filename" in data) {
          const d = data as any;
          return `Read file: ${d.filename} (${d.characterCount?.toLocaleString() ?? "?"} chars)`;
        }
        return "File read result";
      }
      default: {
        if (data === null || data === undefined) return "No result";
        const str = typeof data === "string" ? data : JSON.stringify(data);
        if (str.length > 200) return `Result: ${str.slice(0, 200)}...`;
        return `Result: ${str}`;
      }
    }
  } catch {
    return "Done";
  }
}

const MAX_TOOL_RESULT_CHARS = 4000;

function truncateData(data: unknown): { data: unknown; truncated: boolean } {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  if (str.length <= MAX_TOOL_RESULT_CHARS) return { data, truncated: false };

  if (typeof data === "string") {
    return { data: data.slice(0, MAX_TOOL_RESULT_CHARS), truncated: true };
  }
  // For objects, serialize and truncate the string representation
  return { data: str.slice(0, MAX_TOOL_RESULT_CHARS), truncated: true };
}

export async function executeToolCall(
  orgId: string,
  agentId: string,
  toolCallId: string,
  toolName: string,
  toolArguments: string,
  knowledgeCollectionIds?: string[],
): Promise<StructuredToolResult> {
  try {
    const args = JSON.parse(toolArguments);

    let rawResult: unknown;

    // Built-in tools
    switch (toolName) {
      case "web_search": {
        const query = args.query ?? args.q ?? "";
        const searxngUrl = process.env.SEARXNG_URL;

        // Use SearxNG (self-hosted) if available, fall back to DuckDuckGo
        // Search both general and news categories for broader coverage
        if (searxngUrl) {
          try {
            const resp = await fetch(
              `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general,news&language=en`,
              { signal: AbortSignal.timeout(10_000) },
            );
            if (resp.ok) {
              const data = await resp.json() as { results: { url: string; title: string; content: string }[] };
              // Deduplicate by URL
              const seen = new Set<string>();
              const deduped = (data.results ?? []).filter((r) => {
                try {
                  const key = new URL(r.url).hostname + new URL(r.url).pathname;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                } catch { return true; }
              });
              const searxResults = deduped.slice(0, 5).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: (r.content ?? "").slice(0, 300),
              }));
              if (searxResults.length > 0) {
                rawResult = searxResults;
                break;
              }
              // SearxNG returned 0 results — fall through to DuckDuckGo
            }
          } catch {
            // Fall through to DuckDuckGo
          }
        }

        // Fallback: DuckDuckGo instant answer API (compact result)
        const resp = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
          { signal: AbortSignal.timeout(10_000) },
        );
        const data = await resp.json() as Record<string, unknown>;
        rawResult = {
          abstract: (data.Abstract as string ?? "").slice(0, 500),
          abstractSource: data.AbstractSource,
          abstractURL: data.AbstractURL,
          relatedTopics: ((data.RelatedTopics as any[]) ?? []).slice(0, 5).map((t: any) => ({
            text: (t.Text ?? "").slice(0, 200),
            url: t.FirstURL,
          })),
        };
        break;
      }
      case "fetch_url": {
        const url = args.url ?? "";
        const resp = await fetch(url, {
          headers: { "User-Agent": "NOVA-Agent/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
        const html = await resp.text();
        // Extract readable content instead of returning raw HTML
        const { extractFromHtml } = await import("@nova/shared/content");
        const extracted = extractFromHtml(html, url);
        const content = extracted.markdown || extracted.textContent || "";
        if (content && content.length >= 50) {
          rawResult = extracted.title ? `# ${extracted.title}\n\n${content}` : content;
        } else {
          rawResult = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }
        break;
      }
      case "invoke_agent": {
        const targetAgentId = args.agent_id ?? "";
        const task = args.task ?? "";
        const [targetAgent] = await db.select().from(agents)
          .where(and(eq(agents.id, targetAgentId), eq(agents.isEnabled, true), isNull(agents.deletedAt)));

        if (!targetAgent) {
          return {
            tool_call_id: toolCallId,
            success: false,
            data: null,
            summary: `Agent ${targetAgentId} not found or is disabled`,
            truncated: false,
            error: `Agent ${targetAgentId} not found or is disabled`,
          };
        }

        const targetModel = targetAgent.modelId ?? await getDefaultChatModel();
        const msgs = [
          ...(targetAgent.systemPrompt
            ? [{ role: "system" as const, content: targetAgent.systemPrompt }]
            : []),
          { role: "user" as const, content: task },
        ];

        const agentCallParams = await buildChatParams(targetModel, {
          model: targetModel,
          messages: msgs,
          temperature: (targetAgent.modelParams as any)?.temperature ?? 0.7,
          max_tokens: (targetAgent.modelParams as any)?.maxTokens ?? 16384,
        });
        const agentResult = await openai.chat.completions.create(agentCallParams as any);

        rawResult = {
          agent_name: targetAgent.name,
          response: agentResult.choices?.[0]?.message?.content ?? "",
        };
        break;
      }
      case "code_execute": {
        const sandboxEnabled = process.env.SANDBOX_ENABLED === "true" || process.env.SANDBOX_ENABLED === "1";
        if (!sandboxEnabled) {
          rawResult = "Code execution is disabled (SANDBOX_ENABLED is not set)";
          break;
        }

        // Resolve input file IDs to storage keys
        let inputFiles: { name: string; data: Buffer }[] | undefined;
        const fileIds = args.input_file_ids as string[] | undefined;
        if (fileIds && fileIds.length > 0) {
          const { files: filesTable } = await import("@nova/shared/schema");
          const { inArray } = await import("drizzle-orm");
          const fileRecords = await db
            .select()
            .from(filesTable)
            .where(inArray(filesTable.id, fileIds));

          const { getObjectBuffer } = await import("@nova/worker-shared/minio");
          inputFiles = await Promise.all(
            fileRecords.map(async (f: any) => ({
              name: f.filename ?? f.id,
              data: await getObjectBuffer(f.storagePath),
            })),
          );
        }

        const { sandboxExecute } = await import("@nova/worker-shared/sandbox");
        const result = await sandboxExecute({
          language: args.language ?? "python",
          code: args.code ?? "",
          stdin: args.stdin,
          runTimeout: Math.min((args.timeout as number) ?? 30000, 300000),
          inputFiles,
        });

        // Upload output files to RustFS
        let outputFileInfo: { name: string; sizeBytes: number; storageKey: string }[] = [];
        if (result.outputFiles.length > 0) {
          const { putObjectBuffer } = await import("@nova/worker-shared/minio");
          const { randomUUID } = await import("node:crypto");
          const execId = randomUUID();
          outputFileInfo = await Promise.all(
            result.outputFiles.map(async (f) => {
              const key = `${orgId}/sandbox/${execId}/${f.name}`;
              await putObjectBuffer(key, f.data);
              return { name: f.name, sizeBytes: f.data.length, storageKey: key };
            }),
          );
        }

        rawResult = {
          stdout: result.run.stdout.slice(0, 100_000),
          stderr: result.run.stderr.slice(0, 10_000),
          exitCode: result.run.code,
          language: result.language,
          version: result.version,
          ...(outputFileInfo.length > 0 ? { outputFiles: outputFileInfo } : {}),
        };
        break;
      }
      case "read_file": {
        const { files: filesTable } = await import("@nova/shared/schema");
        const { getObjectBuffer } = await import("@nova/worker-shared/minio");

        let fileRecord: any;

        if (args.file_id) {
          const [record] = await db
            .select()
            .from(filesTable)
            .where(and(eq(filesTable.id, args.file_id), isNull(filesTable.deletedAt)));
          fileRecord = record;
        } else if (args.filename) {
          const { ilike } = await import("drizzle-orm");
          const [record] = await db
            .select()
            .from(filesTable)
            .where(and(ilike(filesTable.filename, `%${args.filename}%`), isNull(filesTable.deletedAt)));
          fileRecord = record;
        }

        if (!fileRecord) {
          rawResult = { error: `File not found${args.file_id ? ` (id: ${args.file_id})` : ` (name: ${args.filename})`}` };
          break;
        }

        const fileBuffer = await getObjectBuffer(fileRecord.storagePath);
        const ct: string = fileRecord.contentType ?? "";
        let fileText: string | null = null;

        const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (ct === XLSX_MIME || fileRecord.filename?.endsWith(".xlsx")) {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(fileBuffer, { type: "buffer" });
          const parts: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const ws = workbook.Sheets[sheetName];
            if (!ws) continue;
            if (workbook.SheetNames.length > 1) parts.push(`## Sheet: ${sheetName}\n`);
            parts.push(XLSX.utils.sheet_to_csv(ws));
          }
          fileText = parts.join("\n\n");
        } else if (ct === "text/csv" || fileRecord.filename?.endsWith(".csv")) {
          fileText = fileBuffer.toString("utf-8");
        } else if (ct === "application/pdf") {
          try {
            const { createRequire } = await import("node:module");
            const req = createRequire(import.meta.url);
            const pdfParse = req("pdf-parse/lib/pdf-parse.js");
            const result = await pdfParse(fileBuffer);
            fileText = result.text;
          } catch { fileText = "[PDF extraction failed]"; }
        } else if (ct?.startsWith("text/") || ct === "application/json" || ct === "application/xml") {
          fileText = fileBuffer.toString("utf-8");
        } else {
          rawResult = { error: `Cannot extract content from type "${ct}"`, fileId: fileRecord.id, filename: fileRecord.filename };
          break;
        }

        if (fileText && fileText.length > 100_000) {
          fileText = fileText.slice(0, 100_000) + `\n[... truncated at 100k chars, total: ${fileText.length}]`;
        }

        const isTabular = ct === XLSX_MIME || ct === "text/csv" || fileRecord.filename?.endsWith(".csv") || fileRecord.filename?.endsWith(".xlsx");
        rawResult = {
          fileId: fileRecord.id,
          filename: fileRecord.filename,
          contentType: ct,
          content: fileText ?? "",
          characterCount: fileText?.length ?? 0,
          ...(isTabular ? { displayHint: "When presenting this data to the user, wrap it in a ```csv code fence for proper table rendering." } : {}),
        };
        break;
      }
      case "query_knowledge": {
        if (!knowledgeCollectionIds || knowledgeCollectionIds.length === 0) {
          rawResult = { results: [], message: "No knowledge collections attached to this conversation" };
          break;
        }
        const { queryKnowledgeCollections } = await import("@nova/worker-shared/research-queries");
        const query = args.query ?? "";
        const topK = Math.min(args.topK ?? 5, 10);
        const results = await queryKnowledgeCollections(orgId, knowledgeCollectionIds, query, topK);
        rawResult = results.map((r: any) => ({
          documentName: r.documentName,
          content: r.content,
          score: r.score,
          ...(r.fileId ? { fileId: r.fileId, hint: `To analyze this file's raw data, use code_execute with input_file_ids: ["${r.fileId}"]` } : {}),
          ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}),
          ...(r.timestampUrl ? { timestampUrl: r.timestampUrl } : {}),
          ...(r.chapterTitle ? { chapterTitle: r.chapterTitle } : {}),
        }));
        break;
      }
      default: {
        // Check if it's a registered tool in the database
        const { tools: toolsTable, agentTools: agentToolsTable } = await import("@nova/shared/schemas");
        const registeredTools = await db.select({ tool: toolsTable })
          .from(agentToolsTable)
          .innerJoin(toolsTable, eq(agentToolsTable.toolId, toolsTable.id))
          .where(and(
            eq(agentToolsTable.agentId, agentId),
            eq(agentToolsTable.isEnabled, true),
            isNull(agentToolsTable.deletedAt),
          ));

        const matchedTool = registeredTools.find((t) => t.tool.name === toolName);
        if (matchedTool) {
          const spec = matchedTool.tool.openapiSpec as Record<string, unknown> | null;
          const endpoint = (spec?.endpoint ?? spec?.url) as string | undefined;
          if (endpoint) {
            const resp = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            });
            rawResult = await resp.json();
          } else {
            return {
              tool_call_id: toolCallId,
              success: false,
              data: null,
              summary: `Tool ${toolName} has no endpoint configured`,
              truncated: false,
              error: `Tool ${toolName} has no endpoint configured`,
            };
          }
        } else {
          return {
            tool_call_id: toolCallId,
            success: false,
            data: null,
            summary: `Unknown tool: ${toolName}`,
            truncated: false,
            error: `Unknown tool: ${toolName}`,
          };
        }
        break;
      }
    }

    const { data, truncated } = truncateData(rawResult);
    return {
      tool_call_id: toolCallId,
      success: true,
      data,
      summary: summarizeToolResult(toolName, data, truncated),
      truncated,
    };
  } catch (err) {
    return {
      tool_call_id: toolCallId,
      success: false,
      data: null,
      summary: `Error: ${String(err).slice(0, 200)}`,
      truncated: false,
      error: String(err),
    };
  }
}

/**
 * Send completion notification when an agent run finishes (Story #164).
 * Notifies via webhook and/or creates an in-app notification.
 */
export async function notifyAgentCompletion(
  orgId: string,
  userId: string,
  agentId: string,
  conversationId: string,
  result: { steps: number; totalTokens: number; messageIds: string[] },
) {
  const { notifications, agents: agentsTable } = await import("@nova/shared/schemas");

  // Get agent name for the notification
  const [agent] = await db.select({ name: agentsTable.name }).from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.orgId, orgId)));

  const agentName = agent?.name ?? "Agent";

  // Create in-app notification
  await db.insert(notifications).values({
    orgId,
    userId,
    type: "agent_run_complete",
    title: `${agentName} completed`,
    body: `Agent run finished in ${result.steps} step(s), using ${result.totalTokens.toLocaleString()} tokens.`,
    resourceType: "conversation",
    resourceId: conversationId,
  });

  // Check for webhook URL in agent config
  const [agentConfig] = await db.select().from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.orgId, orgId)));

  const webhookUrl = (agentConfig as any)?.webhookUrl;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "agent.run.completed",
          agentId,
          agentName,
          conversationId,
          orgId,
          steps: result.steps,
          totalTokens: result.totalTokens,
          messageIds: result.messageIds,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logger.error({ err, webhookUrl }, "[agent-webhook] Failed to notify");
    }
  }
}

export async function createAgentConversation(
  orgId: string,
  userId: string,
  agentId: string,
  title: string,
) {
  const [conv] = await db.insert(conversations).values({
    orgId,
    ownerId: userId,
    title,
    modelParams: { agentId },
  }).returning();
  return conv;
}
