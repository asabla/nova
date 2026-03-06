import { describe, it, expect } from "bun:test";
import { z } from "zod";

describe("Agent service validation", () => {
  const agentSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    systemPrompt: z.string().max(10_000).optional(),
    visibility: z.enum(["private", "team", "org", "public"]).default("private"),
    toolApprovalMode: z.enum(["auto", "always-ask", "never"]).default("always-ask"),
    memoryScope: z.enum(["per-user", "per-conversation", "global"]).default("per-user"),
    maxSteps: z.number().int().min(1).max(100).optional(),
    timeoutSeconds: z.number().int().min(1).max(3600).optional(),
  });

  it("should accept valid agent data", () => {
    const result = agentSchema.safeParse({
      name: "Test Agent",
      description: "A test agent",
      systemPrompt: "You are helpful",
      visibility: "team",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = agentSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("should reject name exceeding 200 chars", () => {
    const result = agentSchema.safeParse({ name: "a".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("should reject invalid visibility", () => {
    const result = agentSchema.safeParse({ name: "Test", visibility: "invalid" });
    expect(result.success).toBe(false);
  });

  it("should apply defaults", () => {
    const result = agentSchema.parse({ name: "Test" });
    expect(result.visibility).toBe("private");
    expect(result.toolApprovalMode).toBe("always-ask");
    expect(result.memoryScope).toBe("per-user");
  });

  it("should reject maxSteps over 100", () => {
    const result = agentSchema.safeParse({ name: "Test", maxSteps: 101 });
    expect(result.success).toBe(false);
  });
});

describe("Agent memory validation", () => {
  const memorySchema = z.object({
    key: z.string().min(1).max(500),
    value: z.any(),
    scope: z.enum(["per-user", "per-conversation", "global"]),
  });

  it("should accept valid memory entry", () => {
    const result = memorySchema.safeParse({
      key: "user-preference",
      value: { theme: "dark" },
      scope: "per-user",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty key", () => {
    const result = memorySchema.safeParse({ key: "", value: "test", scope: "global" });
    expect(result.success).toBe(false);
  });
});
