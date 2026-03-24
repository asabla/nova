import { eq, asc, isNull, sql } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { openai } from "@nova/worker-shared/litellm";
import { getDefaultChatModel, buildChatParams } from "@nova/worker-shared/models";
import { messages, conversations } from "@nova/shared/schemas";

export async function getConversationMessages(conversationId: string): Promise<{ role: string; content: string }[]> {
  const msgs = await db
    .select({ senderType: messages.senderType, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(20);

  return msgs.map((m) => ({
    role: m.senderType === "user" ? "user" : "assistant",
    content: m.content ?? "",
  }));
}

export async function generateSummary(msgs: { role: string; content: string }[]): Promise<string> {
  const model = process.env.SUMMARY_MODEL ?? await getDefaultChatModel();

  const params = await buildChatParams(model, {
    model,
    messages: [
      { role: "system", content: "Generate a short (5-8 word) title for this conversation. Respond with only the title." },
      ...msgs.slice(0, 4),
    ],
    max_tokens: 30,
    temperature: 0.3,
  });
  const result = await openai.chat.completions.create(params as any);

  return result.choices?.[0]?.message?.content?.trim() ?? "Untitled Conversation";
}

export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function getUnsummarizedConversations(batchSize: number): Promise<{ orgId: string; conversationId: string }[]> {
  const rows = await db
    .select({
      id: conversations.id,
      orgId: conversations.orgId,
    })
    .from(conversations)
    .where(
      sql`${conversations.title} IS NULL AND ${conversations.deletedAt} IS NULL AND (
        SELECT count(*) FROM ${messages} WHERE ${messages.conversationId} = ${conversations.id}
      ) >= 2`
    )
    .orderBy(asc(conversations.createdAt))
    .limit(batchSize);

  return rows.map((r) => ({ orgId: r.orgId, conversationId: r.id }));
}
