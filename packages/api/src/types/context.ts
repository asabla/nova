import type { Role } from "@nova/shared/constants";

export type AppContext = {
  Variables: {
    requestId: string;
    userId: string;
    orgId: string;
    userRole: Role;
  };
};
