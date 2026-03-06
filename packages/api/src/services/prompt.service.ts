import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { promptTemplates, promptTemplateVersions } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

export const promptService = {
  async list(orgId: string, opts?: { search?: string; limit?: number; offset?: number }) {
    const conditions = [eq(promptTemplates.orgId, orgId)];
    if (opts?.search) {
      conditions.push(ilike(promptTemplates.name, `%${opts.search}%`));
    }

    const result = await db
      .select()
      .from(promptTemplates)
      .where(and(...conditions))
      .orderBy(desc(promptTemplates.updatedAt))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promptTemplates)
      .where(and(...conditions));

    return { data: result, total: count };
  },

  async get(orgId: string, promptId: string) {
    const [prompt] = await db
      .select()
      .from(promptTemplates)
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)));

    if (!prompt) throw AppError.notFound("Prompt template not found");
    return prompt;
  },

  async create(orgId: string, userId: string, data: {
    name: string;
    description?: string;
    content: string;
    category?: string;
  }) {
    const [prompt] = await db
      .insert(promptTemplates)
      .values({
        orgId,
        createdBy: userId,
        name: data.name,
        description: data.description,
        content: data.content,
        category: data.category,
      })
      .returning();

    return prompt;
  },

  async update(orgId: string, promptId: string, data: Partial<{
    name: string;
    description: string;
    content: string;
    category: string;
  }>) {
    const [prompt] = await db
      .update(promptTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)))
      .returning();

    if (!prompt) throw AppError.notFound("Prompt template not found");
    return prompt;
  },

  async delete(orgId: string, promptId: string) {
    const [prompt] = await db
      .delete(promptTemplates)
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)))
      .returning();

    if (!prompt) throw AppError.notFound("Prompt template not found");
    return prompt;
  },
};
