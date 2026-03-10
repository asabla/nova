import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { workspaceService } from "../services/workspace.service";
import { writeAuditLog } from "../services/audit.service";
import { parsePagination, buildPaginatedResponse, AppError } from "@nova/shared/utils";
import { db } from "../lib/db";
import {
  workspaces,
  workspaceMemberships,
  conversations,
  files,
  auditLogs,
  users,
  userProfiles,
  invitations,
  knowledgeCollections,
} from "@nova/shared/schemas";
import { notificationService } from "../services/notification.service";

const workspaceRoutes = new Hono<AppContext>();

// --- List / Get ---

workspaceRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { limit, offset } = parsePagination(c.req.query());
  const result = await workspaceService.list(orgId, userId, { limit, offset });
  return c.json(result);
});

workspaceRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const workspace = await workspaceService.get(orgId, c.req.param("id"));
  return c.json(workspace);
});

// --- Create ---

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

workspaceRoutes.post("/", zValidator("json", createWorkspaceSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const workspace = await workspaceService.create(orgId, userId, body);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "workspace.create", resourceType: "workspace", resourceId: workspace.id });
  return c.json(workspace, 201);
});

// --- Update (name, description, defaults) ---

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  defaultAgentId: z.string().uuid().nullable().optional(),
  defaultModelId: z.string().uuid().nullable().optional(),
  defaultSystemPrompt: z.string().max(10_000).nullable().optional(),
  embeddingModel: z.string().max(200).nullable().optional(),
});

workspaceRoutes.patch("/:id", zValidator("json", updateWorkspaceSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");
  const workspaceId = c.req.param("id");

  // Extract embeddingModel — it goes to the knowledge collection, not the workspace
  const { embeddingModel, ...workspaceData } = data;

  const [workspace] = await db
    .update(workspaces)
    .set({ ...workspaceData, updatedAt: new Date() })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.orgId, orgId), isNull(workspaces.deletedAt)))
    .returning();

  if (!workspace) throw AppError.notFound("Workspace");

  // Update embedding model on the workspace's knowledge collection
  if (embeddingModel !== undefined && workspace.knowledgeCollectionId) {
    await db
      .update(knowledgeCollections)
      .set({ embeddingModel: embeddingModel || null, updatedAt: new Date() })
      .where(and(eq(knowledgeCollections.id, workspace.knowledgeCollectionId), eq(knowledgeCollections.orgId, orgId)));
  }

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "workspace.update",
    resourceType: "workspace",
    resourceId: workspaceId,
    details: { updatedFields: Object.keys(data) },
  });

  return c.json({ ...workspace, embeddingModel: embeddingModel !== undefined ? (embeddingModel || null) : undefined });
});

// --- Archive ---

workspaceRoutes.post("/:id/archive", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  await workspaceService.archive(orgId, workspaceId);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "workspace.archive",
    resourceType: "workspace",
    resourceId: workspaceId,
  });

  return c.json({ ok: true });
});

// --- Unarchive ---

workspaceRoutes.post("/:id/unarchive", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  await workspaceService.unarchive(orgId, workspaceId);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "workspace.unarchive",
    resourceType: "workspace",
    resourceId: workspaceId,
  });

  return c.json({ ok: true });
});

// --- Delete ---

workspaceRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  await workspaceService.delete(orgId, workspaceId);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "workspace.delete", resourceType: "workspace", resourceId: workspaceId });
  return c.body(null, 204);
});

// --- Conversations scoped to workspace ---

const workspaceConversationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  isArchived: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

workspaceRoutes.get("/:id/conversations", zValidator("query", workspaceConversationQuerySchema), async (c) => {
  const orgId = c.get("orgId");
  const workspaceId = c.req.param("id");
  const { page, pageSize, search, isArchived } = c.req.valid("query");
  const { offset, limit } = parsePagination({ page, pageSize });

  // Verify workspace exists and belongs to org
  await workspaceService.get(orgId, workspaceId);

  const conditions = [
    eq(conversations.orgId, orgId),
    eq(conversations.workspaceId, workspaceId),
    isNull(conversations.deletedAt),
  ];

  if (search) {
    const { ilike } = await import("drizzle-orm");
    conditions.push(ilike(conversations.title, `%${search}%`));
  }
  if (isArchived !== undefined) {
    conditions.push(eq(conversations.isArchived, isArchived));
  }

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.select().from(conversations).where(where).orderBy(desc(conversations.updatedAt)).offset(offset).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(conversations).where(where),
  ]);

  return c.json(buildPaginatedResponse(data, countResult[0]?.count ?? 0, { offset, limit, page: page ?? 1, pageSize: pageSize ?? 20 }));
});

const createWorkspaceConversationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  modelId: z.string().uuid().optional(),
  visibility: z.enum(["private", "team", "public"]).optional(),
});

workspaceRoutes.post("/:id/conversations", zValidator("json", createWorkspaceConversationSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const workspaceId = c.req.param("id");
  const data = c.req.valid("json");

  // Verify workspace exists
  const workspace = await workspaceService.get(orgId, workspaceId);

  const { createConversation } = await import("../services/conversation.service");

  const conversation = await createConversation(orgId, userId, {
    ...data,
    workspaceId,
    // Apply workspace defaults if not provided
    systemPrompt: data.systemPrompt ?? workspace.defaultSystemPrompt ?? undefined,
    modelId: data.modelId ?? workspace.defaultModelId ?? undefined,
  });

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "conversation.create",
    resourceType: "conversation",
    resourceId: conversation.id,
    details: { workspaceId },
  });

  return c.json(conversation, 201);
});

// --- Files scoped to workspace ---

workspaceRoutes.get("/:id/files", async (c) => {
  const orgId = c.get("orgId");
  const workspaceId = c.req.param("id");
  const page = Number(c.req.query("page") ?? 1);
  const pageSize = Math.min(Number(c.req.query("pageSize") ?? 20), 100);
  const { offset, limit } = parsePagination({ page, pageSize });

  // Verify workspace exists
  await workspaceService.get(orgId, workspaceId);

  const where = and(
    eq(files.orgId, orgId),
    eq(files.workspaceId, workspaceId),
    isNull(files.deletedAt),
  );

  const [data, countResult] = await Promise.all([
    db.select({
      id: files.id,
      orgId: files.orgId,
      userId: files.userId,
      workspaceId: files.workspaceId,
      filename: files.filename,
      contentType: files.contentType,
      sizeBytes: files.sizeBytes,
      storagePath: files.storagePath,
      storageBucket: files.storageBucket,
      createdAt: files.createdAt,
      updatedAt: files.updatedAt,
      deletedAt: files.deletedAt,
      uploaderName: userProfiles.displayName,
      uploaderEmail: users.email,
    })
      .from(files)
      .leftJoin(users, eq(users.id, files.userId))
      .leftJoin(userProfiles, and(
        eq(userProfiles.userId, files.userId),
        eq(userProfiles.orgId, files.orgId),
      ))
      .where(where)
      .orderBy(desc(files.createdAt))
      .offset(offset)
      .limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(files).where(where),
  ]);

  return c.json(buildPaginatedResponse(data, countResult[0]?.count ?? 0, { offset, limit, page, pageSize }));
});

// --- Members ---

workspaceRoutes.get("/:id/members", async (c) => {
  const orgId = c.get("orgId");
  const workspaceId = c.req.param("id");

  // Verify workspace exists
  await workspaceService.get(orgId, workspaceId);

  const members = await db
    .select({
      id: workspaceMemberships.id,
      userId: workspaceMemberships.userId,
      groupId: workspaceMemberships.groupId,
      role: workspaceMemberships.role,
      userName: userProfiles.displayName,
      userEmail: users.email,
      joinedAt: workspaceMemberships.createdAt,
    })
    .from(workspaceMemberships)
    .leftJoin(users, eq(users.id, workspaceMemberships.userId))
    .leftJoin(userProfiles, and(
      eq(userProfiles.userId, workspaceMemberships.userId),
      eq(userProfiles.orgId, workspaceMemberships.orgId),
    ))
    .where(and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.orgId, orgId),
      isNull(workspaceMemberships.deletedAt),
    ))
    .orderBy(desc(workspaceMemberships.createdAt));

  return c.json({ data: members });
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).optional().default("member"),
});

