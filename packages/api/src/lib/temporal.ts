import { Connection, Client, type WorkflowStartOptions } from "@temporalio/client";
import { env } from "./env";
import { workflowsDispatchedTotal } from "./metrics";
import { logger } from "./logger";
import { context, propagation } from "@opentelemetry/api";

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: env.TEMPORAL_ADDRESS,
    });
    client = new Client({ connection });
  }
  return client;
}

/**
 * Dispatch a Temporal workflow with metrics tracking and trace context propagation.
 */
export async function dispatchWorkflow<T>(
  workflowName: string,
  options: WorkflowStartOptions<any>,
) {
  const temporalClient = await getTemporalClient();

  // Inject OTel trace context into workflow headers for cross-service propagation
  const headers: Record<string, string> = {};
  propagation.inject(context.active(), headers, {
    set(carrier, key, value) { (carrier as Record<string, string>)[key] = value; },
  });

  const handle = await temporalClient.workflow.start(workflowName, {
    ...options,
    headers: { ...options.headers, ...headers },
  });

  workflowsDispatchedTotal.inc({ type: workflowName, queue: options.taskQueue ?? "default" });
  logger.info({ event: "workflow.dispatched", workflowName, workflowId: options.workflowId, taskQueue: options.taskQueue }, "Temporal workflow dispatched");

  return handle;
}
