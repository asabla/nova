import type { Role } from "../constants/roles.js";

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  isSuperAdmin: boolean;
}

export interface SessionData {
  user: SessionUser;
  activeOrgId: string | null;
  role: Role;
  expiresAt: string;
}
