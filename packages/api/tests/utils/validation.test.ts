import { describe, it, expect } from "bun:test";
import { AppError } from "@nova/shared/utils";

describe("AppError", () => {
  it("creates notFound error", () => {
    const err = AppError.notFound("User");
    expect(err.status).toBe(404);
    expect(err.detail).toContain("User");
  });

  it("creates conflict error", () => {
    const err = AppError.conflict("Already exists");
    expect(err.status).toBe(409);
    expect(err.detail).toContain("Already exists");
  });

  it("creates validation error", () => {
    const err = AppError.badRequest("Invalid input");
    expect(err.status).toBe(400);
    expect(err.detail).toContain("Invalid input");
  });

  it("creates unauthorized error", () => {
    const err = AppError.unauthorized("Not logged in");
    expect(err.status).toBe(401);
  });

  it("creates forbidden error", () => {
    const err = AppError.forbidden("No access");
    expect(err.status).toBe(403);
  });

  it("creates rateLimited error", () => {
    const err = AppError.rateLimited(30);
    expect(err.status).toBe(429);
    expect(err.detail).toContain("30 seconds");
  });

  it("is an instance of Error", () => {
    const err = AppError.notFound("Test");
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe("AppError");
  });
});

describe("URL validation", () => {
  it("validates private IP ranges", async () => {
    const { isPrivateIP } = await import("@nova/shared/utils");

    expect(isPrivateIP("192.168.1.1")).toBe(true);
    expect(isPrivateIP("10.0.0.1")).toBe(true);
    expect(isPrivateIP("172.16.0.1")).toBe(true);
    expect(isPrivateIP("127.0.0.1")).toBe(true);
    expect(isPrivateIP("::1")).toBe(true);
    expect(isPrivateIP("8.8.8.8")).toBe(false);
    expect(isPrivateIP("1.1.1.1")).toBe(false);
  });
});

describe("Pagination", () => {
  it("calculates pagination correctly", async () => {
    const { parsePagination, buildPaginatedResponse } = await import("@nova/shared/utils");

    const p1 = parsePagination({ page: 1, pageSize: 20 });
    expect(p1.offset).toBe(0);
    expect(p1.limit).toBe(20);

    const p2 = parsePagination({ page: 3, pageSize: 10 });
    expect(p2.offset).toBe(20);

    const response = buildPaginatedResponse([1, 2, 3], 50, p1);
    expect(response.data).toHaveLength(3);
    expect(response.total).toBe(50);
    expect(response.hasMore).toBe(true);
  });
});

describe("Slug generation", () => {
  it("generates valid slugs", async () => {
    const { generateSlug, generateUniqueSlug } = await import("@nova/shared/utils");

    expect(generateSlug("Hello World")).toBe("hello-world");
    expect(generateSlug("Special @#$ Characters")).toBe("special-characters");
    expect(generateSlug("  spaces  ")).toBe("spaces");

    const unique = generateUniqueSlug("test");
    expect(unique).toMatch(/^test-[a-z0-9]{4}$/);
  });
});
