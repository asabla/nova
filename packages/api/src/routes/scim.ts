import { Hono } from "hono";
import { eq, and, isNull, ilike } from "drizzle-orm";
import { db } from "../lib/db";
import { logger } from "../lib/logger";
import { users, userProfiles, groups, groupMemberships, orgSettings } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

/**
 * SCIM 2.0 provisioning endpoints.
 *
 * These endpoints use bearer token authentication (not session cookies).
 * The SCIM token is stored in org_settings with key "scim_bearer_token".
 *
 * See: https://datatracker.ietf.org/doc/html/rfc7644
 */

const scimRoutes = new Hono();

// --- SCIM Auth middleware ---

async function authenticateScim(c: any): Promise<{ orgId: string }> {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw AppError.unauthorized("SCIM bearer token required");
  }
  const token = auth.slice(7);

  // Find org with matching SCIM token
  const [setting] = await db
    .select({ orgId: orgSettings.orgId })
    .from(orgSettings)
    .where(and(eq(orgSettings.key, "scim_bearer_token"), eq(orgSettings.value, token)));

  if (!setting) throw AppError.unauthorized("Invalid SCIM token");
  return { orgId: setting.orgId };
}

// --- SCIM Users ---

// GET /scim/v2/Users
scimRoutes.get("/Users", async (c) => {
  const { orgId } = await authenticateScim(c);
  const filter = c.req.query("filter");
  const startIndex = Number(c.req.query("startIndex") ?? 1);
  const count = Math.min(Number(c.req.query("count") ?? 100), 200);

  let emailFilter: string | undefined;
  if (filter) {
    // Parse simple SCIM filter: userName eq "user@example.com"
    const match = filter.match(/userName\s+eq\s+"([^"]+)"/i);
    if (match) emailFilter = match[1];
  }

  const conditions = [eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)];
  if (emailFilter) {
    conditions.push(eq(users.email, emailFilter.toLowerCase()));
  }

  const profiles = await db
    .select({
      userId: userProfiles.userId,
      email: users.email,
      displayName: userProfiles.displayName,
      role: userProfiles.role,
      isActive: users.isActive,
    })
    .from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .where(and(...conditions))
    .limit(count)
    .offset(startIndex - 1);

  return c.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: profiles.length,
    startIndex,
    itemsPerPage: count,
    Resources: profiles.map((p) => toScimUser(p)),
  });
});

// GET /scim/v2/Users/:id
scimRoutes.get("/Users/:id", async (c) => {
  const { orgId } = await authenticateScim(c);
  const userId = c.req.param("id");

  const [profile] = await db
    .select({
      userId: userProfiles.userId,
      email: users.email,
      displayName: userProfiles.displayName,
      role: userProfiles.role,
      isActive: users.isActive,
    })
    .from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt)));

  if (!profile) throw AppError.notFound("User not found");
  return c.json(toScimUser(profile));
});

// POST /scim/v2/Users - Provision new user
scimRoutes.post("/Users", async (c) => {
  const { orgId } = await authenticateScim(c);
  const body = await c.req.json();

  const email = body.userName?.toLowerCase() ?? body.emails?.[0]?.value?.toLowerCase();
  if (!email) throw AppError.badRequest("userName (email) is required");

  const displayName = body.displayName ?? body.name?.formatted
    ?? `${body.name?.givenName ?? ""} ${body.name?.familyName ?? ""}`.trim() || email.split("@")[0];

  // Find or create user
  let [existingUser] = await db.select().from(users).where(eq(users.email, email));

  if (!existingUser) {
    [existingUser] = await db.insert(users).values({
      email,
      emailVerifiedAt: new Date(),
    }).returning();
  }

  // Create profile in this org (if not exists)
  const [existingProfile] = await db
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, existingUser.id), eq(userProfiles.orgId, orgId)));

  if (!existingProfile) {
    await db.insert(userProfiles).values({
      userId: existingUser.id,
      orgId,
      displayName,
      role: "member",
    });
  }

  const [profile] = await db
    .select({
      userId: userProfiles.userId,
      email: users.email,
      displayName: userProfiles.displayName,
      role: userProfiles.role,
      isActive: users.isActive,
    })
    .from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .where(and(eq(userProfiles.userId, existingUser.id), eq(userProfiles.orgId, orgId)));

  return c.json(toScimUser(profile!), 201);
});

// PATCH /scim/v2/Users/:id - Update user (active status, name)
scimRoutes.patch("/Users/:id", async (c) => {
  const { orgId } = await authenticateScim(c);
  const userId = c.req.param("id");
  const body = await c.req.json();

  // Handle SCIM PATCH operations
  const ops = body.Operations ?? [];
  for (const op of ops) {
    if (op.op === "replace" || op.op === "Replace") {
      const value = op.value;
      if (value?.active === false) {
        // Deactivate: soft-delete the profile
        await db.update(userProfiles).set({ deletedAt: new Date() })
          .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));
      } else if (value?.active === true) {
        // Reactivate
        await db.update(userProfiles).set({ deletedAt: null, updatedAt: new Date() })
          .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));
      }
      if (value?.displayName) {
        await db.update(userProfiles).set({ displayName: value.displayName, updatedAt: new Date() })
          .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));
      }
    }
  }

  // Return updated user
  const [profile] = await db
    .select({
      userId: userProfiles.userId,
      email: users.email,
      displayName: userProfiles.displayName,
      role: userProfiles.role,
      isActive: users.isActive,
    })
    .from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

  if (!profile) throw AppError.notFound("User not found");
  return c.json(toScimUser(profile));
});