workspaceRoutes.post("/:id/members/invite", zValidator("json", inviteMemberSchema), async (c) => {
  const orgId = c.get("orgId");
  const actorId = c.get("userId");
  const workspaceId = c.req.param("id");
  const { email, role } = c.req.valid("json");

  // Verify workspace exists
  await workspaceService.get(orgId, workspaceId);

  // Look up user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    // User not in the system yet - create an invitation record
    const tokenHash = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db.insert(invitations).values({
      orgId,
      email,
      role,
      invitedById: actorId,
      tokenHash,
      expiresAt,
      groupIds: JSON.stringify({ workspaceId }),
    }).returning();

    await writeAuditLog({
      orgId,
      actorId,
      actorType: "user",
      action: "workspace.member.invite",
      resourceType: "workspace",
      resourceId: workspaceId,
      details: { email, role, invitationId: invitation.id },
    });

    return c.json({ status: "invited", email, invitationId: invitation.id }, 201);
  }

  // User exists, add them directly
  const membership = await workspaceService.addMember(orgId, workspaceId, user.id, role);

  // Notify the invited user
  await notificationService.create({
    orgId,
    userId: user.id,
    type: "workspace_invite",
    title: "Workspace invitation",
    body: `You have been added to a workspace`,
    resourceType: "workspace",
    resourceId: workspaceId,
  });

  await writeAuditLog({
    orgId,
    actorId,
    actorType: "user",
    action: "workspace.member.add",
    resourceType: "workspace",
    resourceId: workspaceId,
    details: { userId: user.id, email, role },
  });

  return c.json({ status: "added", membership }, 201);
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

workspaceRoutes.patch("/:id/members/:memberId", zValidator("json", updateMemberRoleSchema), async (c) => {
  const orgId = c.get("orgId");
  const actorId = c.get("userId");
  const workspaceId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const { role } = c.req.valid("json");

  const [membership] = await db
    .update(workspaceMemberships)
    .set({ role, updatedAt: new Date() })
    .where(and(
      eq(workspaceMemberships.id, memberId),
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.orgId, orgId),
      isNull(workspaceMemberships.deletedAt),
    ))
    .returning();

  if (!membership) throw AppError.notFound("Membership");

  await writeAuditLog({
    orgId,
    actorId,
    actorType: "user",
    action: "workspace.member.role.update",
    resourceType: "workspace",
    resourceId: workspaceId,
    details: { memberId, role },
  });

  return c.json(membership);
});

workspaceRoutes.delete("/:id/members/:memberId", async (c) => {
  const orgId = c.get("orgId");
  const actorId = c.get("userId");
  const workspaceId = c.req.param("id");
  const memberId = c.req.param("memberId");

  const [membership] = await db
    .update(workspaceMemberships)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(workspaceMemberships.id, memberId),
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.orgId, orgId),
      isNull(workspaceMemberships.deletedAt),
    ))
    .returning();

  if (!membership) throw AppError.notFound("Membership");

  await writeAuditLog({
    orgId,
    actorId,
    actorType: "user",
    action: "workspace.member.remove",
    resourceType: "workspace",
    resourceId: workspaceId,
    details: { memberId, userId: membership.userId },
  });

  return c.body(null, 204);
});

// --- Activity feed ---

workspaceRoutes.get("/:id/activity", async (c) => {
  const orgId = c.get("orgId");
  const workspaceId = c.req.param("id");
  const page = Number(c.req.query("page") ?? 1);
  const pageSize = Math.min(Number(c.req.query("pageSize") ?? 30), 100);
  const offset = (page - 1) * pageSize;

  // Verify workspace exists
  await workspaceService.get(orgId, workspaceId);

  // Fetch audit log entries related to this workspace
  const where = and(
    eq(auditLogs.orgId, orgId),
    eq(auditLogs.resourceType, "workspace"),
    eq(auditLogs.resourceId, workspaceId),
  );

  const activitySelect = {
    id: auditLogs.id,
    action: auditLogs.action,
    actorId: auditLogs.actorId,
    actorType: auditLogs.actorType,
    actorName: userProfiles.displayName,
    actorEmail: users.email,
    details: auditLogs.details,
    createdAt: auditLogs.createdAt,
  };

  const [data, countResult] = await Promise.all([
    db
      .select(activitySelect)
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .leftJoin(userProfiles, and(
        eq(userProfiles.userId, auditLogs.actorId),
        eq(userProfiles.orgId, auditLogs.orgId),
      ))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .offset(offset)
      .limit(pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
  ]);

  // Also include conversation-level activity within this workspace
  const conversationActivity = await db
    .select(activitySelect)
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .leftJoin(userProfiles, and(
      eq(userProfiles.userId, auditLogs.actorId),
      eq(userProfiles.orgId, auditLogs.orgId),
    ))
    .innerJoin(conversations, and(
      eq(auditLogs.resourceId, conversations.id),
      eq(auditLogs.resourceType, "conversation"),
    ))
    .where(and(
      eq(conversations.workspaceId, workspaceId),
      eq(auditLogs.orgId, orgId),
    ))
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize);

  // Merge and sort by createdAt desc
  const allActivity = [...data, ...conversationActivity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, pageSize);

  const total = (countResult[0]?.count ?? 0) + conversationActivity.length;

  return c.json({
    data: allActivity,
    total,
    page,
    pageSize,
  });
});

export { workspaceRoutes };
