import { db } from "../lib/db";
import { auditLogs } from "@nova/shared/schema";

interface AuditEntry {
  orgId?: string;
  actorId?: string;
  actorType: "user" | "system" | "api_key" | "agent";
  impersonatorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditEntry) {
  await db.insert(auditLogs).values({
    orgId: entry.orgId,
    actorId: entry.actorId,
    actorType: entry.actorType,
    impersonatorId: entry.impersonatorId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    details: entry.details,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
  });
}
