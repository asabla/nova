import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { organisations, userProfiles, users, groups, groupMemberships, invitations } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { randomBytes, createHash } from "crypto";

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

  async listMembers(orgId: string) {
    return db.select({
      profile: userProfiles,
      user: users,
    })
      .from(userProfiles)
      .innerJoin(users, eq(users.id, userProfiles.userId))
      .where(and(eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)));
  },

  async updateMemberRole(orgId: string, userId: string, role: string) {
    const [profile] = await db
      .update(userProfiles)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)))
      .returning();
    if (!profile) throw AppError.notFound("User not found in this organization");
    return profile;
  },

  async removeMember(orgId: string, userId: string) {
    const [profile] = await db
      .update(userProfiles)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)))
      .returning();
    if (!profile) throw AppError.notFound("User not found in this organization");
    return profile;
  },

  async createInvitation(orgId: string, invitedById: string, data: { email: string; role?: string }) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const [invitation] = await db
      .insert(invitations)
      .values({
        orgId,
        invitedById,
        email: data.email,
        role: data.role ?? "member",
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning();
    return { ...invitation, token };
  },

  async listInvitations(orgId: string) {
    return db.select().from(invitations)
      .where(and(eq(invitations.orgId, orgId), isNull(invitations.acceptedAt), isNull(invitations.deletedAt)))
      .orderBy(desc(invitations.createdAt));
  },

  async revokeInvitation(orgId: string, invitationId: string) {
    const [invitation] = await db
      .update(invitations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
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
