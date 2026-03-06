import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { agentTools, agentMcpServers, agentSkills, agentKnowledgeCollections, agentVersions, agents } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const agentToolRoutes = new Hono<AppContext>();

// --- Agent Tools ---

agentToolRoutes.get("/:agentId/tools", async (c) => {
  const orgId = c.get("orgId");
  const tools = await db
    .select()
    .from(agentTools)
    .where(and(eq(agentTools.agentId, c.req.param("agentId")), eq(agentTools.orgId, orgId), isNull(agentTools.deletedAt)));

  return c.json({ data: tools });
});

agentToolRoutes.post(
  "/:agentId/tools",
  zValidator("json", z.object({ toolId: z.string().uuid(), configOverrides: z.record(z.any()).optional() })),
  async (c) => {
    const orgId = c.get("orgId");
    const agentId = c.req.param("agentId");
    const data = c.req.valid("json");

    const [tool] = await db
      .insert(agentTools)
      .values({ agentId, toolId: data.toolId, orgId, configOverrides: data.configOverrides })
      .onConflictDoNothing()
      .returning();

    if (!tool) throw AppError.conflict("Tool already attached");
    return c.json(tool, 201);
  },
);

agentToolRoutes.delete("/:agentId/tools/:toolId", async (c) => {
  const orgId = c.get("orgId");
  const [tool] = await db
    .update(agentTools)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(agentTools.agentId, c.req.param("agentId")),
      eq(agentTools.toolId, c.req.param("toolId")),
      eq(agentTools.orgId, orgId),
      isNull(agentTools.deletedAt),
    ))
    .returning();

  if (!tool) throw AppError.notFound("Agent tool");
  return c.json({ ok: true });
});

// --- Agent MCP Servers ---

agentToolRoutes.get("/:agentId/mcp-servers", async (c) => {
  const orgId = c.get("orgId");
  const servers = await db
    .select()
    .from(agentMcpServers)
    .where(and(eq(agentMcpServers.agentId, c.req.param("agentId")), eq(agentMcpServers.orgId, orgId), isNull(agentMcpServers.deletedAt)));

  return c.json({ data: servers });
});

agentToolRoutes.post(
  "/:agentId/mcp-servers",
  zValidator("json", z.object({ mcpServerId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const agentId = c.req.param("agentId");
    const { mcpServerId } = c.req.valid("json");

    const [server] = await db
      .insert(agentMcpServers)
      .values({ agentId, mcpServerId, orgId })
      .onConflictDoNothing()
      .returning();

    if (!server) throw AppError.conflict("MCP server already attached");
    return c.json(server, 201);
  },
);

agentToolRoutes.delete("/:agentId/mcp-servers/:mcpServerId", async (c) => {
  const orgId = c.get("orgId");
  const [server] = await db
    .update(agentMcpServers)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(agentMcpServers.agentId, c.req.param("agentId")),
      eq(agentMcpServers.mcpServerId, c.req.param("mcpServerId")),
      eq(agentMcpServers.orgId, orgId),
      isNull(agentMcpServers.deletedAt),
    ))
    .returning();

  if (!server) throw AppError.notFound("Agent MCP server");
  return c.json({ ok: true });
});

// --- Agent Skills ---

agentToolRoutes.get("/:agentId/skills", async (c) => {
  const orgId = c.get("orgId");
  const skills = await db
    .select()
    .from(agentSkills)
    .where(and(eq(agentSkills.agentId, c.req.param("agentId")), eq(agentSkills.orgId, orgId), isNull(agentSkills.deletedAt)));

  return c.json({ data: skills });
});

agentToolRoutes.post(
  "/:agentId/skills",
  zValidator("json", z.object({ skillName: z.string().min(1), config: z.record(z.any()).optional() })),
  async (c) => {
    const orgId = c.get("orgId");
    const agentId = c.req.param("agentId");
    const data = c.req.valid("json");

    const [skill] = await db
      .insert(agentSkills)
      .values({ agentId, skillName: data.skillName, config: data.config, orgId })
      .onConflictDoNothing()
      .returning();

    if (!skill) throw AppError.conflict("Skill already attached");
    return c.json(skill, 201);
  },
);

agentToolRoutes.delete("/:agentId/skills/:skillName", async (c) => {
  const orgId = c.get("orgId");
  const [skill] = await db
    .update(agentSkills)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(agentSkills.agentId, c.req.param("agentId")),
      eq(agentSkills.skillName, c.req.param("skillName")),
      eq(agentSkills.orgId, orgId),
      isNull(agentSkills.deletedAt),
    ))
    .returning();

  if (!skill) throw AppError.notFound("Agent skill");
  return c.json({ ok: true });
});

