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
