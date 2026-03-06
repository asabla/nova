import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { conversations, messages, messageAttachments } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

const exportRoutes = new Hono<AppContext>();

// Export conversation as JSON
exportRoutes.get("/conversations/:id/json", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)));
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.createdAt));

  const exported = {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.senderType,
      content: m.content,
      model: m.model,
      tokenCount: m.tokenCount,
      createdAt: m.createdAt,
    })),
  };

  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="conversation-${conv.id}.json"`);
  return c.json(exported);
});

// Export conversation as Markdown
exportRoutes.get("/conversations/:id/markdown", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)));
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(asc(messages.createdAt));

  let md = `# ${conv.title ?? "Untitled Conversation"}\n\n`;
  md += `*Exported from NOVA on ${new Date().toISOString()}*\n\n---\n\n`;

  for (const msg of msgs) {
    const role = msg.senderType === "user" ? "User" : "Assistant";
    const model = msg.model ? ` (${msg.model})` : "";
    md += `## ${role}${model}\n\n${msg.content ?? ""}\n\n---\n\n`;
  }

  c.header("Content-Type", "text/markdown");
  c.header("Content-Disposition", `attachment; filename="conversation-${conv.id}.md"`);
  return c.text(md);
});

// Export all user data (GDPR compliance)
exportRoutes.get("/user-data", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const userConversations = await db.select().from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.createdBy, userId)));

  const allMessages = [];
  for (const conv of userConversations) {
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.createdAt));
    allMessages.push(...msgs.map((m) => ({ ...m, conversationTitle: conv.title })));
  }

  const exported = {
    exportDate: new Date().toISOString(),
    conversations: userConversations,
    messages: allMessages,
  };

  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="nova-export-${userId}.json"`);
  return c.json(exported);
});

export { exportRoutes };
