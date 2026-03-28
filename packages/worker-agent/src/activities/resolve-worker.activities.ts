import { eq, and, isNull } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { agents, customWorkers } from "@nova/shared/schemas";
import { generateWorkerJWT } from "@nova/gateway/jwt";

export interface ResolvedWorker {
  workerId: string;
  workerUrl: string;
  workerAuthSecret: string;
  timeoutSeconds: number;
  fallbackToBuiltin: boolean;
  gatewayJwt: string;
}

/**
 * Resolves the custom worker for an agent, if one is configured.
 * Returns null if no custom worker is assigned or if it's disabled.
 */
export async function resolveWorkerForAgent(
  orgId: string,
  agentId: string | undefined,
  conversationId: string,
): Promise<ResolvedWorker | null> {
  if (!agentId) return null;

  // Look up agent's custom worker assignment
  const [agent] = await db
    .select({ customWorkerId: agents.customWorkerId })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.orgId, orgId), isNull(agents.deletedAt)))
    .limit(1);

  if (!agent?.customWorkerId) return null;

  // Look up the custom worker
  const [worker] = await db
    .select()
    .from(customWorkers)
    .where(
      and(
        eq(customWorkers.id, agent.customWorkerId),
        eq(customWorkers.orgId, orgId),
        eq(customWorkers.isEnabled, true),
        isNull(customWorkers.deletedAt),
      ),
    )
    .limit(1);

  if (!worker) return null;

  // Generate a scoped JWT for the worker to call the gateway
  const gatewayJwt = await generateWorkerJWT({
    orgId,
    conversationId,
    workerId: worker.id,
    scopes: ["stream", "db", "llm", "vectors", "storage"],
  });

  return {
    workerId: worker.id,
    workerUrl: worker.url,
    workerAuthSecret: worker.authSecretEncrypted ?? "",
    timeoutSeconds: worker.timeoutSeconds,
    fallbackToBuiltin: worker.fallbackToBuiltin,
    gatewayJwt,
  };
}
