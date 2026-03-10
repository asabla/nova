import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { workspaces, workspaceMemberships } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

export const workspaceService = {
  async list(orgId: string, userId: string, opts?: { search?: string; limit?: number; offset?: number }) {
    const memberCountSq = db
      .select({ wId: workspaceMemberships.workspaceId, cnt: sql<number>`count(*)::int`.as("cnt") })
      .from(workspaceMemberships)
      .where(isNull(workspaceMemberships.deletedAt))
      .groupBy(workspaceMemberships.workspaceId)
      .as("mc");

    const result = await db
      .select({
        workspace: workspaces,
        memberCount: sql<number>`coalesce(${memberCountSq.cnt}, 0)`.mapWith(Number),
      })
      .from(workspaces)
      .leftJoin(workspaceMemberships, and(
        eq(workspaceMemberships.workspaceId, workspaces.id),
        eq(workspaceMemberships.userId, userId),
      ))
      .leftJoin(memberCountSq, eq(memberCountSq.wId, workspaces.id))
      .where(and(
        eq(workspaces.orgId, orgId),
        eq(workspaces.isArchived, false),
        isNull(workspaces.deletedAt),
      ))
      .orderBy(desc(workspaces.updatedAt))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaces)
      .where(and(eq(workspaces.orgId, orgId), eq(workspaces.isArchived, false), isNull(workspaces.deletedAt)));

    return { data: result.map((r) => ({ ...r.workspace, memberCount: r.memberCount })), total: count };
  },

  async get(orgId: string, workspaceId: string) {
    const memberCountSq = db
      .select({ cnt: sql<number>`count(*)::int`.as("cnt") })
      .from(workspaceMemberships)
      .where(and(
        eq(workspaceMemberships.workspaceId, workspaces.id),
        isNull(workspaceMemberships.deletedAt),
      ));

    const [row] = await db
      .select({
        workspace: workspaces,
        memberCount: sql<number>`coalesce((${memberCountSq}), 0)`.mapWith(Number),
      })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.orgId, orgId), isNull(workspaces.deletedAt)));

    if (!row) throw AppError.notFound("Workspace not found");
    return { ...row.workspace, memberCount: row.memberCount };
  },

  async create(orgId: string, userId: string, data: {
    name: string;
    description?: string;
  }) {
    const [workspace] = await db
      .insert(workspaces)
      .values({
        orgId,
        ownerId: userId,
        name: data.name,
        description: data.description,
      })
      .returning();

    await db.insert(workspaceMemberships).values({
      orgId,
      workspaceId: workspace.id,
      userId,
      role: "admin",
    });

    return workspace;
  },

  async update(orgId: string, workspaceId: string, data: Partial<{
    name: string;
    description: string;
  }>) {
    const [workspace] = await db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.orgId, orgId)))
      .returning();

    if (!workspace) throw AppError.notFound("Workspace not found");
    return workspace;
  },

  async delete(orgId: string, workspaceId: string) {
    const [workspace] = await db
      .update(workspaces)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.orgId, orgId)))
      .returning();

    if (!workspace) throw AppError.notFound("Workspace not found");
    return workspace;
  },

  async archive(orgId: string, workspaceId: string) {
    const [workspace] = await db
      .update(workspaces)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.orgId, orgId)))
      .returning();

    if (!workspace) throw AppError.notFound("Workspace not found");
    return workspace;
  },

  async unarchive(orgId: string, workspaceId: string) {
    const [workspace] = await db
      .update(workspaces)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.orgId, orgId)))
      .returning();

    if (!workspace) throw AppError.notFound("Workspace not found");
    return workspace;
  },

  async addMember(orgId: string, workspaceId: string, userId: string, role: string = "member") {
    const [membership] = await db
      .insert(workspaceMemberships)
      .values({ orgId, workspaceId, userId, role })
      .returning();

    return membership;
  },

  async removeMember(workspaceId: string, userId: string) {
    await db
      .delete(workspaceMemberships)
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.userId, userId)));
  },

  async listMembers(workspaceId: string) {
    return db
      .select()
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.workspaceId, workspaceId));
  },
};
