import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { openai } from "@nova/worker-shared/litellm";
import { buildChatParams } from "@nova/worker-shared/models";
import { agentMemoryVectors } from "@nova/shared/schemas";
import { upsertPoints, searchVector, COLLECTIONS } from "@nova/worker-shared/qdrant";
import { getDefaultEmbeddingModel } from "@nova/worker-shared/models";

/**
 * Generate an embedding for the given text via LiteLLM /embeddings endpoint.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingModel = process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();
  const response = await openai.embeddings.create({
    model: embeddingModel,
    input: text.slice(0, 8000), // Limit input length
  });
  return response.data[0].embedding;
}

/**
 * Embed content and store it as a semantic memory vector.
 */
export async function embedAndStoreMemory(input: {
  agentId: string;
  orgId: string;
  userId?: string;
  scope: string;
  content: string;
  metadata?: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
}): Promise<{ id: string }> {
  const embedding = await generateEmbedding(input.content);

  const [row] = await db.insert(agentMemoryVectors).values({
    agentId: input.agentId,
    orgId: input.orgId,
    userId: input.userId,
    scope: input.scope,
    content: input.content,
    metadata: input.metadata,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  }).returning({ id: agentMemoryVectors.id });

  // Also upsert to Qdrant for fast vector search
  await upsertPoints(COLLECTIONS.AGENT_MEMORIES, [{
    id: row.id,
    vector: embedding,
    payload: {
      orgId: input.orgId,
      agentId: input.agentId,
      userId: input.userId ?? null,
      scope: input.scope,
      content: input.content,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date().toISOString(),
    },
  }]).catch((err) => console.warn("[qdrant] Failed to upsert agent memory:", err));

  return { id: row.id };
}

/**
 * Search semantic memory by cosine similarity against the query embedding.
 * Returns the top-k most relevant memories.
 */
export async function searchSemanticMemory(input: {
  agentId: string;
  orgId: string;
  userId?: string;
  query: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<{ id: string; content: string; similarity: number; metadata: Record<string, unknown> | null }[]> {
  const queryEmbedding = await generateEmbedding(input.query);
  const limit = input.limit ?? 5;
  const minSimilarity = input.minSimilarity ?? 0.5;

  // Use Qdrant vector search
  const must: any[] = [
    { key: "agentId", match: { value: input.agentId } },
    { key: "orgId", match: { value: input.orgId } },
  ];
  if (input.userId) {
    must.push({ key: "userId", match: { value: input.userId } });
  }

  try {
    const results = await searchVector(COLLECTIONS.AGENT_MEMORIES, queryEmbedding, {
      filter: { must },
      limit,
      scoreThreshold: minSimilarity,
    });

    return results.map((r) => ({
      id: r.id,
      content: (r.payload.content as string) ?? "",
      similarity: r.score,
      metadata: null,
    }));
  } catch (err) {
    console.warn("[qdrant] Agent memory search failed, returning empty:", err);
    return [];
  }
}

/**
 * Extract key facts from a conversation and store them as semantic memories.
 * Uses an LLM call to identify important, reusable information.
 */
export async function extractMemoryFacts(input: {
  agentId: string;
  orgId: string;
  userId?: string;
  conversationId: string;
  messages: { role: string; content: string }[];
  model: string;
}): Promise<{ factsStored: number }> {
  // Build conversation text for extraction
  const conversationText = input.messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n")
    .slice(0, 4000);

  const memoryParams = await buildChatParams(input.model, {
    model: input.model,
    messages: [
      {
        role: "system",
        content: `Extract key facts from this conversation that would be useful to remember for future interactions.
Focus on:
- User preferences and patterns
- Important decisions made
- Key information about the user's context/goals
- Recurring topics or requests

Return ONLY valid JSON: {"facts": ["fact 1", "fact 2", ...]}
Return an empty array if no useful facts to extract. Maximum 5 facts.`,
      },
      { role: "user", content: conversationText },
    ],
    temperature: 0,
    max_tokens: 500,
  });
  const response = await openai.chat.completions.create(memoryParams as any);

  const content = (response as any).choices?.[0]?.message?.content ?? "";
  let facts: string[] = [];
  try {
    const parsed = JSON.parse(content);
    facts = parsed.facts ?? [];
  } catch {
    return { factsStored: 0 };
  }

  // Store each fact as a semantic memory
  for (const fact of facts.slice(0, 5)) {
    await embedAndStoreMemory({
      agentId: input.agentId,
      orgId: input.orgId,
      userId: input.userId,
      scope: "global",
      content: fact,
      sourceType: "conversation",
      sourceId: input.conversationId,
    });
  }

  return { factsStored: facts.length };
}
