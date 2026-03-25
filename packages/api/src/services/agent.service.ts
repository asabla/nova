import { eq, and, desc, ilike, sql, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { agents, agentVersions } from "@nova/shared/schemas";
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
    const conditions = [
      eq(agents.orgId, orgId),
      isNull(agents.deletedAt),
      eq(agents.isPublished, true),
    ];
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
