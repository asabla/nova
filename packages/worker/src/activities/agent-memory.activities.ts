import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { db } from "../lib/db";
import { openai } from "../lib/litellm";
import { agentMemoryVectors } from "@nova/shared/schemas";

const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Generate an embedding for the given text via LiteLLM /embeddings endpoint.
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
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
    embedding,
    metadata: input.metadata,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  }).returning({ id: agentMemoryVectors.id });

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

  const conditions = [
    eq(agentMemoryVectors.agentId, input.agentId),
    eq(agentMemoryVectors.orgId, input.orgId),
    isNull(agentMemoryVectors.deletedAt),
  ];
  if (input.userId) {
    conditions.push(eq(agentMemoryVectors.userId, input.userId));
  }

  // Use pgvector cosine similarity operator (<=>)
  const results = await db.execute(sql`
    SELECT
      id,
      content,
      metadata,
      1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
    FROM agent_memory_vectors
    WHERE agent_id = ${input.agentId}
      AND org_id = ${input.orgId}
      AND deleted_at IS NULL
      ${input.userId ? sql`AND user_id = ${input.userId}` : sql``}
      AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) >= ${minSimilarity}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);

  return (results as any[]).map((row: any) => ({
    id: row.id,
    content: row.content,
    similarity: parseFloat(row.similarity),
    metadata: row.metadata,
  }));
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

  const response = await openai.chat.completions.create({
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
  } as any);

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
