import { describe, it, expect } from "bun:test";
import { PERMISSIONS } from "../src/constants/permissions";
import { ROLES, ROLE_HIERARCHY, hasRole } from "../src/constants/roles";
import { RATE_LIMITS } from "../src/constants/rate-limits";

describe("Permissions", () => {
  it("all permission values are valid roles", () => {
    for (const [perm, role] of Object.entries(PERMISSIONS)) {
      expect(ROLES).toContain(role);
    }
  });

  it("conversation permissions require at least viewer/member", () => {
    expect(hasRole(PERMISSIONS["conversation.read"], "viewer")).toBe(true);
    expect(hasRole(PERMISSIONS["conversation.create"], "member")).toBe(true);
  });

  it("admin permissions require org-admin or super-admin", () => {
    expect(ROLE_HIERARCHY[PERMISSIONS["users.manage"]]).toBeGreaterThanOrEqual(ROLE_HIERARCHY["org-admin"]);
    expect(ROLE_HIERARCHY[PERMISSIONS["orgs.manage"]]).toBeGreaterThanOrEqual(ROLE_HIERARCHY["super-admin"]);
  });

  it("agent creation requires power-user", () => {
    expect(PERMISSIONS["agent.create"]).toBe("power-user");
    expect(hasRole("power-user", PERMISSIONS["agent.create"])).toBe(true);
    expect(hasRole("member", PERMISSIONS["agent.create"])).toBe(false);
  });
});

describe("Rate limits", () => {
  it("all limits have positive values", () => {
    for (const [key, limit] of Object.entries(RATE_LIMITS)) {
      expect(limit.maxRequests).toBeGreaterThan(0);
      expect(limit.windowSeconds).toBeGreaterThan(0);
    }
  });

  it("per-user is higher than per-IP", () => {
    expect(RATE_LIMITS.PER_USER.maxRequests).toBeGreaterThan(RATE_LIMITS.PER_IP.maxRequests);
  });

  it("per-org is highest", () => {
    expect(RATE_LIMITS.PER_ORG.maxRequests).toBeGreaterThan(RATE_LIMITS.PER_USER.maxRequests);
  });

  it("LLM calls are rate limited", () => {
    expect(RATE_LIMITS.LLM_CALLS.maxRequests).toBeLessThan(RATE_LIMITS.PER_USER.maxRequests);
  });
});
