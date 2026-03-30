import { Connection, Client } from "@temporalio/client";
import { ScheduleOverlapPolicy } from "@temporalio/client";
import { db } from "@nova/worker-shared/db";
import { agents } from "@nova/shared/schemas";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { TASK_QUEUES } from "@nova/shared/constants";

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
    console.log("Registered system cleanup schedule (daily 3AM UTC)");
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
        console.log("Updated system cleanup schedule");
      } catch {
        console.log("System cleanup schedule already registered");
      }
    } else {
      console.error("Failed to register cleanup schedule:", err.message);
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
    console.log("Registered conversation summary batch schedule (every 6h)");
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
        console.log("Updated conversation summary schedule to batch workflow");
      } catch {
        console.log("Conversation summary schedule already registered");
      }
    } else {
      console.error("Failed to register summary schedule:", err.message);
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
    console.log("Registered connector sync dispatch schedule (every 30 min)");
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
        console.log("Updated connector sync dispatch schedule");
      } catch {
        console.log("Connector sync dispatch schedule already registered");
      }
    } else {
      console.error("Failed to register connector sync dispatch schedule:", err.message);
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
    console.log("Registered metrics collection schedule (hourly)");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log("Metrics collection schedule already registered");
    } else {
      console.error("Failed to register metrics schedule:", err.message);
    }
  }

  // ── 5. Register agent cron schedules (Story #107) ──
  await syncAgentSchedules(client);

  console.log("Schedule setup complete");
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
      console.log(`Registered cron schedule for agent ${agent.name}: ${agent.cronSchedule}`);
    } catch (err: any) {
      if (err.message?.includes("already exists")) {
        // Update existing schedule
        try {
          const handle = client.schedule.getHandle(scheduleId);
          await handle.update((prev) => ({
            ...prev,
            spec: { cronExpressions: [agent.cronSchedule!] },
          }));
          console.log(`Updated cron schedule for agent ${agent.name}`);
        } catch {
          // Schedule exists and is fine
        }
      } else {
        console.error(`Failed to register agent schedule for ${agent.name}:`, err.message);
      }
    }
  }

  console.log(`Synced ${scheduledAgents.length} agent cron schedule(s)`);
}

