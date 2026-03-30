import { Connection, Client } from "@temporalio/client";
import { ScheduleOverlapPolicy } from "@temporalio/client";
import { db } from "@nova/worker-shared/db";
import { agents } from "@nova/shared/schemas";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { TASK_QUEUES } from "@nova/shared/constants";
import { logger } from "@nova/worker-shared/logger";

export async function setupSchedules() {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });

  const client = new Client({ connection });

  // ── 1. System cleanup schedule (runs daily at 3 AM UTC) ──
  try {
    await client.schedule.create({
      scheduleId: "nova-system-cleanup",
      spec: { cronExpressions: ["0 3 * * *"] },
      action: {
        type: "startWorkflow",
        workflowType: "scheduledCleanupWorkflow",
        taskQueue: TASK_QUEUES.BACKGROUND,
        workflowId: "cleanup-scheduled",
      },
      policies: { overlap: ScheduleOverlapPolicy.SKIP },
    });
    logger.info("Registered system cleanup schedule (daily 3AM UTC)");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      try {
        const handle = client.schedule.getHandle("nova-system-cleanup");
        await handle.update((prev) => ({
          ...prev,
          action: {
            type: "startWorkflow" as const,
            workflowType: "scheduledCleanupWorkflow",
            taskQueue: TASK_QUEUES.BACKGROUND,
            workflowId: "cleanup-scheduled",
          },
        }));
        logger.info("Updated system cleanup schedule");
      } catch {
        logger.info("System cleanup schedule already registered");
      }
    } else {
      logger.error({ err: err.message }, "Failed to register cleanup schedule");
    }
  }

  // ── 2. Conversation summary batch schedule (runs every 6 hours) ──
  try {
    await client.schedule.create({
      scheduleId: "nova-conversation-summaries",
      spec: { cronExpressions: ["0 */6 * * *"] },
      action: {
        type: "startWorkflow",
        workflowType: "conversationSummaryBatchWorkflow",
        taskQueue: TASK_QUEUES.BACKGROUND,
        workflowId: "summaries-scheduled",
        args: [{ batchSize: 50 }],
      },
      policies: { overlap: ScheduleOverlapPolicy.SKIP },
    });
    logger.info("Registered conversation summary batch schedule (every 6h)");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      try {
        const handle = client.schedule.getHandle("nova-conversation-summaries");
        await handle.update((prev) => ({
          ...prev,
          action: {
            type: "startWorkflow" as const,
            workflowType: "conversationSummaryBatchWorkflow",
            taskQueue: TASK_QUEUES.BACKGROUND,
            workflowId: "summaries-scheduled",
            args: [{ batchSize: 50 }],
          },
        }));
        logger.info("Updated conversation summary schedule to batch workflow");
      } catch {
        logger.info("Conversation summary schedule already registered");
      }
    } else {
      logger.error({ err: err.message }, "Failed to register summary schedule");
    }
  }

  // ── 3. Knowledge connector sync dispatch (every 30 minutes) ──
  try {
    await client.schedule.create({
      scheduleId: "nova-connector-sync-dispatch",
      spec: { cronExpressions: ["*/30 * * * *"] },
      action: {
        type: "startWorkflow",
        workflowType: "connectorSyncDispatchWorkflow",
        taskQueue: TASK_QUEUES.INGESTION,
        workflowId: "connector-sync-dispatch",
      },
      policies: { overlap: ScheduleOverlapPolicy.SKIP },
    });
    logger.info("Registered connector sync dispatch schedule (every 30 min)");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      try {
        const handle = client.schedule.getHandle("nova-connector-sync-dispatch");
        await handle.update((prev) => ({
          ...prev,
          action: {
            type: "startWorkflow" as const,
            workflowType: "connectorSyncDispatchWorkflow",
            taskQueue: TASK_QUEUES.INGESTION,
            workflowId: "connector-sync-dispatch",
          },
        }));
        logger.info("Updated connector sync dispatch schedule");
      } catch {
        logger.info("Connector sync dispatch schedule already registered");
      }
    } else {
      logger.error({ err: err.message }, "Failed to register connector sync dispatch schedule");
    }
  }

  // ── 4. Platform metrics collection (every hour) ──
  try {
    await client.schedule.create({
      scheduleId: "nova-metrics-collection",
      spec: { cronExpressions: ["0 * * * *"] },
      action: {
        type: "startWorkflow",
        workflowType: "metricsCollectionWorkflow",
        taskQueue: TASK_QUEUES.BACKGROUND,
        workflowId: "metrics-collection-scheduled",
      },
      policies: { overlap: ScheduleOverlapPolicy.SKIP },
    });
    logger.info("Registered metrics collection schedule (hourly)");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      logger.info("Metrics collection schedule already registered");
    } else {
      logger.error({ err: err.message }, "Failed to register metrics schedule");
    }
  }

  // ── 5. Register agent cron schedules (Story #107) ──
  await syncAgentSchedules(client);

  logger.info("Schedule setup complete");
  await connection.close();
}

/**
 * Syncs agent cron schedules from the database to Temporal.
 * Called at worker startup and can be triggered via API.
 */
async function syncAgentSchedules(client: Client) {
  const scheduledAgents = await db
    .select()
    .from(agents)
    .where(
      and(
        isNotNull(agents.cronSchedule),
        isNull(agents.deletedAt),
        eq(agents.isEnabled, true),
      ),
    );

  for (const agent of scheduledAgents) {
    const scheduleId = `nova-agent-cron-${agent.id}`;
    try {
      await client.schedule.create({
        scheduleId,
        spec: { cronExpressions: [agent.cronSchedule!] },
        action: {
          type: "startWorkflow",
          workflowType: "agentExecutionWorkflow",
          taskQueue: TASK_QUEUES.AGENT,
          workflowId: `agent-cron-${agent.id}-${Date.now()}`,
          args: [
            {
              orgId: agent.orgId,
              userId: agent.ownerId,
              agentId: agent.id,
              userMessage: `Scheduled execution at ${new Date().toISOString()}`,
              maxSteps: 10,
            },
          ],
        },
        policies: { overlap: ScheduleOverlapPolicy.SKIP },
      });
      logger.info({ agentName: agent.name, cronSchedule: agent.cronSchedule }, "Registered cron schedule for agent");
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        // Update existing schedule
        try {
          const handle = client.schedule.getHandle(scheduleId);
          await handle.update((prev) => ({
            ...prev,
            spec: { cronExpressions: [agent.cronSchedule!] },
          }));
          logger.info({ agentName: agent.name }, "Updated cron schedule for agent");
        } catch {
          // Schedule exists and is fine
        }
      } else {
        logger.error({ err: err.message, agentName: agent.name }, "Failed to register agent schedule");
      }
    }
  }

  logger.info({ count: scheduledAgents.length }, "Synced agent cron schedules");
}

