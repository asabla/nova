import { eq, and, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { LITELLM_URL, litellmHeaders } from "../lib/litellm";
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

  const body: Record<string, unknown> = {
    model,
    messages: msgs,
    temperature: (agentConfig.modelParams as any)?.temperature ?? 0.7,
    max_tokens: (agentConfig.modelParams as any)?.maxTokens ?? 16384,
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const resp = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: litellmHeaders(),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`LLM API error: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? "",
    toolCalls: choice?.message?.tool_calls ?? [],
    finishReason: choice?.finish_reason ?? "stop",
    usage: data.usage ?? {},
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

export async function executeToolCall(
  orgId: string,
  agentId: string,
  toolCallId: string,
  toolName: string,
  toolArguments: string,
): Promise<{ tool_call_id: string; result: unknown; error?: string }> {
  try {
    const args = JSON.parse(toolArguments);

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
              const results = (data.results ?? []).slice(0, 5).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: (r.content ?? "").slice(0, 300),
              }));
              return { tool_call_id: toolCallId, result: results };
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
        // Extract only the useful fields to keep context small
        return {
          tool_call_id: toolCallId,
          result: {
            abstract: (data.Abstract as string ?? "").slice(0, 500),
            abstractSource: data.AbstractSource,
            abstractURL: data.AbstractURL,
            relatedTopics: ((data.RelatedTopics as any[]) ?? []).slice(0, 5).map((t: any) => ({
              text: (t.Text ?? "").slice(0, 200),
              url: t.FirstURL,
            })),
          },
        };
      }
      case "fetch_url": {
        const url = args.url ?? "";
        const resp = await fetch(url, {
          headers: { "User-Agent": "NOVA-Agent/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
        const text = await resp.text();
        // Truncate to keep context within model limits
        return { tool_call_id: toolCallId, result: text.slice(0, 4000) };
      }
      case "code_execute": {
        // Sandbox execution would be handled by the sandbox service
        return { tool_call_id: toolCallId, result: "Code execution requires sandbox service" };
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
            const result = await resp.json();
            return { tool_call_id: toolCallId, result };
          }
          return { tool_call_id: toolCallId, result: null, error: `Tool ${toolName} has no endpoint configured` };
        }

        return { tool_call_id: toolCallId, result: null, error: `Unknown tool: ${toolName}` };
      }
    }
  } catch (err) {
    return { tool_call_id: toolCallId, result: null, error: String(err) };
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
