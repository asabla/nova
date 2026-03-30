import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";
import { RETRY_POLICIES } from "@nova/shared/constants";

const {
  cleanupExpiredSessions,
  cleanupExpiredInvitations,
  cleanupOrphanedFiles,
  cleanupSoftDeletedRecords,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
  retry: RETRY_POLICIES.LONG_RUNNING,
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
