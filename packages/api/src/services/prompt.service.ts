import { eq, and, or, desc, ilike, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { promptTemplates, promptTemplateVersions } from "@nova/shared/schemas";
import type { PromptTemplateInput } from "@nova/shared/schemas";
import { AppError } from "@nova/shared/utils";

export const promptService = {
  async list(orgId: string, opts?: { search?: string; category?: string; limit?: number; offset?: number }) {
    const conditions = [eq(promptTemplates.orgId, orgId)];
    if (opts?.search) {
      conditions.push(ilike(promptTemplates.name, `%${opts.search}%`));
    }
    if (opts?.category) {
      conditions.push(eq(promptTemplates.category, opts.category));
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

  async listExplore(orgId: string, opts?: { search?: string; category?: string; limit?: number; offset?: number }) {
    const orgOrSystem = or(eq(promptTemplates.orgId, orgId), and(eq(promptTemplates.isSystem, true), eq(promptTemplates.isPublished, true)));
    const conditions = [orgOrSystem];
    if (opts?.search) {
      conditions.push(ilike(promptTemplates.name, `%${opts.search}%`));
    }
    if (opts?.category) {
      conditions.push(eq(promptTemplates.category, opts.category));
    }

    const result = await db
      .select()
      .from(promptTemplates)
      .where(and(...conditions))
      .orderBy(desc(promptTemplates.isSystem), desc(promptTemplates.usageCount), desc(promptTemplates.updatedAt))
      .limit(opts?.limit ?? 100)
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
    variables?: unknown;
    systemPrompt?: string;
    tags?: string[];
    visibility?: string;
    inputs?: PromptTemplateInput[];
    icon?: string;
    color?: string;
    bgColor?: string;
  }) {
    const [prompt] = await db
      .insert(promptTemplates)
      .values({
        orgId,
        ownerId: userId,
        name: data.name,
        description: data.description,
        content: data.content,
        category: data.category,
        variables: data.variables,
        systemPrompt: data.systemPrompt,
        tags: data.tags,
        visibility: data.visibility ?? "private",
        inputs: data.inputs,
        icon: data.icon,
        color: data.color,
        bgColor: data.bgColor,
      })
      .returning();

    // Create initial version (v1)
    await db.insert(promptTemplateVersions).values({
      promptTemplateId: prompt.id,
      orgId,
      version: 1,
      content: data.content,
      variables: data.variables,
      systemPrompt: data.systemPrompt,
      changelog: "Initial version",
    });

    return prompt;
  },

  async update(orgId: string, promptId: string, data: Partial<{
    name: string;
    description: string;
    content: string;
    category: string;
    inputs: PromptTemplateInput[];
    icon: string;
    color: string;
    bgColor: string;
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

  // --- Versioning (User Story #183) ---

  async createVersion(orgId: string, promptId: string, data: {
    content: string;
    variables?: unknown;
    systemPrompt?: string;
    changelog?: string;
  }) {
    const template = await this.get(orgId, promptId);
    const nextVersion = template.currentVersion + 1;

    const [version] = await db
      .insert(promptTemplateVersions)
      .values({
        promptTemplateId: promptId,
        orgId,
        version: nextVersion,
        content: data.content,
        variables: data.variables,
        systemPrompt: data.systemPrompt,
        changelog: data.changelog,
      })
      .returning();

    // Update the template with new version number and content
    await db
      .update(promptTemplates)
      .set({
        currentVersion: nextVersion,
        content: data.content,
        variables: data.variables,
        systemPrompt: data.systemPrompt,
        updatedAt: new Date(),
      })
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)));

    return version;
  },

  async listVersions(orgId: string, promptId: string) {
    // Verify template exists and belongs to org
    await this.get(orgId, promptId);

    return db
      .select()
      .from(promptTemplateVersions)
      .where(
        and(
          eq(promptTemplateVersions.promptTemplateId, promptId),
          eq(promptTemplateVersions.orgId, orgId),
        ),
      )
      .orderBy(desc(promptTemplateVersions.version));
  },

  async getVersion(orgId: string, promptId: string, version: number) {
    // Verify template exists and belongs to org
    await this.get(orgId, promptId);

    const [entry] = await db
      .select()
      .from(promptTemplateVersions)
      .where(
        and(
          eq(promptTemplateVersions.promptTemplateId, promptId),
          eq(promptTemplateVersions.orgId, orgId),
          eq(promptTemplateVersions.version, version),
        ),
      );

    if (!entry) throw AppError.notFound(`Version ${version} not found`);
    return entry;
  },

  // --- Forking (User Story #184) ---

  async fork(orgId: string, userId: string, promptId: string) {
    const source = await this.get(orgId, promptId);

    const [forked] = await db
      .insert(promptTemplates)
      .values({
        orgId,
        ownerId: userId,
        name: `${source.name} (fork)`,
        description: source.description,
        content: source.content,
        variables: source.variables,
        systemPrompt: source.systemPrompt,
        firstMessage: source.firstMessage,
        category: source.category,
        tags: source.tags,
        visibility: "private",
        forkedFromTemplateId: source.id,
      })
      .returning();

    // Create initial version for the fork
    await db.insert(promptTemplateVersions).values({
      promptTemplateId: forked.id,
      orgId,
      version: 1,
      content: source.content,
      variables: source.variables,
      systemPrompt: source.systemPrompt,
      changelog: `Forked from "${source.name}"`,
    });

    return forked;
  },

  // --- Rating (User Story #186) ---

  async rate(orgId: string, promptId: string, _userId: string, rating: number) {
    // Verify template exists
    const template = await this.get(orgId, promptId);

    // Simple rolling average: new_avg = (old_avg * usage + rating) / (usage + 1)
    // We use usageCount as a proxy for rating count in this simple model.
    // For a more robust solution, a separate ratings table would be used.
    const currentAvg = template.avgRating ? parseFloat(template.avgRating) : 0;
    const ratingCount = template.usageCount > 0 ? template.usageCount : 0;
    const newAvg = ratingCount > 0
      ? ((currentAvg * ratingCount) + rating) / (ratingCount + 1)
      : rating;

    const [updated] = await db
      .update(promptTemplates)
      .set({
        avgRating: newAvg.toFixed(2),
        updatedAt: new Date(),
      })
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)))
      .returning();

    return updated;
  },

  // --- Tags (User Story #185) ---

  async updateTags(orgId: string, promptId: string, tags: string[]) {
    const [updated] = await db
      .update(promptTemplates)
      .set({
        tags,
        updatedAt: new Date(),
      })
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)))
      .returning();

    if (!updated) throw AppError.notFound("Prompt template not found");
    return updated;
  },

  // --- Usage tracking ---

  async incrementUsage(orgId: string, promptId: string) {
    const [updated] = await db
      .update(promptTemplates)
      .set({
        usageCount: sql`${promptTemplates.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)))
      .returning();

    if (!updated) throw AppError.notFound("Prompt template not found");
    return updated;
  },

  // --- Visibility ---

  async updateVisibility(orgId: string, promptId: string, visibility: string) {
    const [updated] = await db
      .update(promptTemplates)
      .set({
        visibility,
        updatedAt: new Date(),
      })
      .where(and(eq(promptTemplates.id, promptId), eq(promptTemplates.orgId, orgId)))
      .returning();

    if (!updated) throw AppError.notFound("Prompt template not found");
    return updated;
  },
};
