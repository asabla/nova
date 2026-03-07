import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, asc, isNull, inArray } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import {
  conversations,
  messages,
  agents,
  knowledgeCollections,
  files,
  userProfiles,
  apiKeys,
  notifications,
  dataJobs,
} from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const exportRoutes = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// POST /export/all - Export ALL user data as JSON archive (GDPR self-service)
// ---------------------------------------------------------------------------
exportRoutes.post("/all", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  // Create a tracking job
  const [job] = await db
    .insert(dataJobs)
    .values({
      orgId,
      userId,
      type: "export_all",
      status: "processing",
      metadata: {},
    })
    .returning();

  try {
    const [userConvs, userAgents, userKbs, userFiles, userNotifs, profile] =
      await Promise.all([
        db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.orgId, orgId),
              eq(conversations.ownerId, userId),
              isNull(conversations.deletedAt),
            ),
          ),
        db
          .select()
          .from(agents)
          .where(
            and(
              eq(agents.orgId, orgId),
              eq(agents.ownerId, userId),
              isNull(agents.deletedAt),
            ),
          ),
        db
          .select()
          .from(knowledgeCollections)
          .where(
            and(
              eq(knowledgeCollections.orgId, orgId),
              eq(knowledgeCollections.ownerId, userId),
              isNull(knowledgeCollections.deletedAt),
            ),
          ),
        db
          .select()
          .from(files)
          .where(
            and(
              eq(files.orgId, orgId),
              eq(files.userId, userId),
              isNull(files.deletedAt),
            ),
          ),
        db
          .select()
          .from(notifications)
          .where(and(eq(notifications.orgId, orgId), eq(notifications.userId, userId))),
        db
          .select()
          .from(userProfiles)
          .where(
            and(
              eq(userProfiles.orgId, orgId),
              eq(userProfiles.userId, userId),
              isNull(userProfiles.deletedAt),
            ),
          ),
      ]);

    // Fetch all messages across conversations
    const allMessages: any[] = [];
    for (const conv of userConvs) {
      const msgs = await db
        .select()
        .from(messages)
        .where(
          and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)),
        )
        .orderBy(asc(messages.createdAt));
      allMessages.push(
        ...msgs.map((m) => ({ ...m, conversationTitle: conv.title })),
      );
    }

    // Fetch API keys (redacted)
    const userApiKeys = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        name: apiKeys.name,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.orgId, orgId)));

    const exportData = {
      exportDate: new Date().toISOString(),
      exportFormat: "nova-user-data-v1",
      profile: profile[0] ?? null,
      conversations: userConvs,
      messages: allMessages,
      agents: userAgents,
      knowledgeCollections: userKbs,
      files: userFiles.map((f) => ({
        ...f,
        note: "File contents not included. Download separately via /api/files/:id.",
      })),
      apiKeys: userApiKeys,
      notifications: userNotifs,
    };

    // Mark job completed and store result inline (for small exports)
    await db
      .update(dataJobs)
      .set({
        status: "completed",
        progressPct: 100,
        metadata: {
          recordCounts: {
            conversations: userConvs.length,
            messages: allMessages.length,
            agents: userAgents.length,
            knowledgeCollections: userKbs.length,
            files: userFiles.length,
            apiKeys: userApiKeys.length,
            notifications: userNotifs.length,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(dataJobs.id, job.id));

    await writeAuditLog({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "export.all",
      resourceType: "user",
      resourceId: userId,
      details: { jobId: job.id },
    });

    c.header("Content-Type", "application/json");
    c.header(
      "Content-Disposition",
      `attachment; filename="nova-export-${userId}.json"`,
    );
    return c.json({
      exportId: job.id,
      status: "completed",
      data: exportData,
    });
  } catch (err) {
    await db
      .update(dataJobs)
      .set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(dataJobs.id, job.id));
    throw err;
  }
});

// ---------------------------------------------------------------------------
// POST /export/conversations - Export conversations as Markdown, JSON, or HTML
// Supports exporting one or many conversations in a chosen format (story #38).
// ---------------------------------------------------------------------------
const exportConversationsSchema = z.object({
  conversationIds: z
    .array(z.string().uuid())
    .min(1, "At least one conversation ID required")
    .max(100, "Maximum 100 conversations per export"),
  format: z.enum(["json", "markdown", "html", "csv"]).default("json"),
});