// --- Agent Knowledge Collections ---

agentToolRoutes.get("/:agentId/knowledge", async (c) => {
  const orgId = c.get("orgId");
  const collections = await db
    .select()
    .from(agentKnowledgeCollections)
    .where(and(
      eq(agentKnowledgeCollections.agentId, c.req.param("agentId")),
      eq(agentKnowledgeCollections.orgId, orgId),
      isNull(agentKnowledgeCollections.deletedAt),
    ));

  return c.json({ data: collections });
});

agentToolRoutes.post(
  "/:agentId/knowledge",
  zValidator("json", z.object({ knowledgeCollectionId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get("orgId");
    const agentId = c.req.param("agentId");
    const { knowledgeCollectionId } = c.req.valid("json");

    const [collection] = await db
      .insert(agentKnowledgeCollections)
      .values({ agentId, knowledgeCollectionId, orgId })
      .returning();

    return c.json(collection, 201);
  },
);

agentToolRoutes.delete("/:agentId/knowledge/:collectionId", async (c) => {
  const orgId = c.get("orgId");
  const [collection] = await db
    .update(agentKnowledgeCollections)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(agentKnowledgeCollections.agentId, c.req.param("agentId")),
      eq(agentKnowledgeCollections.knowledgeCollectionId, c.req.param("collectionId")),
      eq(agentKnowledgeCollections.orgId, orgId),
      isNull(agentKnowledgeCollections.deletedAt),
    ))
    .returning();

  if (!collection) throw AppError.notFound("Agent knowledge collection");
  return c.json({ ok: true });
});

// --- Agent Versions ---

agentToolRoutes.get("/:agentId/versions", async (c) => {
  const orgId = c.get("orgId");
  const versions = await db
    .select()
    .from(agentVersions)
    .where(and(eq(agentVersions.agentId, c.req.param("agentId")), eq(agentVersions.orgId, orgId)))
    .orderBy(desc(agentVersions.version));

  return c.json({ data: versions });
});

agentToolRoutes.post(
  "/:agentId/versions",
  zValidator("json", z.object({ changelog: z.string().max(2000).optional() })),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const agentId = c.req.param("agentId");
    const { changelog } = c.req.valid("json");

    // Get current agent state
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId), isNull(agents.deletedAt)));

    if (!agent) throw AppError.notFound("Agent");

    const nextVersion = agent.currentVersion + 1;

    const [version] = await db
      .insert(agentVersions)
      .values({
        agentId,
        orgId,
        version: nextVersion,
        systemPrompt: agent.systemPrompt,
        modelId: agent.modelId,
        modelParams: agent.modelParams,
        configSnapshot: {
          name: agent.name,
          description: agent.description,
          visibility: agent.visibility,
          toolApprovalMode: agent.toolApprovalMode,
          memoryScope: agent.memoryScope,
          maxSteps: agent.maxSteps,
          timeoutSeconds: agent.timeoutSeconds,
        },
        changelog,
      })
      .returning();

    // Update agent's current version
    await db
      .update(agents)
      .set({ currentVersion: nextVersion, updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    await writeAuditLog({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "agent.version.create",
      resourceType: "agent",
      resourceId: agentId,
      details: { version: nextVersion, changelog },
    });

    return c.json(version, 201);
  },
);

// Restore a version
agentToolRoutes.post("/:agentId/versions/:versionId/restore", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const agentId = c.req.param("agentId");

  const [version] = await db
    .select()
    .from(agentVersions)
    .where(and(eq(agentVersions.id, c.req.param("versionId")), eq(agentVersions.agentId, agentId), eq(agentVersions.orgId, orgId)));

  if (!version) throw AppError.notFound("Agent version");

  const config = version.configSnapshot as Record<string, unknown>;
  await db
    .update(agents)
    .set({
      systemPrompt: version.systemPrompt,
      modelId: version.modelId,
      modelParams: version.modelParams,
      name: config.name as string,
      description: config.description as string | undefined,
      visibility: config.visibility as string,
      toolApprovalMode: config.toolApprovalMode as string,
      memoryScope: config.memoryScope as string,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId));

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "agent.version.restore",
    resourceType: "agent",
    resourceId: agentId,
    details: { restoredVersion: version.version },
  });

  return c.json({ ok: true, restoredVersion: version.version });
});

export { agentToolRoutes };
