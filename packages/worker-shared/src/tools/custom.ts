import { tool } from "@openai/agents";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";

/**
 * Load custom tools registered to an agent from the database and
 * return them as OpenAI Agent SDK tool() definitions.
 * Uses JSON Schema parameters to avoid Zod 3/4 version conflicts.
 */
export async function loadCustomTools(agentId: string) {
  const { tools: toolsTable, agentTools: agentToolsTable } = await import(
    "@nova/shared/schemas"
  );

  const registeredTools = await db
    .select({ tool: toolsTable })
    .from(agentToolsTable)
    .innerJoin(toolsTable, eq(agentToolsTable.toolId, toolsTable.id))
    .where(
      and(
        eq(agentToolsTable.agentId, agentId),
        eq(agentToolsTable.isEnabled, true),
        isNull(agentToolsTable.deletedAt),
      ),
    );

  return registeredTools.map((row) => {
    const t = row.tool;
    const spec = t.openapiSpec as Record<string, unknown> | null;
    const endpoint = (spec?.endpoint ?? spec?.url) as string | undefined;

    return tool({
      name: t.name,
      description: t.description ?? `Custom tool: ${t.name}`,
      parameters: {
        type: "object" as const,
        properties: {} as Record<string, unknown>,
        required: [] as string[],
        additionalProperties: true as const,
      },
      strict: false,
      execute: async (args: unknown) => {
        if (!endpoint) {
          return { error: `Tool ${t.name} has no endpoint configured` };
        }
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
          signal: AbortSignal.timeout(30_000),
        });
        return await resp.json();
      },
    });
  });
}
