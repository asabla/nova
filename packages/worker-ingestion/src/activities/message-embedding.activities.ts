import { eq, and, isNull } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { openai } from "@nova/worker-shared/litellm";
import { getDefaultEmbeddingModel } from "@nova/worker-shared/models";
import { messages } from "@nova/shared/schemas";
import { upsertPoints, COLLECTIONS } from "@nova/worker-shared/qdrant";

/**
 * Fetch message from PG, generate embedding, upsert to Qdrant nova_messages.
 */
export async function embedAndIndexMessage(messageId: string, orgId: string): Promise<void> {
  const [msg] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.orgId, orgId), isNull(messages.deletedAt)));

  if (!msg || !msg.content) return;

  const text = msg.content.slice(0, 8000);
  const embeddingModel = process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();

  const response = await openai.embeddings.create({
    model: embeddingModel,
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) return;

  await upsertPoints(COLLECTIONS.MESSAGES, [{
    id: msg.id,
    vector: embedding,
    payload: {
      orgId: msg.orgId,
      conversationId: msg.conversationId,
      senderType: msg.senderType,
      senderUserId: msg.senderUserId ?? null,
      agentId: msg.agentId ?? null,
      modelId: msg.modelId ?? null,
      contentType: msg.contentType ?? "text",
      content: msg.content.slice(0, 10_000),
      tokenCountPrompt: msg.tokenCountPrompt ?? 0,
      tokenCountCompletion: msg.tokenCountCompletion ?? 0,
      embeddingModel: embeddingModel,
      createdAt: msg.createdAt?.toISOString() ?? null,
    },
  }]);
}
