import { eq, asc } from "drizzle-orm";
import { db } from "../lib/db";
import { openai } from "../lib/litellm";
import { getDefaultChatModel } from "../lib/models";
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

  const result = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Generate a short (5-8 word) title for this conversation. Respond with only the title." },
      ...msgs.slice(0, 4),
    ] as any,
    max_tokens: 30,
    temperature: 0.3,
  });

  return result.choices?.[0]?.message?.content?.trim() ?? "Untitled Conversation";
}

export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
