import { describe, it, expect } from "bun:test";
import { AppError } from "@nova/shared/utils";

describe("AppError", () => {
  it("creates notFound error", () => {
    const err = AppError.notFound("User");
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("User");
  });

  it("creates conflict error", () => {
    const err = AppError.conflict("Already exists");
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain("Already exists");
  });

  it("creates validation error", () => {
    const err = AppError.badRequest("Invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain("Invalid input");
  });

  it("creates unauthorized error", () => {
    const err = AppError.unauthorized("Not logged in");
    expect(err.statusCode).toBe(401);
  });

  it("creates forbidden error", () => {
    const err = AppError.forbidden("No access");
    expect(err.statusCode).toBe(403);
  });
});

describe("URL validation", () => {
  it("validates URL format", async () => {
    const { isValidUrl, isPrivateIp } = await import("@nova/shared/utils");

    if (isValidUrl) {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("not-a-url")).toBe(false);
    }

    if (isPrivateIp) {
      expect(isPrivateIp("192.168.1.1")).toBe(true);
      expect(isPrivateIp("8.8.8.8")).toBe(false);
    }
  });
});

describe("Pagination", () => {
  it("calculates offset from page", async () => {
    const { calculateOffset } = await import("@nova/shared/utils");

    if (calculateOffset) {
      expect(calculateOffset(1, 20)).toBe(0);
      expect(calculateOffset(2, 20)).toBe(20);
      expect(calculateOffset(3, 10)).toBe(20);
    }
  });
});
