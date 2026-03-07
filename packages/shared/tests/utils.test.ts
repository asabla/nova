import { describe, it, expect } from "bun:test";
import { AppError } from "../src/utils/errors";
import { generateSlug, generateUniqueSlug } from "../src/utils/slug";
import { parsePagination, buildPaginatedResponse } from "../src/utils/pagination";
import { isPrivateIP } from "../src/utils/url-validation";

// --- AppError ---

describe("AppError", () => {
  it("creates error with correct properties", () => {
    const err = new AppError(500, "Server Error", "something broke");
    expect(err.status).toBe(500);
    expect(err.title).toBe("Server Error");
    expect(err.detail).toBe("something broke");
    expect(err.name).toBe("AppError");
    expect(err instanceof Error).toBe(true);
  });

  it("notFound returns 404", () => {
    const err = AppError.notFound("User");
    expect(err.status).toBe(404);
    expect(err.detail).toBe("User not found");
  });

  it("forbidden returns 403", () => {
    const err = AppError.forbidden("not allowed");
    expect(err.status).toBe(403);
    expect(err.detail).toBe("not allowed");
  });

  it("badRequest returns 400", () => {
    const err = AppError.badRequest("invalid input");
    expect(err.status).toBe(400);
    expect(err.detail).toBe("invalid input");
  });

  it("unauthorized returns 401", () => {
    const err = AppError.unauthorized();
    expect(err.status).toBe(401);
    expect(err.detail).toBe("Authentication required");
  });

  it("conflict returns 409", () => {
    const err = AppError.conflict("already exists");
    expect(err.status).toBe(409);
  });

  it("rateLimited returns 429", () => {
    const err = AppError.rateLimited(30);
    expect(err.status).toBe(429);
    expect(err.detail).toContain("30 seconds");
  });
});

// --- Slug ---

describe("generateSlug", () => {
  it("converts to lowercase", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("my cool project")).toBe("my-cool-project");
  });

  it("removes special characters", () => {
    expect(generateSlug("hello@world!")).toBe("helloworld");
  });

  it("collapses multiple hyphens", () => {
    expect(generateSlug("hello---world")).toBe("hello-world");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("-hello-world-")).toBe("hello-world");
  });

  it("handles underscores", () => {
    expect(generateSlug("hello_world")).toBe("hello-world");
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });
});

describe("generateUniqueSlug", () => {
  it("adds a random suffix", () => {
    const slug = generateUniqueSlug("test");
    expect(slug).toMatch(/^test-[a-z0-9]{4}$/);
  });

  it("generates different slugs", () => {
    const a = generateUniqueSlug("test");
    const b = generateUniqueSlug("test");
    // Not guaranteed different but extremely unlikely to be same
    expect(a.startsWith("test-")).toBe(true);
    expect(b.startsWith("test-")).toBe(true);
  });
});

// --- Pagination ---

describe("parsePagination", () => {
  it("returns defaults for empty input", () => {
    const result = parsePagination({});
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
    expect(result.limit).toBeGreaterThan(0);
  });

  it("calculates offset correctly", () => {
    const result = parsePagination({ page: 3, pageSize: 10 });
    expect(result.offset).toBe(20);
    expect(result.limit).toBe(10);
    expect(result.page).toBe(3);
  });

  it("clamps page to minimum 1", () => {
    const result = parsePagination({ page: -5 });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it("clamps pageSize to minimum 1", () => {
    const result = parsePagination({ pageSize: 0 });
    expect(result.pageSize).toBe(1);
  });
});

describe("buildPaginatedResponse", () => {
  it("builds correct response", () => {
    const result = buildPaginatedResponse(
      [{ id: 1 }, { id: 2 }],
      10,
      { offset: 0, limit: 2, page: 1, pageSize: 2 },
    );
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(10);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(true);
  });

  it("hasMore is false on last page", () => {
    const result = buildPaginatedResponse(
      [{ id: 9 }, { id: 10 }],
      10,
      { offset: 8, limit: 2, page: 5, pageSize: 2 },
    );
    expect(result.hasMore).toBe(false);
  });

  it("handles empty data", () => {
    const result = buildPaginatedResponse(
      [],
      0,
      { offset: 0, limit: 20, page: 1, pageSize: 20 },
    );
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

// --- URL Validation ---

describe("isPrivateIP", () => {
  it("detects 10.x.x.x as private", () => {
    expect(isPrivateIP("10.0.0.1")).toBe(true);
    expect(isPrivateIP("10.255.255.255")).toBe(true);
  });

  it("detects 192.168.x.x as private", () => {
    expect(isPrivateIP("192.168.1.1")).toBe(true);
  });

  it("detects 172.16-31.x.x as private", () => {
    expect(isPrivateIP("172.16.0.1")).toBe(true);
    expect(isPrivateIP("172.31.255.255")).toBe(true);
  });

  it("detects localhost (127.x) as private", () => {
    expect(isPrivateIP("127.0.0.1")).toBe(true);
  });

  it("detects link-local as private", () => {
    expect(isPrivateIP("169.254.1.1")).toBe(true);
  });

  it("detects IPv6 loopback as private", () => {
    expect(isPrivateIP("::1")).toBe(true);
  });

  it("allows public IPs", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false);
    expect(isPrivateIP("1.1.1.1")).toBe(false);
    expect(isPrivateIP("203.0.113.1")).toBe(false);
  });
});
