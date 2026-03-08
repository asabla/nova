import { describe, it, expect } from "bun:test";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_MESSAGE } from "../src/constants/file-types";
import { ROLES, ROLE_HIERARCHY, hasRole } from "../src/constants/roles";
import { DEFAULTS } from "../src/constants/defaults";

describe("File type constants", () => {
  it("includes common MIME types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
    expect(ALLOWED_MIME_TYPES).toContain("text/plain");
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("text/csv");
  });

  it("MAX_FILE_SIZE_BYTES is reasonable", () => {
    expect(MAX_FILE_SIZE_BYTES).toBeGreaterThan(0);
    expect(MAX_FILE_SIZE_BYTES).toBeLessThanOrEqual(500 * 1024 * 1024);
  });

  it("MAX_FILES_PER_MESSAGE is positive", () => {
    expect(MAX_FILES_PER_MESSAGE).toBeGreaterThan(0);
  });
});

describe("Role constants", () => {
  it("has all expected roles", () => {
    expect(ROLES).toContain("super-admin");
    expect(ROLES).toContain("org-admin");
    expect(ROLES).toContain("power-user");
    expect(ROLES).toContain("member");
    expect(ROLES).toContain("viewer");
  });

  it("ROLE_HIERARCHY is ordered correctly", () => {
    expect(ROLE_HIERARCHY["super-admin"]).toBeGreaterThan(ROLE_HIERARCHY["org-admin"]);
    expect(ROLE_HIERARCHY["org-admin"]).toBeGreaterThan(ROLE_HIERARCHY["member"]);
    expect(ROLE_HIERARCHY["member"]).toBeGreaterThan(ROLE_HIERARCHY["viewer"]);
  });

  it("hasRole checks correctly", () => {
    expect(hasRole("super-admin", "member")).toBe(true);
    expect(hasRole("member", "super-admin")).toBe(false);
    expect(hasRole("viewer", "viewer")).toBe(true);
    expect(hasRole("org-admin", "power-user")).toBe(true);
  });
});

describe("Defaults", () => {
  it("has reasonable pagination defaults", () => {
    expect(DEFAULTS.PAGINATION_PAGE_SIZE).toBeGreaterThan(0);
    expect(DEFAULTS.PAGINATION_MAX_PAGE_SIZE).toBeGreaterThan(DEFAULTS.PAGINATION_PAGE_SIZE);
  });

  it("has reasonable agent defaults", () => {
    expect(DEFAULTS.AGENT_MAX_STEPS).toBeGreaterThan(0);
    expect(DEFAULTS.AGENT_MAX_STEPS).toBeLessThanOrEqual(100);
  });

  it("has reasonable chunk defaults", () => {
    expect(DEFAULTS.CHUNK_SIZE).toBeGreaterThan(0);
    expect(DEFAULTS.CHUNK_OVERLAP).toBeLessThan(DEFAULTS.CHUNK_SIZE);
  });
});
