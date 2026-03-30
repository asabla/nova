import { db } from "../db";
import { promptTemplates } from "@nova/shared/schemas";
import { promptDefs } from "./data/prompt-defs";

export async function seedPrompts(orgId: string, userId: string): Promise<void> {
  for (const p of promptDefs) {
    await db
      .insert(promptTemplates)
      .values({
        orgId,
        ownerId: userId,
        name: p.name,
        description: p.description,
        content: p.content,
        variables: p.variables,
        systemPrompt: p.systemPrompt,
        category: p.category,
        visibility: "org",
        isApproved: true,
      })
      .onConflictDoUpdate({
        target: [promptTemplates.orgId, promptTemplates.name],
        set: { content: p.content, description: p.description, variables: p.variables, systemPrompt: p.systemPrompt, updatedAt: new Date() },
      });
  }
  console.log(`  Prompt templates: ${promptDefs.length} upserted`);
}
