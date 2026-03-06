import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { organisations, orgSettings, users, groups, groupMemberships, invitations } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

export const orgService = {
  async get(orgId: string) {
    const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId));
    if (!org) throw AppError.notFound("Organization not found");
    return org;
  },

  async update(orgId: string, data: Partial<{ name: string; slug: string; logoUrl: string }>) {
    const [org] = await db
      .update(organisations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organisations.id, orgId))
      .returning();
    if (!org) throw AppError.notFound("Organization not found");
    return org;
  },

  async getSettings(orgId: string) {
    const [settings] = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId));
    return settings ?? {};
  },

  async updateSettings(orgId: string, data: Record<string, unknown>) {
    const [existing] = await db.select().from(orgSettings).where(eq(orgSettings.orgId, orgId));
    if (existing) {
      const [settings] = await db
        .update(orgSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(orgSettings.orgId, orgId))
        .returning();
      return settings;
    }
    const [settings] = await db
      .insert(orgSettings)
      .values({ orgId, ...data })
      .returning();
    return settings;
  },

  async listMembers(orgId: string) {
    return db.select().from(users).where(eq(users.orgId, orgId));
  },

  async updateMemberRole(orgId: string, userId: string, role: string) {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
      .returning();
    if (!user) throw AppError.notFound("User not found");
    return user;
  },

  async removeMember(orgId: string, userId: string) {
    const [user] = await db
      .update(users)
      .set({ orgId: null, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
      .returning();
    if (!user) throw AppError.notFound("User not found");
    return user;
  },

  async createInvitation(orgId: string, invitedBy: string, data: { email: string; role?: string }) {
    const [invitation] = await db
      .insert(invitations)
      .values({
        orgId,
        invitedBy,
        email: data.email,
        role: data.role ?? "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning();
    return invitation;
  },

  async listInvitations(orgId: string) {
    return db.select().from(invitations)
      .where(and(eq(invitations.orgId, orgId), eq(invitations.status, "pending")))
      .orderBy(desc(invitations.createdAt));
  },

  async revokeInvitation(orgId: string, invitationId: string) {
    const [invitation] = await db
      .update(invitations)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(and(eq(invitations.id, invitationId), eq(invitations.orgId, orgId)))
      .returning();
    if (!invitation) throw AppError.notFound("Invitation not found");
    return invitation;
  },

  async listGroups(orgId: string) {
    return db.select().from(groups).where(eq(groups.orgId, orgId)).orderBy(desc(groups.createdAt));
  },

  async createGroup(orgId: string, data: { name: string; description?: string }) {
    const [group] = await db
      .insert(groups)
      .values({ orgId, name: data.name, description: data.description })
      .returning();
    return group;
  },

  async deleteGroup(orgId: string, groupId: string) {
    await db.delete(groupMemberships).where(eq(groupMemberships.groupId, groupId));
    const [group] = await db
      .delete(groups)
      .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId)))
      .returning();
    if (!group) throw AppError.notFound("Group not found");
    return group;
  },
};
