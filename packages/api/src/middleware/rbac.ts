import { createMiddleware } from "hono/factory";
import type { Role } from "@nova/shared/constants";
import { hasRole } from "@nova/shared/constants";
import { AppError } from "@nova/shared/utils";

export const requireRole = (requiredRole: Role) =>
  createMiddleware(async (c, next) => {
    const userRole = c.get("userRole");
    if (!userRole || !hasRole(userRole, requiredRole)) {
      throw AppError.forbidden(`Requires ${requiredRole} role or higher`);
    }
    await next();
  });

/**
 * Assert the current user is the resource owner or has org-admin (or higher) role.
 * Call this inside route handlers after fetching the resource.
 */
export function assertOwnerOrAdmin(userRole: string, userId: string, resourceOwnerId: string): void {
  if (hasRole(userRole as Role, "org-admin")) return;
  if (userId === resourceOwnerId) return;
  throw AppError.forbidden("You can only modify your own resources");
}