exportRoutes.post(
  "/conversations",
  zValidator("json", exportConversationsSchema),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const { conversationIds, format } = c.req.valid("json");

    // Create a tracking job
    const [job] = await db
      .insert(dataJobs)
      .values({
        orgId,
        userId,
        type: "export_conversations",
        status: "processing",
        metadata: { format, conversationCount: conversationIds.length },
      })
      .returning();

    // Fetch requested conversations (only those the user owns in this org)
    const requestedConvs = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.orgId, orgId),
          eq(conversations.ownerId, userId),
          isNull(conversations.deletedAt),
          inArray(conversations.id, conversationIds),
        ),
      );

    if (requestedConvs.length === 0) {
      throw AppError.notFound("No matching conversations found");
    }

    // Build full conversation data with messages
    const exportedConversations: any[] = [];
    for (const conv of requestedConvs) {
      const msgs = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conv.id),
            isNull(messages.deletedAt),
          ),
        )
        .orderBy(asc(messages.createdAt));

      exportedConversations.push({
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
      });
    }

    // Mark job completed
    await db
      .update(dataJobs)
      .set({
        status: "completed",
        progressPct: 100,
        metadata: {
          format,
          conversationCount: exportedConversations.length,
          messageCount: exportedConversations.reduce(
            (sum: number, c: any) => sum + c.messages.length,
            0,
          ),
        },
        updatedAt: new Date(),
      })
      .where(eq(dataJobs.id, job.id));

    await writeAuditLog({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "export.conversations",
      resourceType: "conversation",
      details: {
        jobId: job.id,
        format,
        count: exportedConversations.length,
      },
    });

    // Render in the requested format
    if (format === "markdown") {
      let md = `# NOVA Conversation Export\n\n`;
      md += `> Exported on ${new Date().toISOString()} | ${exportedConversations.length} conversation(s)\n\n`;

      for (const conv of exportedConversations) {
        md += `---\n\n## ${conv.title ?? "Untitled Conversation"}\n\n`;
        if (conv.systemPrompt) {
          md += `### System Prompt\n\n${conv.systemPrompt}\n\n`;
        }
        for (const msg of conv.messages) {
          const role =
            msg.role === "user" ? "**User**" : "**Assistant**";
          const tokens =
            (msg.tokenCountPrompt ?? 0) + (msg.tokenCountCompletion ?? 0);
          const meta = tokens > 0 ? ` *(${tokens} tokens)*` : "";
          md += `#### ${role}${meta}\n\n${msg.content ?? ""}\n\n`;
        }
        const totalTokens = conv.totalTokens ?? 0;
        if (totalTokens > 0) {
          md += `*Total tokens: ${totalTokens.toLocaleString()}*\n\n`;
        }
      }

      c.header("Content-Type", "text/markdown");
      c.header(
        "Content-Disposition",
        `attachment; filename="nova-conversations-export.md"`,
      );
      return c.text(md);
    }

    if (format === "html") {
      const escHtml = (s: string) =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NOVA Conversation Export</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #0a0a0a; color: #e5e5e5; }
h1 { border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
h2 { margin-top: 2rem; border-bottom: 1px solid #222; padding-bottom: 0.3rem; }
.message { margin: 1.5rem 0; padding: 1rem; border-radius: 12px; }
.user { background: #1a1a2e; border-left: 3px solid #6366f1; }
.assistant { background: #111; border-left: 3px solid #22c55e; }
.role { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
.content { white-space: pre-wrap; line-height: 1.6; }
.meta { font-size: 0.75rem; color: #888; margin-top: 0.5rem; }
</style>
</head>
<body>
<h1>NOVA Conversation Export</h1>
<p style="color:#888;font-size:0.85rem">Exported on ${new Date().toISOString()} | ${exportedConversations.length} conversation(s)</p>
`;
      for (const conv of exportedConversations) {
        html += `<h2>${escHtml(conv.title ?? "Untitled Conversation")}</h2>\n`;
        for (const msg of conv.messages) {
          const cls = msg.role === "user" ? "user" : "assistant";
          const tokens =
            (msg.tokenCountPrompt ?? 0) + (msg.tokenCountCompletion ?? 0);
          html += `<div class="message ${cls}">
<div class="role">${escHtml(msg.role)}</div>
<div class="content">${escHtml(msg.content ?? "")}</div>
${tokens > 0 ? `<div class="meta">${tokens} tokens</div>` : ""}
</div>\n`;
        }
      }
      html += `</body></html>`;

      c.header("Content-Type", "text/html");
      c.header(
        "Content-Disposition",
        `attachment; filename="nova-conversations-export.html"`,
      );
      return c.html(html);
    }

    if (format === "csv") {
      const escCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
      let csv =
        "Conversation ID,Conversation Title,Role,Content,Tokens (Prompt),Tokens (Completion),Cost (cents),Created At\n";
      for (const conv of exportedConversations) {
        for (const msg of conv.messages) {
          csv +=
            [
              escCsv(conv.id),
              escCsv(conv.title ?? "Untitled"),
              escCsv(msg.role),
              escCsv(msg.content ?? ""),
              msg.tokenCountPrompt ?? 0,
              msg.tokenCountCompletion ?? 0,
              msg.costCents ?? 0,
              escCsv(msg.createdAt?.toISOString?.() ?? String(msg.createdAt ?? "")),
            ].join(",") + "\n";
        }
      }

      c.header("Content-Type", "text/csv");
      c.header(
        "Content-Disposition",
        `attachment; filename="nova-conversations-export.csv"`,
      );
      return c.text(csv);
    }

    // Default: JSON
    c.header("Content-Type", "application/json");
    c.header(
      "Content-Disposition",
      `attachment; filename="nova-conversations-export.json"`,
    );
    return c.json({
      exportId: job.id,
      exportDate: new Date().toISOString(),
      exportFormat: "nova-conversations-v1",
      conversations: exportedConversations,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /export/status/:exportId - Check export job status
// ---------------------------------------------------------------------------
exportRoutes.get(
  "/status/:exportId",
  zValidator("param", z.object({ exportId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const { exportId } = c.req.valid("param");

    const [job] = await db
      .select()
      .from(dataJobs)
      .where(and(eq(dataJobs.id, exportId), eq(dataJobs.orgId, orgId)));

    if (!job) throw AppError.notFound("Export job");

    if (job.userId !== userId) {
      throw AppError.forbidden("You can only view your own export jobs");
    }

    if (
      job.type !== "export_all" &&
      job.type !== "export_conversations"
    ) {
      throw AppError.notFound("Export job");
    }

    return c.json({
      exportId: job.id,
      type: job.type,
      status: job.status,
      progressPct: job.progressPct,
      errorMessage: job.errorMessage,
      metadata: job.metadata,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /export/download/:exportId - Download a completed export
// Re-generates the export data from the job metadata. For large exports in
// production, this would stream from object storage (S3/MinIO).
// ---------------------------------------------------------------------------
exportRoutes.get(
  "/download/:exportId",
  zValidator("param", z.object({ exportId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const { exportId } = c.req.valid("param");

    const [job] = await db
      .select()
      .from(dataJobs)
      .where(and(eq(dataJobs.id, exportId), eq(dataJobs.orgId, orgId)));

    if (!job) throw AppError.notFound("Export job");

    if (job.userId !== userId) {
      throw AppError.forbidden("You can only download your own exports");
    }

    if (
      job.type !== "export_all" &&
      job.type !== "export_conversations"
    ) {
      throw AppError.notFound("Export job");
    }

    if (job.status !== "completed") {
      throw AppError.badRequest(
        `Export is not ready. Current status: ${job.status}`,
      );
    }

    // If the job has a resultFileId, redirect to the file download endpoint
    if (job.resultFileId) {
      return c.redirect(`/api/files/${job.resultFileId}`);
    }

    // For export_all: regenerate inline (small datasets)
    if (job.type === "export_all") {
      const [userConvs, userAgents, userKbs, userFiles] = await Promise.all([
        db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.orgId, orgId),
              eq(conversations.ownerId, userId),
              isNull(conversations.deletedAt),
            ),
          ),
        db
          .select()
          .from(agents)
          .where(
            and(
              eq(agents.orgId, orgId),
              eq(agents.ownerId, userId),
              isNull(agents.deletedAt),
            ),
          ),
        db
          .select()
          .from(knowledgeCollections)
          .where(
            and(
              eq(knowledgeCollections.orgId, orgId),
              eq(knowledgeCollections.ownerId, userId),
              isNull(knowledgeCollections.deletedAt),
            ),
          ),
        db
          .select()
          .from(files)
          .where(
            and(
              eq(files.orgId, orgId),
              eq(files.userId, userId),
              isNull(files.deletedAt),
            ),
          ),
      ]);

      const allMessages: any[] = [];
      for (const conv of userConvs) {
        const msgs = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conv.id),
              isNull(messages.deletedAt),
            ),
          )
          .orderBy(asc(messages.createdAt));
        allMessages.push(
          ...msgs.map((m) => ({ ...m, conversationTitle: conv.title })),
        );
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        exportFormat: "nova-user-data-v1",
        conversations: userConvs,
        messages: allMessages,
        agents: userAgents,
        knowledgeCollections: userKbs,
        files: userFiles.map((f) => ({
          ...f,
          note: "File contents not included. Download separately via /api/files/:id.",
        })),
      };

      c.header("Content-Type", "application/json");
      c.header(
        "Content-Disposition",
        `attachment; filename="nova-export-${userId}.json"`,
      );
      return c.json(exportData);
    }

    // For export_conversations: regenerate from job metadata
    if (job.type === "export_conversations") {
      const meta = job.metadata as Record<string, any> | null;
      c.header("Content-Type", "application/json");
      c.header(
        "Content-Disposition",
        `attachment; filename="nova-conversations-${exportId}.json"`,
      );
      return c.json({
        exportId: job.id,
        note: "Re-download not available for this export type. Please create a new export.",
        metadata: meta,
      });
    }

    throw AppError.badRequest("Unsupported export type for download");
  },
);

// ---------------------------------------------------------------------------
// Legacy single-conversation export endpoints (kept for backward compat)
// ---------------------------------------------------------------------------

// Export conversation as JSON
exportRoutes.get("/conversations/:id/json", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)),
    );
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)),
    )
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
  c.header(
    "Content-Disposition",
    `attachment; filename="conversation-${conv.id}.json"`,
  );
  return c.json(exported);
});

// Export conversation as Markdown
exportRoutes.get("/conversations/:id/markdown", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)),
    );
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)),
    )
    .orderBy(asc(messages.createdAt));

  let md = `# ${conv.title ?? "Untitled Conversation"}\n\n`;
  md += `> Exported from NOVA on ${new Date().toISOString()}\n\n`;
  if (conv.systemPrompt) {
    md += `## System Prompt\n\n${conv.systemPrompt}\n\n`;
  }
  md += `---\n\n`;

  for (const msg of msgs) {
    const role = msg.senderType === "user" ? "**User**" : "**Assistant**";
    const tokens =
      (msg.tokenCountPrompt ?? 0) + (msg.tokenCountCompletion ?? 0);
    const meta = tokens > 0 ? ` *(${tokens} tokens)*` : "";
    md += `### ${role}${meta}\n\n${msg.content ?? ""}\n\n---\n\n`;
  }

  const totalTokens = conv.totalTokens ?? 0;
  if (totalTokens > 0) {
    md += `\n*Total tokens used: ${totalTokens.toLocaleString()}*\n`;
  }

  c.header("Content-Type", "text/markdown");
  c.header(
    "Content-Disposition",
    `attachment; filename="conversation-${conv.id}.md"`,
  );
  return c.text(md);
});

// Export conversation as CSV
exportRoutes.get("/conversations/:id/csv", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)),
    );
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)),
    )
    .orderBy(asc(messages.createdAt));

  const escCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
  let csv =
    "Role,Content,Tokens (Prompt),Tokens (Completion),Cost (cents),Created At\n";
  for (const msg of msgs) {
    csv +=
      [
        escCsv(msg.senderType),
        escCsv(msg.content ?? ""),
        msg.tokenCountPrompt ?? 0,
        msg.tokenCountCompletion ?? 0,
        msg.costCents ?? 0,
        escCsv(msg.createdAt?.toISOString() ?? ""),
      ].join(",") + "\n";
  }

  c.header("Content-Type", "text/csv");
  c.header(
    "Content-Disposition",
    `attachment; filename="conversation-${conv.id}.csv"`,
  );
  return c.text(csv);
});

// Export conversation as HTML
exportRoutes.get("/conversations/:id/html", async (c) => {
  const orgId = c.get("orgId");

  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, c.req.param("id")), eq(conversations.orgId, orgId)),
    );
  if (!conv) throw AppError.notFound("Conversation not found");

  const msgs = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conv.id), isNull(messages.deletedAt)),
    )
    .orderBy(asc(messages.createdAt));

  const escHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

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
    const tokens =
      (msg.tokenCountPrompt ?? 0) + (msg.tokenCountCompletion ?? 0);
    html += `<div class="message ${cls}">
<div class="role">${escHtml(msg.senderType)}</div>
<div class="content">${escHtml(msg.content ?? "")}</div>
${tokens > 0 ? `<div class="meta">${tokens} tokens</div>` : ""}
</div>\n`;
  }

  html += `</body></html>`;

  c.header("Content-Type", "text/html");
  c.header(
    "Content-Disposition",
    `attachment; filename="conversation-${conv.id}.html"`,
  );
  return c.html(html);
});

export { exportRoutes };
