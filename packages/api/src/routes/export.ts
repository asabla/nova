import { Hono } from "hono";
import { eq, and, asc, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { conversations, messages, agents, knowledgeCollections, files } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

const exportRoutes = new Hono<AppContext>();

// Export conversation as JSON
exportRoutes.get("/conversations/:id/json", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)));
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db.select().from(messages)
    .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt));

  const exported = {
    id: conv.id,
    title: conv.title,
    systemPrompt: conv.systemPrompt,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    totalTokens: conv.totalTokens,
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.senderType,
      content: m.content,
      modelId: m.modelId,
      tokenCountPrompt: m.tokenCountPrompt,
      tokenCountCompletion: m.tokenCountCompletion,
      costCents: m.costCents,
      isEdited: m.isEdited,
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
    .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt));

  let md = `# ${conv.title ?? "Untitled Conversation"}\n\n`;
  md += `> Exported from NOVA on ${new Date().toISOString()}\n\n`;
  if (conv.systemPrompt) {
    md += `## System Prompt\n\n${conv.systemPrompt}\n\n`;
  }
  md += `---\n\n`;

  for (const msg of msgs) {
    const role = msg.senderType === "user" ? "**User**" : "**Assistant**";
    const tokens = (msg.tokenCountPrompt ?? 0) + (msg.tokenCountCompletion ?? 0);
    const meta = tokens > 0 ? ` *(${tokens} tokens)*` : "";
    md += `### ${role}${meta}\n\n${msg.content ?? ""}\n\n---\n\n`;
  }

  const totalTokens = conv.totalTokens ?? 0;
  if (totalTokens > 0) {
    md += `\n*Total tokens used: ${totalTokens.toLocaleString()}*\n`;
  }

  c.header("Content-Type", "text/markdown");
  c.header("Content-Disposition", `attachment; filename="conversation-${conv.id}.md"`);
  return c.text(md);
});

// Export conversation as CSV
exportRoutes.get("/conversations/:id/csv", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)));
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db.select().from(messages)
    .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt));

  const escCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
  let csv = "Role,Content,Tokens (Prompt),Tokens (Completion),Cost (cents),Created At\n";
  for (const msg of msgs) {
    csv += [
      escCsv(msg.senderType),
      escCsv(msg.content ?? ""),
      msg.tokenCountPrompt ?? 0,
      msg.tokenCountCompletion ?? 0,
      msg.costCents ?? 0,
      escCsv(msg.createdAt?.toISOString() ?? ""),
    ].join(",") + "\n";
  }

  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="conversation-${conv.id}.csv"`);
  return c.text(csv);
});

// Export conversation as HTML
exportRoutes.get("/conversations/:id/html", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db.select().from(conversations)
    .where(and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)));
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db.select().from(messages)
    .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt));

  const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(conv.title ?? "Conversation")}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #0a0a0a; color: #e5e5e5; }
h1 { border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
.message { margin: 1.5rem 0; padding: 1rem; border-radius: 12px; }
.user { background: #1a1a2e; border-left: 3px solid #6366f1; }
.assistant { background: #111; border-left: 3px solid #22c55e; }
.role { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
.content { white-space: pre-wrap; line-height: 1.6; }
.meta { font-size: 0.75rem; color: #888; margin-top: 0.5rem; }
</style>
</head>
<body>
<h1>${escHtml(conv.title ?? "Untitled Conversation")}</h1>
<p style="color:#888;font-size:0.85rem">Exported from NOVA on ${new Date().toISOString()}</p>
`;

  for (const msg of msgs) {
    const cls = msg.senderType === "user" ? "user" : "assistant";
    const tokens = (msg.tokenCountPrompt ?? 0) + (msg.tokenCountCompletion ?? 0);
    html += `<div class="message ${cls}">
<div class="role">${escHtml(msg.senderType)}</div>
<div class="content">${escHtml(msg.content ?? "")}</div>
${tokens > 0 ? `<div class="meta">${tokens} tokens</div>` : ""}
</div>\n`;
  }

  html += `</body></html>`;

  c.header("Content-Type", "text/html");
  c.header("Content-Disposition", `attachment; filename="conversation-${conv.id}.html"`);
  return c.html(html);
});

// Export all user data (GDPR compliance)
exportRoutes.get("/user-data", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [userConvs, userAgents, userKbs, userFiles] = await Promise.all([
    db.select().from(conversations)
      .where(and(eq(conversations.orgId, orgId), eq(conversations.ownerId, userId), isNull(conversations.deletedAt))),
    db.select().from(agents)
      .where(and(eq(agents.orgId, orgId), eq(agents.ownerId, userId), isNull(agents.deletedAt))),
    db.select().from(knowledgeCollections)
      .where(and(eq(knowledgeCollections.orgId, orgId), eq(knowledgeCollections.ownerId, userId), isNull(knowledgeCollections.deletedAt))),
    db.select().from(files)
      .where(and(eq(files.orgId, orgId), eq(files.uploadedById, userId), isNull(files.deletedAt))),
  ]);

  const allMessages = [];
  for (const conv of userConvs) {
    const msgs = await db.select().from(messages)
      .where(and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)))
      .orderBy(asc(messages.createdAt));
    allMessages.push(...msgs.map((m) => ({ ...m, conversationTitle: conv.title })));
  }

  const exported = {
    exportDate: new Date().toISOString(),
    exportFormat: "nova-user-data-v1",
    conversations: userConvs,
    messages: allMessages,
    agents: userAgents,
    knowledgeCollections: userKbs,
    files: userFiles.map((f) => ({ ...f, note: "File contents not included. Download separately." })),
  };

  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="nova-export-${userId}.json"`);
  return c.json(exported);
});

export { exportRoutes };
