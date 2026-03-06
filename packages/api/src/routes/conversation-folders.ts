import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { conversationFolders, conversationTags, conversationTagAssignments } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

const folderRoutes = new Hono<AppContext>();

// --- Folders ---

folderRoutes.get("/folders", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const folders = await db
    .select()
    .from(conversationFolders)
    .where(and(
      eq(conversationFolders.orgId, orgId),
      eq(conversationFolders.userId, userId),
      isNull(conversationFolders.deletedAt),
    ))
    .orderBy(conversationFolders.sortOrder);

  return c.json({ data: folders });
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
      .where(and(
        eq(conversationFolders.id, c.req.param("id")),
        eq(conversationFolders.orgId, orgId),
        eq(conversationFolders.userId, userId),
        isNull(conversationFolders.deletedAt),
      ))
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
    .where(and(
      eq(conversationFolders.id, c.req.param("id")),
      eq(conversationFolders.orgId, orgId),
      eq(conversationFolders.userId, userId),
      isNull(conversationFolders.deletedAt),
    ))
    .returning();

  if (!folder) throw AppError.notFound("Folder");
  return c.json({ ok: true });
});

// --- Tags ---

folderRoutes.get("/tags", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");

  const tags = await db
    .select()
    .from(conversationTags)
    .where(and(
      eq(conversationTags.orgId, orgId),
      eq(conversationTags.userId, userId),
      isNull(conversationTags.deletedAt),
    ))
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
      .where(and(
        eq(conversationTags.id, c.req.param("id")),
        eq(conversationTags.orgId, orgId),
        eq(conversationTags.userId, userId),
        isNull(conversationTags.deletedAt),
      ))
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
    .where(and(
      eq(conversationTags.id, c.req.param("id")),
      eq(conversationTags.orgId, orgId),
      eq(conversationTags.userId, userId),
      isNull(conversationTags.deletedAt),
    ))
    .returning();

  if (!tag) throw AppError.notFound("Tag");
  return c.json({ ok: true });
});

// --- Assign tags/folders to conversations ---

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
    .where(and(
      eq(conversationTagAssignments.id, c.req.param("id")),
      eq(conversationTagAssignments.orgId, orgId),
      isNull(conversationTagAssignments.deletedAt),
    ))
    .returning();

  if (!assignment) throw AppError.notFound("Assignment");
  return c.json({ ok: true });
});

// Bulk operations on conversations
const bulkSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["archive", "delete", "move_to_folder"]),
  folderId: z.string().uuid().optional(),
});

folderRoutes.post("/bulk", zValidator("json", bulkSchema), async (c) => {
  const orgId = c.get("orgId");
  const { conversationIds, action, folderId } = c.req.valid("json");
  const { conversations } = await import("@nova/shared/schemas");

  let affected = 0;
  for (const convId of conversationIds) {
    if (action === "archive") {
      const [r] = await db.update(conversations).set({ isArchived: true, updatedAt: new Date() })
        .where(and(eq(conversations.id, convId), eq(conversations.orgId, orgId)))
        .returning();
      if (r) affected++;
    } else if (action === "delete") {
      const [r] = await db.update(conversations).set({ deletedAt: new Date() })
        .where(and(eq(conversations.id, convId), eq(conversations.orgId, orgId)))
        .returning();
      if (r) affected++;
    } else if (action === "move_to_folder" && folderId) {
      const [r] = await db.insert(conversationTagAssignments)
        .values({ conversationId: convId, conversationFolderId: folderId, orgId })
        .returning();
      if (r) affected++;
    }
  }

  return c.json({ affected });
});

export { folderRoutes };
