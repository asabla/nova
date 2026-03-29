import { eq, and, desc, ilike, sql, isNull, or } from "drizzle-orm";
import { db } from "../lib/db";
import { agents, agentVersions, agentSkills, agentTools, agentMcpServers, organisations } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";
import { syncAgentUpsert, syncAgentDelete } from "../lib/qdrant-sync";

export const agentService = {
  async list(orgId: string, opts?: { search?: string; limit?: number; offset?: number }) {
    const conditions = [eq(agents.orgId, orgId), isNull(agents.deletedAt)];
    if (opts?.search) {
      conditions.push(ilike(agents.name, `%${opts.search}%`));
    }

    const result = await db
      .select()
      .from(agents)
      .where(and(...conditions))
      .orderBy(desc(agents.updatedAt))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .where(and(...conditions));

    return { data: result, total: count };
  },

  async get(orgId: string, agentId: string) {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId), isNull(agents.deletedAt)));

    if (!agent) throw AppError.notFound("Agent not found");
    return agent;
  },

  async create(orgId: string, userId: string, data: {
    name: string;
    description?: string;
    systemPrompt?: string;
    modelId?: string;
    modelParams?: Record<string, unknown>;
    visibility?: string;
    toolApprovalMode?: string;
    memoryScope?: string;
    maxSteps?: number;
    timeoutSeconds?: number;
    starters?: string[];
  }) {
    const [agent] = await db
      .insert(agents)
      .values({
        orgId,
        ownerId: userId,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        modelId: data.modelId,
        modelParams: data.modelParams,
        ...(data.visibility && { visibility: data.visibility }),
        ...(data.toolApprovalMode && { toolApprovalMode: data.toolApprovalMode }),
        ...(data.memoryScope && { memoryScope: data.memoryScope }),
        ...(data.maxSteps != null && { maxSteps: data.maxSteps }),
        ...(data.timeoutSeconds != null && { timeoutSeconds: data.timeoutSeconds }),
        ...(data.starters && { starters: data.starters }),
      })
      .returning();

    syncAgentUpsert(agent as any);

    return agent;
  },

  async listPublished(orgId: string, opts?: { search?: string; category?: string; limit?: number; offset?: number }) {
    // Show agents published within the caller's org OR from any system org (platform marketplace)
    const systemOrgSubquery = db.select({ id: organisations.id }).from(organisations).where(eq(organisations.isSystemOrg, true));

    const conditions: any[] = [
      isNull(agents.deletedAt),
      eq(agents.isPublished, true),
      or(
        eq(agents.orgId, orgId),
        sql`${agents.orgId} IN (${systemOrgSubquery})`,
      ),
    ];
    if (opts?.search) {
      conditions.push(ilike(agents.name, `%${opts.search}%`));
    }

    const result = await db
      .select({
        id: agents.id,
        orgId: agents.orgId,
        name: agents.name,
        description: agents.description,
        avatarUrl: agents.avatarUrl,
        visibility: agents.visibility,
        isPublished: agents.isPublished,
        currentVersion: agents.currentVersion,
        ownerId: agents.ownerId,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
        // Computed: is this from the platform or the user's org?
        source: sql<string>`CASE WHEN ${agents.orgId} = ${orgId} THEN 'org' ELSE 'platform' END`.as("source"),
      })
      .from(agents)
      .where(and(...conditions))
      .orderBy(
        sql`CASE WHEN ${agents.orgId} != ${orgId} THEN 0 ELSE 1 END`, // platform first
        desc(agents.updatedAt),
      )
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .where(and(...conditions));

    return { data: result, total: count };
  },

  async installFromMarketplace(agentId: string, targetOrgId: string, userId: string) {
    // Fetch the source agent — must be published and from a system org
    const [sourceAgent] = await db
      .select()
      .from(agents)
      .where(and(
        eq(agents.id, agentId),
        eq(agents.isPublished, true),
        isNull(agents.deletedAt),
      ));

    if (!sourceAgent) throw AppError.notFound("Agent not found in marketplace");

    // Verify source is from a system org
    const [sourceOrg] = await db
      .select({ isSystemOrg: organisations.isSystemOrg })
      .from(organisations)
      .where(eq(organisations.id, sourceAgent.orgId));

    if (!sourceOrg?.isSystemOrg && sourceAgent.orgId !== targetOrgId) {
      throw AppError.forbidden("Can only install agents from the platform marketplace");
    }

    // Clone the agent into the target org
    const { id: _id, orgId: _orgId, ownerId: _ownerId, createdAt: _ca, updatedAt: _ua, deletedAt: _da, isPublished: _ip, ...agentData } = sourceAgent;
    const [clonedAgent] = await db
      .insert(agents)
      .values({
        ...agentData,
        orgId: targetOrgId,
        ownerId: userId,
        clonedFromAgentId: agentId,
        isPublished: false,
        visibility: "private",
      })
      .returning();

    // Clone associated skills
    const skills = await db.select().from(agentSkills).where(eq(agentSkills.agentId, agentId));
    for (const skill of skills) {
      await db.insert(agentSkills).values({
        agentId: clonedAgent.id,
        orgId: targetOrgId,
        skillId: skill.skillId,
      });
    }

    // Clone associated tools
    const toolLinks = await db.select().from(agentTools).where(eq(agentTools.agentId, agentId));
    for (const link of toolLinks) {
      await db.insert(agentTools).values({
        agentId: clonedAgent.id,
        orgId: targetOrgId,
        toolId: link.toolId,
      });
    }

    // Clone associated MCP servers
    const mcpLinks = await db.select().from(agentMcpServers).where(eq(agentMcpServers.agentId, agentId));
    for (const link of mcpLinks) {
      await db.insert(agentMcpServers).values({
        agentId: clonedAgent.id,
        orgId: targetOrgId,
        mcpServerId: link.mcpServerId,
      });
    }

    syncAgentUpsert(clonedAgent as any);
    return clonedAgent;
  },

  async createVersion(orgId: string, agentId: string, data: {
    description?: string;
    snapshot: Record<string, unknown>;
    createdBy: string;
  }) {
    const agent = await this.get(orgId, agentId);
    const nextVersion = (agent.currentVersion ?? 1) + 1;

    const [version] = await db.insert(agentVersions).values({
      agentId,
      orgId,
      version: nextVersion,
      systemPrompt: agent.systemPrompt,
      modelId: agent.modelId,
      modelParams: agent.modelParams,
      configSnapshot: data.snapshot,
      changelog: data.description,
    }).returning();

    await db.update(agents).set({ currentVersion: nextVersion, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)));

    return version;
  },

  async listVersions(orgId: string, agentId: string) {
    return db.select().from(agentVersions)
      .where(and(eq(agentVersions.agentId, agentId), eq(agentVersions.orgId, orgId), isNull(agentVersions.deletedAt)))
      .orderBy(desc(agentVersions.version));
  },

  async update(orgId: string, agentId: string, data: Partial<{
    name: string;
    description: string;
    systemPrompt: string;
    modelId: string;
    modelParams: Record<string, unknown>;
    visibility: string;
    isPublished: boolean;
    isEnabled: boolean;
    toolApprovalMode: string;
    memoryScope: string;
    webhookUrl: string | null;
    cronSchedule: string | null;
    ownerId: string;
  }>) {
    const [agent] = await db
      .update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
      .returning();

    if (!agent) throw AppError.notFound("Agent not found");
    syncAgentUpsert(agent as any);
    return agent;
  },

  async delete(orgId: string, agentId: string) {
    const [agent] = await db
      .update(agents)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
      .returning();

    if (!agent) throw AppError.notFound("Agent not found");
    syncAgentDelete(agentId);
    return agent;
  },
};
