import { describe, it, expect } from "bun:test";
import { safeUrlSchema, isPrivateIP } from "../src/utils/url-validation";

describe("safeUrlSchema", () => {
  it("accepts valid public HTTPS URLs", () => {
    expect(safeUrlSchema.safeParse("https://example.com").success).toBe(true);
    expect(safeUrlSchema.safeParse("https://api.openai.com/v1/chat").success).toBe(true);
  });

  it("accepts valid public HTTP URLs", () => {
    expect(safeUrlSchema.safeParse("http://example.com").success).toBe(true);
  });

  it("rejects non-URL strings", () => {
    expect(safeUrlSchema.safeParse("not-a-url").success).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(safeUrlSchema.safeParse("").success).toBe(false);
  });

  it("rejects localhost URLs", () => {
    expect(safeUrlSchema.safeParse("http://localhost:3000").success).toBe(false);
    expect(safeUrlSchema.safeParse("https://localhost").success).toBe(false);
  });

  it("rejects private IP URLs", () => {
    expect(safeUrlSchema.safeParse("http://192.168.1.1").success).toBe(false);
    expect(safeUrlSchema.safeParse("http://10.0.0.1").success).toBe(false);
    expect(safeUrlSchema.safeParse("http://172.16.0.1").success).toBe(false);
    expect(safeUrlSchema.safeParse("http://127.0.0.1:8080").success).toBe(false);
  });

  it("rejects non-HTTP protocols", () => {
    expect(safeUrlSchema.safeParse("ftp://example.com").success).toBe(false);
    expect(safeUrlSchema.safeParse("file:///etc/passwd").success).toBe(false);
  });
});

describe("isPrivateIP edge cases", () => {
  it("handles IPv4-mapped IPv6", () => {
    expect(isPrivateIP("::1")).toBe(true);
  });

  it("handles fc00 (unique local)", () => {
    expect(isPrivateIP("fc00::1")).toBe(true);
  });

  it("handles fe80 (link-local)", () => {
    expect(isPrivateIP("fe80::1")).toBe(true);
  });

  it("handles zero-prefix addresses", () => {
    expect(isPrivateIP("0.0.0.0")).toBe(true);
  });

  it("does not flag normal public IPs", () => {
    expect(isPrivateIP("93.184.216.34")).toBe(false);
    expect(isPrivateIP("2607:f8b0:4004:800::200e")).toBe(false);
  });
});
