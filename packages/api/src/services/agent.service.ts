import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { agents, agentVersions, agentSkills, agentTools, agentMcpServers } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

export const agentService = {
  async list(orgId: string, opts?: { search?: string; limit?: number; offset?: number }) {
    const conditions = [eq(agents.orgId, orgId), eq(agents.isDeleted, false)];
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
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId), eq(agents.isDeleted, false)));

    if (!agent) throw AppError.notFound("Agent not found");
    return agent;
  },

  async create(orgId: string, userId: string, data: {
    name: string;
    description?: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    const [agent] = await db
      .insert(agents)
      .values({
        orgId,
        createdBy: userId,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        model: data.model ?? "gpt-4o",
        temperature: data.temperature ? String(data.temperature) : "0.7",
        maxTokens: data.maxTokens ?? 4096,
        status: "active",
      })
      .returning();

    return agent;
  },

  async update(orgId: string, agentId: string, data: Partial<{
    name: string;
    description: string;
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
    status: string;
  }>) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.temperature !== undefined) updateData.temperature = String(data.temperature);
    if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens;
    if (data.status !== undefined) updateData.status = data.status;

    const [agent] = await db
      .update(agents)
      .set(updateData)
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
      .returning();

    if (!agent) throw AppError.notFound("Agent not found");
    return agent;
  },

  async delete(orgId: string, agentId: string) {
    const [agent] = await db
      .update(agents)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId)))
      .returning();

    if (!agent) throw AppError.notFound("Agent not found");
    return agent;
  },
};
