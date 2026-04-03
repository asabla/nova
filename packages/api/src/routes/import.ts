import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import {
  conversations,
  messages,
  users,
  userProfiles,
  dataJobs,
} from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";
import { requireRole } from "../middleware/rbac";

const importRoutes = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// POST /import/chatgpt - Import from ChatGPT exported JSON format (story #195)
// Expects the body to be the ChatGPT conversations.json array.
// ---------------------------------------------------------------------------
const chatgptImportSchema = z.array(
  z.object({
    title: z.string().optional(),
    mapping: z.record(z.string(), z.any()).optional(),
    create_time: z.number().optional(),
  }).passthrough(),
).min(1, "Expected a non-empty array of conversations");

importRoutes.post("/chatgpt", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = await c.req.json();

  const parseResult = chatgptImportSchema.safeParse(body);
  if (!parseResult.success) {
    throw AppError.badRequest(
      `Invalid ChatGPT export format: ${parseResult.error.issues[0]?.message ?? "Expected an array of conversations"}`,
    );
  }
  const convArray = parseResult.data;

  // Create a tracking job
  const [job] = await db
    .insert(dataJobs)
    .values({
      orgId,
      userId,
      type: "import_chatgpt",
      status: "processing",
      metadata: { totalConversations: convArray.length },
    })
    .returning();

  let imported = 0;
  let skipped = 0;
  const errors: Array<{ index: number; title: string; error: string }> = [];

  for (let i = 0; i < convArray.length; i++) {
    const conv = convArray[i];
    try {
      const title = conv.title ?? "Imported Conversation";

      const [newConv] = await db
        .insert(conversations)
        .values({
          orgId,
          ownerId: userId,
          title,
        })
        .returning();

      // Extract messages from ChatGPT's mapping format
      const mapping = conv.mapping ?? {};
      const messageEntries = Object.values(mapping)
        .filter((m: any) => m?.message?.content?.parts?.length > 0)
        .sort(
          (a: any, b: any) =>
            (a.message?.create_time ?? 0) - (b.message?.create_time ?? 0),
        );

      let messageCount = 0;
      for (const entry of messageEntries as any[]) {
        const msg = entry.message;
        if (!msg) continue;

        const content =
          msg.content?.parts
            ?.filter((p: any) => typeof p === "string")
            .join("\n") ?? "";
        if (!content.trim()) continue;

        const senderType =
          msg.author?.role === "user"
            ? "user"
            : msg.author?.role === "assistant"
              ? "assistant"
              : "system";

        await db.insert(messages).values({
          orgId,
          conversationId: newConv.id,
          senderType,
          content,
        });
        messageCount++;
      }

      imported++;

      // Update progress periodically
      if (imported % 10 === 0) {
        await db
          .update(dataJobs)
          .set({
            progressPct: Math.round(((i + 1) / convArray.length) * 100),
            updatedAt: new Date(),
          })
          .where(eq(dataJobs.id, job.id));
      }
    } catch (err) {
      skipped++;
      errors.push({
        index: i,
        title: conv.title ?? "Unknown",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Finalize job
  await db
    .update(dataJobs)
    .set({
      status: "completed",
      progressPct: 100,
      metadata: {
        totalConversations: convArray.length,
        imported,
        skipped,
        errorCount: errors.length,
      },
      updatedAt: new Date(),
    })
    .where(eq(dataJobs.id, job.id));

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "import.chatgpt",
    resourceType: "conversation",
    details: { jobId: job.id, imported, skipped, total: convArray.length },
  });

  return c.json({
    importId: job.id,
    imported,
    skipped,
    total: convArray.length,
    errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
  });
});

// ---------------------------------------------------------------------------
// POST /import/claude - Import from Claude.ai export format (story #195)
// Expects an array of Claude conversations with chat_messages.
// ---------------------------------------------------------------------------
const claudeImportSchema = z.array(
  z.object({
    uuid: z.string().optional(),
    name: z.string().optional(),
    chat_messages: z.array(
      z.object({
        sender: z.string(),
        text: z.union([z.string(), z.any()]),
        created_at: z.string().optional(),
      }).passthrough(),
    ).optional(),
  }).passthrough(),
).min(1, "Expected a non-empty array of conversations");

importRoutes.post("/claude", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = await c.req.json();

  const parseResult = claudeImportSchema.safeParse(body);
  if (!parseResult.success) {
    throw AppError.badRequest(
      `Invalid Claude export format: ${parseResult.error.issues[0]?.message ?? "Expected an array of conversations"}`,
    );
  }
  const convArray = parseResult.data;

  // Create a tracking job
  const [job] = await db
    .insert(dataJobs)
    .values({
      orgId,
      userId,
      type: "import_claude",
      status: "processing",
      metadata: { totalConversations: convArray.length },
    })
    .returning();

  let imported = 0;
  let skipped = 0;
  const errors: Array<{ index: number; name: string; error: string }> = [];

  for (let i = 0; i < convArray.length; i++) {
    const conv = convArray[i];
    try {
      const [newConv] = await db
        .insert(conversations)
        .values({
          orgId,
          ownerId: userId,
          title: conv.name ?? "Imported from Claude",
        })
        .returning();

      let messageCount = 0;
      for (const msg of conv.chat_messages ?? []) {
        const content =
          typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text);
        if (!content.trim()) continue;

        await db.insert(messages).values({
          orgId,
          conversationId: newConv.id,
          senderType: msg.sender === "human" ? "user" : "assistant",
          content,
        });
        messageCount++;
      }

      imported++;

      if (imported % 10 === 0) {
        await db
          .update(dataJobs)
          .set({
            progressPct: Math.round(((i + 1) / convArray.length) * 100),
            updatedAt: new Date(),
          })
          .where(eq(dataJobs.id, job.id));
      }
    } catch (err) {
      skipped++;
      errors.push({
        index: i,
        name: conv.name ?? "Unknown",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Finalize job
  await db
    .update(dataJobs)
    .set({
      status: "completed",
      progressPct: 100,
      metadata: {
        totalConversations: convArray.length,
        imported,
        skipped,
        errorCount: errors.length,
      },
      updatedAt: new Date(),
    })
    .where(eq(dataJobs.id, job.id));

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "import.claude",
    resourceType: "conversation",
    details: { jobId: job.id, imported, skipped, total: convArray.length },
  });

  return c.json({
    importId: job.id,
    imported,
    skipped,
    total: convArray.length,
    errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
  });
});

// ---------------------------------------------------------------------------
// POST /import/csv-users - Bulk import users from CSV (story #21)
// Requires org-admin. CSV format: "email,displayName,role" (header optional).
// ---------------------------------------------------------------------------
const csvUsersSchema = z.object({
  csv: z.string().min(1, "CSV data is required"),
  sendInvites: z.boolean().optional().default(false),
  defaultRole: z.string().optional().default("member"),
});

importRoutes.post(
  "/csv-users",
  requireRole("org-admin"),
  zValidator("json", csvUsersSchema),
  async (c) => {
    const adminId = c.get("userId");
    const orgId = c.get("orgId");
    const { csv, sendInvites, defaultRole } = c.req.valid("json");

    // Create a tracking job
    const [job] = await db
      .insert(dataJobs)
      .values({
        orgId,
        userId: adminId,
        type: "import_csv_users",
        status: "processing",
        metadata: { sendInvites, defaultRole },
      })
      .returning();

    // Parse CSV: expected format "email,displayName,role" (header row optional)
    const lines = csv
      .trim()
      .split("\n")
      .map((line: string) => line.trim())
      .filter(Boolean);
    const hasHeader = lines[0]?.toLowerCase().startsWith("email");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const created: Array<{ email: string; displayName: string; role: string }> = [];
    const skippedExisting: Array<{ email: string; reason: string }> = [];
    const errors: Array<{ line: number; raw: string; error: string }> = [];

    for (let i = 0; i < dataLines.length; i++) {
      const raw = dataLines[i];
      const parts = raw.split(",").map((p: string) => p.trim());
      const email = parts[0];
      const displayName = parts[1] || email?.split("@")[0] || "User";
      const role = parts[2] || defaultRole;

      if (!email || !z.string().email().safeParse(email).success) {
        errors.push({ line: i + 1, raw, error: `Invalid email: ${email}` });
        continue;
      }

      try {
        // Check if user already exists
        const existing = await db.select().from(users).where(eq(users.email, email));

        let userId: string;
        if (existing.length > 0) {
          userId = existing[0].id;
        } else {
          const [newUser] = await db.insert(users).values({ email }).returning();
          userId = newUser.id;
        }

        // Check if profile already exists in this org
        const existingProfile = await db
          .select()
          .from(userProfiles)
          .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

        if (existingProfile.length > 0) {
          skippedExisting.push({ email, reason: "Profile already exists in org" });
          continue;
        }

        await db.insert(userProfiles).values({
          userId,
          orgId,
          displayName,
          role,
        });

        created.push({ email, displayName, role });
      } catch (err) {
        errors.push({
          line: i + 1,
          raw,
          error: err instanceof Error ? err.message : `Failed to create user: ${email}`,
        });
      }

      // Update progress
      if ((i + 1) % 25 === 0) {
        await db
          .update(dataJobs)
          .set({
            progressPct: Math.round(((i + 1) / dataLines.length) * 100),
            updatedAt: new Date(),
          })
          .where(eq(dataJobs.id, job.id));
      }
    }

    // Finalize job
    await db
      .update(dataJobs)
      .set({
        status: errors.length > 0 && created.length === 0 ? "failed" : "completed",
        progressPct: 100,
        metadata: {
          sendInvites,
          defaultRole,
          totalLines: dataLines.length,
          created: created.length,
          skippedExisting: skippedExisting.length,
          errorCount: errors.length,
        },
        errorMessage:
          errors.length > 0
            ? `${errors.length} row(s) had errors`
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(dataJobs.id, job.id));

    await writeAuditLog({
      orgId,
      actorId: adminId,
      actorType: "user",
      action: "import.csv_users",
      resourceType: "user",
      resourceId: orgId,
      details: {
        jobId: job.id,
        totalProcessed: dataLines.length,
        created: created.length,
        skippedExisting: skippedExisting.length,
        errors: errors.length,
      },
    });

    return c.json(
      {
        importId: job.id,
        created,
        skippedExisting,
        errors: errors.slice(0, 50),
        total: dataLines.length,
      },
      201,
    );
  },
);

// ---------------------------------------------------------------------------
// GET /import/status/:importId - Check import job status
// ---------------------------------------------------------------------------
importRoutes.get(
  "/status/:importId",
  zValidator("param", z.object({ importId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const { importId } = c.req.valid("param");

    const [job] = await db
      .select()
      .from(dataJobs)
      .where(and(eq(dataJobs.id, importId), eq(dataJobs.orgId, orgId)));

    if (!job) throw AppError.notFound("Import job");

    // Only the job owner or an admin can view import status
    // (admin check would need role lookup; for now allow job owner + same org)
    if (job.userId !== userId) {
      // Allow org members to see their own jobs only
      throw AppError.forbidden("You can only view your own import jobs");
    }

    if (
      job.type !== "import_chatgpt" &&
      job.type !== "import_claude" &&
      job.type !== "import_csv_users"
    ) {
      throw AppError.notFound("Import job");
    }

    return c.json({
      importId: job.id,
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

export { importRoutes };
