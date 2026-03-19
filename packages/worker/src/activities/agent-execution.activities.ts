import { eq, and, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { openai } from "../lib/litellm";
import { getDefaultChatModel } from "../lib/models";
import { agents, agentMemoryEntries, conversations, messages } from "@nova/shared/schemas";

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
    const existing = await db.select().from(agentMemoryEntries)
      .where(and(
        eq(agentMemoryEntries.agentId, agentId),
        eq(agentMemoryEntries.key, key),
        eq(agentMemoryEntries.scope, scope),
        isNull(agentMemoryEntries.deletedAt),
      ));

    if (existing.length > 0) {
      await db.update(agentMemoryEntries)
        .set({ value, updatedAt: new Date() })
        .where(eq(agentMemoryEntries.id, existing[0].id));
    } else {
      await db.insert(agentMemoryEntries).values({
        agentId,
        orgId,
        userId,
        scope,
        key,
        value,
      });
    }
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

  const params: Record<string, unknown> = {
    model,
    messages: msgs,
    temperature: (agentConfig.modelParams as any)?.temperature ?? 0.7,
    max_tokens: (agentConfig.modelParams as any)?.maxTokens ?? 16384,
  };

  if (tools.length > 0) {
    params.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

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
      case "code_execute":
        return "Code execution result";
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
        if (searxngUrl) {
          try {
            const resp = await fetch(
              `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
              { signal: AbortSignal.timeout(10_000) },
            );
            if (resp.ok) {
              const data = await resp.json() as { results: { url: string; title: string; content: string }[] };
              rawResult = (data.results ?? []).slice(0, 5).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: (r.content ?? "").slice(0, 300),
              }));
              break;
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
        rawResult = await resp.text();
        break;
      }
      case "code_execute": {
        rawResult = "Code execution requires sandbox service";
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
      console.error(`[agent-webhook] Failed to notify ${webhookUrl}:`, err);
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
