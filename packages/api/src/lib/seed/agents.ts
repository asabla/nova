import { db } from "../db";
import { agents } from "@nova/shared/schemas";
import { agentDefs } from "./data/agent-defs";

export async function seedAgents(orgId: string, userId: string): Promise<void> {
  for (const a of agentDefs) {
    await db
      .insert(agents)
      .values({
        orgId,
        ownerId: userId,
        name: a.name,
        description: a.description,
        systemPrompt: a.systemPrompt,
        visibility: a.visibility,
        toolApprovalMode: a.toolApprovalMode,
        maxSteps: a.maxSteps,
        timeoutSeconds: a.timeoutSeconds,
        builtinTools: a.builtinTools,
        isEnabled: true,
        isPublished: true,
      })
      .onConflictDoUpdate({
        target: [agents.orgId, agents.name],
        set: {
          description: a.description,
          systemPrompt: a.systemPrompt,
          maxSteps: a.maxSteps,
          timeoutSeconds: a.timeoutSeconds,
          builtinTools: a.builtinTools,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  Agents: ${agentDefs.length} upserted`);
}
