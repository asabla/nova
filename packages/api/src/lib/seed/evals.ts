import { eq } from "drizzle-orm";
import { db } from "../db";
import { systemPrompts, systemPromptVersions, evalDimensions } from "@nova/shared/schemas";
import { systemPromptDefs } from "./data/system-prompt-defs";
import { evalDimensionDefs } from "./data/eval-dimension-defs";

export async function seedEvals(orgId: string): Promise<void> {
  // Upsert system prompts and their initial versions
  for (const def of systemPromptDefs) {
    const [sp] = await db
      .insert(systemPrompts)
      .values({ orgId, slug: def.slug, name: def.name, description: def.description })
      .onConflictDoNothing()
      .returning();

    const promptId = sp?.id;
    if (!promptId) continue; // Already exists

    // Create version 1 as active
    const [v] = await db
      .insert(systemPromptVersions)
      .values({
        systemPromptId: promptId,
        orgId,
        version: 1,
        content: def.content,
        generatedBy: "seed",
        status: "active",
        trafficPct: 100,
      })
      .returning();

    if (v) {
      await db
        .update(systemPrompts)
        .set({ activeVersionId: v.id })
        .where(eq(systemPrompts.id, promptId));
    }
  }
  console.log(`  System prompts: ${systemPromptDefs.length} upserted`);

  // Eval dimensions
  for (const dim of evalDimensionDefs) {
    await db
      .insert(evalDimensions)
      .values({ orgId, ...dim })
      .onConflictDoNothing();
  }
  console.log(`  Eval dimensions: ${evalDimensionDefs.length} upserted`);
}
