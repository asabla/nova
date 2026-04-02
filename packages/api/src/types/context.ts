import type { Role } from "@nova/shared/constants";

export type AppContext = {
  Variables: {
    requestId: string;
    spanId: string;
    userId: string;
    orgId: string;
    userRole: Role;
  };
};
