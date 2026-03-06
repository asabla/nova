import { eq, and, desc, ilike, sql, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { agents } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

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
      })
      .returning();

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
  }>) {
    const [agent] = await db
      .update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
      .returning();

    if (!agent) throw AppError.notFound("Agent not found");
    return agent;
  },

  async delete(orgId: string, agentId: string) {
    const [agent] = await db
      .update(agents)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
      .returning();

    if (!agent) throw AppError.notFound("Agent not found");
    return agent;
  },
};
