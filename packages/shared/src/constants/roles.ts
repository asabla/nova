export const ROLES = ["super-admin", "org-admin", "power-user", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 0,
  member: 1,
  "power-user": 2,
  "org-admin": 3,
  "super-admin": 4,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