// DELETE /scim/v2/Users/:id - Deprovision user
scimRoutes.delete("/Users/:id", async (c) => {
  const { orgId } = await authenticateScim(c);
  const userId = c.req.param("id");

  await db.update(userProfiles).set({ deletedAt: new Date() })
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.orgId, orgId)));

  return c.body(null, 204);
});

// --- SCIM Groups ---

// GET /scim/v2/Groups
scimRoutes.get("/Groups", async (c) => {
  const { orgId } = await authenticateScim(c);

  const orgGroups = await db
    .select()
    .from(groups)
    .where(and(eq(groups.orgId, orgId), isNull(groups.deletedAt)));

  return c.json({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: orgGroups.length,
    Resources: orgGroups.map((g) => toScimGroup(g)),
  });
});

// GET /scim/v2/Groups/:id
scimRoutes.get("/Groups/:id", async (c) => {
  const { orgId } = await authenticateScim(c);
  const [group] = await db.select().from(groups)
    .where(and(eq(groups.id, c.req.param("id")), eq(groups.orgId, orgId), isNull(groups.deletedAt)));

  if (!group) throw AppError.notFound("Group not found");

  // Fetch members
  const members = await db
    .select({ userId: groupMemberships.userId })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, group.id), isNull(groupMemberships.deletedAt)));

  return c.json(toScimGroup(group, members.map((m) => m.userId)));
});

// POST /scim/v2/Groups - Create group
scimRoutes.post("/Groups", async (c) => {
  const { orgId } = await authenticateScim(c);
  const body = await c.req.json();

  const [group] = await db.insert(groups).values({
    orgId,
    name: body.displayName,
    description: body.externalId ? `SCIM: ${body.externalId}` : undefined,
    ssoGroupId: body.externalId ?? body.id,
  }).returning();

  // Add members if provided
  const memberIds = (body.members ?? []).map((m: any) => m.value);
  for (const userId of memberIds) {
    await db.insert(groupMemberships).values({ groupId: group.id, userId, orgId }).onConflictDoNothing();
  }

  return c.json(toScimGroup(group, memberIds), 201);
});

// PATCH /scim/v2/Groups/:id - Update group membership
scimRoutes.patch("/Groups/:id", async (c) => {
  const { orgId } = await authenticateScim(c);
  const groupId = c.req.param("id");
  const body = await c.req.json();

  const ops = body.Operations ?? [];
  for (const op of ops) {
    if (op.op === "add" || op.op === "Add") {
      const members = op.value?.members ?? (Array.isArray(op.value) ? op.value : []);
      for (const m of members) {
        await db.insert(groupMemberships).values({ groupId, userId: m.value, orgId }).onConflictDoNothing();
      }
    } else if (op.op === "remove" || op.op === "Remove") {
      // Parse path like "members[value eq \"userId\"]"
      const match = op.path?.match(/members\[value\s+eq\s+"([^"]+)"\]/i);
      if (match) {
        await db.update(groupMemberships).set({ deletedAt: new Date() })
          .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, match[1]), eq(groupMemberships.orgId, orgId)));
      }
    } else if (op.op === "replace" || op.op === "Replace") {
      if (op.value?.displayName) {
        await db.update(groups).set({ name: op.value.displayName, updatedAt: new Date() })
          .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId)));
      }
    }
  }

  const [group] = await db.select().from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.orgId, orgId)));
  if (!group) throw AppError.notFound("Group not found");

  const members = await db
    .select({ userId: groupMemberships.userId })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.deletedAt)));

  return c.json(toScimGroup(group, members.map((m) => m.userId)));
});

// DELETE /scim/v2/Groups/:id
scimRoutes.delete("/Groups/:id", async (c) => {
  const { orgId } = await authenticateScim(c);
  await db.update(groups).set({ deletedAt: new Date() })
    .where(and(eq(groups.id, c.req.param("id")), eq(groups.orgId, orgId)));
  return c.body(null, 204);
});

// --- SCIM Helpers ---

function toScimUser(p: { userId: string; email: string; displayName: string | null; role: string; isActive: boolean }) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: p.userId,
    userName: p.email,
    displayName: p.displayName ?? p.email.split("@")[0],
    name: { formatted: p.displayName ?? p.email.split("@")[0] },
    emails: [{ value: p.email, type: "work", primary: true }],
    active: p.isActive,
    roles: [{ value: p.role }],
    meta: { resourceType: "User" },
  };
}

function toScimGroup(g: any, memberIds?: string[]) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    id: g.id,
    displayName: g.name,
    externalId: g.ssoGroupId,
    members: (memberIds ?? []).map((id) => ({ value: id, $ref: `../Users/${id}` })),
    meta: { resourceType: "Group" },
  };
}

export { scimRoutes };
