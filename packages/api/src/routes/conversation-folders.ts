import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import {
  conversationFolders,
  conversationTags,
  conversationTagAssignments,
  conversations,
} from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

const folderRoutes = new Hono<AppContext>();

// ─── Folders ─────────────────────────────────────────────────────────────────

// List all folders with conversation counts
folderRoutes.get("/folders", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const folders = await db
    .select({
      id: conversationFolders.id,
      name: conversationFolders.name,
      parentFolderId: conversationFolders.parentFolderId,
      sortOrder: conversationFolders.sortOrder,
      createdAt: conversationFolders.createdAt,
      updatedAt: conversationFolders.updatedAt,
      conversationCount: sql<number>`(
        SELECT COUNT(*)::int FROM conversation_tag_assignments
        WHERE conversation_folder_id = ${conversationFolders.id}
          AND deleted_at IS NULL
      )`,
    })
    .from(conversationFolders)
    .where(
      and(
        eq(conversationFolders.orgId, orgId),
        eq(conversationFolders.userId, userId),
        isNull(conversationFolders.deletedAt),
      ),
    )
    .orderBy(conversationFolders.sortOrder);

  return c.json({ data: folders });
});

// Get a single folder with its conversations
folderRoutes.get("/folders/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const folderId = c.req.param("id");

  const [folder] = await db
    .select()
    .from(conversationFolders)
    .where(
      and(
        eq(conversationFolders.id, folderId),
        eq(conversationFolders.orgId, orgId),
        eq(conversationFolders.userId, userId),
        isNull(conversationFolders.deletedAt),
      ),
    );

  if (!folder) throw AppError.notFound("Folder");

  // Get conversations in this folder
  const assignments = await db
    .select({
      assignmentId: conversationTagAssignments.id,
      conversationId: conversationTagAssignments.conversationId,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      isArchived: conversations.isArchived,
      modelId: conversations.modelId,
    })
    .from(conversationTagAssignments)
    .innerJoin(
      conversations,
      eq(conversationTagAssignments.conversationId, conversations.id),
    )
    .where(
      and(
        eq(conversationTagAssignments.conversationFolderId, folderId),
        eq(conversationTagAssignments.orgId, orgId),
        isNull(conversationTagAssignments.deletedAt),
        isNull(conversations.deletedAt),
      ),
    )
    .orderBy(desc(conversations.updatedAt));

  return c.json({ ...folder, conversations: assignments });
});

const createFolderSchema = z.object({
  name: z.string().min(1).max(200),
  parentFolderId: z.string().uuid().optional(),
  sortOrder: z.number().int().optional(),
});

folderRoutes.post("/folders", zValidator("json", createFolderSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [folder] = await db
    .insert(conversationFolders)
    .values({ ...data, orgId, userId })
    .returning();

  return c.json(folder, 201);
});

folderRoutes.patch(
  "/folders/:id",
  zValidator("json", createFolderSchema.partial()),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");

    const [folder] = await db
      .update(conversationFolders)
      .set({ ...c.req.valid("json"), updatedAt: new Date() })
      .where(
        and(
          eq(conversationFolders.id, c.req.param("id")),
          eq(conversationFolders.orgId, orgId),
          eq(conversationFolders.userId, userId),
          isNull(conversationFolders.deletedAt),
        ),
      )
      .returning();

    if (!folder) throw AppError.notFound("Folder");
    return c.json(folder);
  },
);

folderRoutes.delete("/folders/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [folder] = await db
    .update(conversationFolders)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(conversationFolders.id, c.req.param("id")),
        eq(conversationFolders.orgId, orgId),
        eq(conversationFolders.userId, userId),
        isNull(conversationFolders.deletedAt),
      ),
    )
    .returning();

  if (!folder) throw AppError.notFound("Folder");

  // Also soft-delete all assignments for this folder
  await db
    .update(conversationTagAssignments)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(conversationTagAssignments.conversationFolderId, c.req.param("id")),
        eq(conversationTagAssignments.orgId, orgId),
        isNull(conversationTagAssignments.deletedAt),
      ),
    );

  return c.json({ ok: true });
});

// ─── Move conversations to/between folders ───────────────────────────────────

const moveSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(100),
  folderId: z.string().uuid(),
});

folderRoutes.post("/folders/move", zValidator("json", moveSchema), async (c) => {
  const orgId = c.get("orgId");
  const { conversationIds, folderId } = c.req.valid("json");

  // Verify folder exists
  const [folder] = await db
    .select()
    .from(conversationFolders)
    .where(
      and(
        eq(conversationFolders.id, folderId),
        eq(conversationFolders.orgId, orgId),
        isNull(conversationFolders.deletedAt),
      ),
    );
  if (!folder) throw AppError.notFound("Folder");

  let moved = 0;
  for (const convId of conversationIds) {
    // Remove existing folder assignments for this conversation
    await db
      .update(conversationTagAssignments)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(conversationTagAssignments.conversationId, convId),
          eq(conversationTagAssignments.orgId, orgId),
          isNull(conversationTagAssignments.deletedAt),
          sql`${conversationTagAssignments.conversationFolderId} IS NOT NULL`,
        ),
      );

    // Create new assignment
    const [r] = await db
      .insert(conversationTagAssignments)
      .values({ conversationId: convId, conversationFolderId: folderId, orgId })
      .returning();
    if (r) moved++;
  }

  return c.json({ moved });
});

// Remove conversations from a folder
const removeFromFolderSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(100),
  folderId: z.string().uuid(),
});

