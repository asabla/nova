import { eq, and, isNull } from "drizzle-orm";
import { db } from "../lib/db";
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
  const litellmUrl = process.env.LITELLM_URL ?? "http://localhost:4000";
  const model = agentConfig.modelId ?? "gpt-4o";

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
    max_tokens: (agentConfig.modelParams as any)?.maxTokens ?? 4096,
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  const resp = await fetch(`${litellmUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
