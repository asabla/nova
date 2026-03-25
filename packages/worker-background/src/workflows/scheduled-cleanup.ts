import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  cleanupExpiredSessions,
  cleanupExpiredInvitations,
  cleanupOrphanedFiles,
  cleanupSoftDeletedRecords,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
  retry: { maximumAttempts: 2 },
});

export async function scheduledCleanupWorkflow(): Promise<{
  sessions: number;
  invitations: number;
  files: number;
  records: number;
}> {
  const [sessions, invitations, files, records] = await Promise.all([
    cleanupExpiredSessions(),
    cleanupExpiredInvitations(),
    cleanupOrphanedFiles(),
    cleanupSoftDeletedRecords(),
  ]);

  return { sessions, invitations, files, records };
}