folderRoutes.post(
  "/folders/remove",
  zValidator("json", removeFromFolderSchema),
  async (c) => {
    const orgId = c.get("orgId");
    const { conversationIds, folderId } = c.req.valid("json");

    let removed = 0;
    for (const convId of conversationIds) {
      const [r] = await db
        .update(conversationTagAssignments)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(conversationTagAssignments.conversationId, convId),
            eq(conversationTagAssignments.conversationFolderId, folderId),
            eq(conversationTagAssignments.orgId, orgId),
            isNull(conversationTagAssignments.deletedAt),
          ),
        )
        .returning();
      if (r) removed++;
    }

    return c.json({ removed });
  },
);

// ─── Tags ────────────────────────────────────────────────────────────────────

folderRoutes.get("/tags", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const tags = await db
    .select()
    .from(conversationTags)
    .where(
      and(
        eq(conversationTags.orgId, orgId),
        eq(conversationTags.userId, userId),
        isNull(conversationTags.deletedAt),
      ),
    )
    .orderBy(desc(conversationTags.createdAt));

  return c.json({ data: tags });
});

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

folderRoutes.post("/tags", zValidator("json", createTagSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");

  const [tag] = await db
    .insert(conversationTags)
    .values({ ...data, orgId, userId })
    .returning();

  return c.json(tag, 201);
});

folderRoutes.patch(
  "/tags/:id",
  zValidator("json", createTagSchema.partial()),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");

    const [tag] = await db
      .update(conversationTags)
      .set({ ...c.req.valid("json"), updatedAt: new Date() })
      .where(
        and(
          eq(conversationTags.id, c.req.param("id")),
          eq(conversationTags.orgId, orgId),
          eq(conversationTags.userId, userId),
          isNull(conversationTags.deletedAt),
        ),
      )
      .returning();

    if (!tag) throw AppError.notFound("Tag");
    return c.json(tag);
  },
);

folderRoutes.delete("/tags/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const [tag] = await db
    .update(conversationTags)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(conversationTags.id, c.req.param("id")),
        eq(conversationTags.orgId, orgId),
        eq(conversationTags.userId, userId),
        isNull(conversationTags.deletedAt),
      ),
    )
    .returning();

  if (!tag) throw AppError.notFound("Tag");
  return c.json({ ok: true });
});

// ─── Assign tags/folders to conversations ────────────────────────────────────

const assignSchema = z.object({
  conversationId: z.string().uuid(),
  conversationTagId: z.string().uuid().optional(),
  conversationFolderId: z.string().uuid().optional(),
});

folderRoutes.post("/assign", zValidator("json", assignSchema), async (c) => {
  const orgId = c.get("orgId");
  const data = c.req.valid("json");

  const [assignment] = await db
    .insert(conversationTagAssignments)
    .values({ ...data, orgId })
    .returning();

  return c.json(assignment, 201);
});

folderRoutes.delete("/assign/:id", async (c) => {
  const orgId = c.get("orgId");

  const [assignment] = await db
    .update(conversationTagAssignments)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(conversationTagAssignments.id, c.req.param("id")),
        eq(conversationTagAssignments.orgId, orgId),
        isNull(conversationTagAssignments.deletedAt),
      ),
    )
    .returning();

  if (!assignment) throw AppError.notFound("Assignment");
  return c.json({ ok: true });
});

// ─── Bulk operations ─────────────────────────────────────────────────────────

const bulkSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["archive", "unarchive", "delete", "move_to_folder", "remove_from_folder"]),
  folderId: z.string().uuid().optional(),
});

folderRoutes.post("/bulk", zValidator("json", bulkSchema), async (c) => {
  const orgId = c.get("orgId");
  const { conversationIds, action, folderId } = c.req.valid("json");

  let affected = 0;

  for (const convId of conversationIds) {
    if (action === "archive") {
      const [r] = await db
        .update(conversations)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(and(eq(conversations.id, convId), eq(conversations.orgId, orgId)))
        .returning();
      if (r) affected++;
    } else if (action === "unarchive") {
      const [r] = await db
        .update(conversations)
        .set({ isArchived: false, updatedAt: new Date() })
        .where(and(eq(conversations.id, convId), eq(conversations.orgId, orgId)))
        .returning();
      if (r) affected++;
    } else if (action === "delete") {
      const [r] = await db
        .update(conversations)
        .set({ deletedAt: new Date() })
        .where(and(eq(conversations.id, convId), eq(conversations.orgId, orgId)))
        .returning();
      if (r) affected++;
    } else if (action === "move_to_folder" && folderId) {
      // Remove old folder assignments first
      await db
        .update(conversationTagAssignments)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(conversationTagAssignments.conversationId, convId),
            eq(conversationTagAssignments.orgId, orgId),
            isNull(conversationTagAssignments.deletedAt),
            sql`${conversationTagAssignments.conversationFolderId} IS NOT NULL`,
          ),
        );

      const [r] = await db
        .insert(conversationTagAssignments)
        .values({ conversationId: convId, conversationFolderId: folderId, orgId })
        .returning();
      if (r) affected++;
    } else if (action === "remove_from_folder" && folderId) {
      const [r] = await db
        .update(conversationTagAssignments)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(conversationTagAssignments.conversationId, convId),
            eq(conversationTagAssignments.conversationFolderId, folderId),
            eq(conversationTagAssignments.orgId, orgId),
            isNull(conversationTagAssignments.deletedAt),
          ),
        )
        .returning();
      if (r) affected++;
    }
  }

  return c.json({ affected });
});

export { folderRoutes };
