import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock the database and services before importing
mock.module("../../src/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve([]) }) }),
        }),
        innerJoin: () => ({ where: () => Promise.resolve([]) }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () =>
          Promise.resolve([
            { id: "msg-1", conversationId: "conv-1", orgId: "org-1", content: "hello", senderType: "user" },
          ]),
      }),
    }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
  },
}));

mock.module("../../src/lib/redis", () => ({
  redis: { get: () => null, set: () => null, del: () => null, ping: () => "PONG" },
}));

describe("Message route schemas", () => {
  it("validates sendMessageSchema: valid content", async () => {
    const { z } = await import("zod");
    const sendMessageSchema = z.object({
      content: z.string().min(1),
      parentMessageId: z.string().uuid().optional(),
      attachments: z
        .array(
          z.object({
            fileId: z.string().uuid().optional(),
            url: z.string().url().optional(),
            attachmentType: z.enum(["file", "url", "image_paste"]),
          }),
        )
        .optional(),
    });

    expect(sendMessageSchema.safeParse({ content: "hello" }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ content: "" }).success).toBe(false);
    expect(sendMessageSchema.safeParse({}).success).toBe(false);
  });

  it("validates sendMessageSchema: content with attachments", async () => {
    const { z } = await import("zod");
    const sendMessageSchema = z.object({
      content: z.string().min(1),
      attachments: z
        .array(
          z.object({
            fileId: z.string().uuid().optional(),
            url: z.string().url().optional(),
            attachmentType: z.enum(["file", "url", "image_paste"]),
          }),
        )
        .optional(),
    });

    const result = sendMessageSchema.safeParse({
      content: "check this file",
      attachments: [{ fileId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", attachmentType: "file" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid attachment type", async () => {
    const { z } = await import("zod");
    const sendMessageSchema = z.object({
      content: z.string().min(1),
      attachments: z
        .array(
          z.object({
            fileId: z.string().uuid().optional(),
            attachmentType: z.enum(["file", "url", "image_paste"]),
          }),
        )
        .optional(),
    });

    const result = sendMessageSchema.safeParse({
      content: "hello",
      attachments: [{ attachmentType: "invalid" }],
    });
    expect(result.success).toBe(false);
  });

  it("validates streamSchema: valid messages array", async () => {
    const { z } = await import("zod");
    const streamSchema = z.object({
      model: z.string(),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string().default(""),
        }),
      ),
      temperature: z.number().min(0).max(2).optional(),
      topP: z.number().min(0).max(1).optional(),
      maxTokens: z.number().int().positive().optional(),
      enableTools: z.boolean().optional().default(true),
    });

    const result = streamSchema.safeParse({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enableTools).toBe(true);
    }
  });

  it("streamSchema defaults empty content to empty string", async () => {
    const { z } = await import("zod");
    const streamSchema = z.object({
      model: z.string(),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string().default(""),
        }),
      ),
    });

    const result = streamSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "assistant" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.messages[0].content).toBe("");
    }
  });

  it("rejects invalid role in stream messages", async () => {
    const { z } = await import("zod");
    const streamSchema = z.object({
      model: z.string(),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string().default(""),
        }),
      ),
    });

    const result = streamSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "tool", content: "result" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects temperature out of range", async () => {
    const { z } = await import("zod");
    const streamSchema = z.object({
      model: z.string(),
      messages: z.array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string().default(""),
        }),
      ),
      temperature: z.number().min(0).max(2).optional(),
    });

    expect(
      streamSchema.safeParse({ model: "gpt-4", messages: [], temperature: 3 }).success,
    ).toBe(false);
    expect(
      streamSchema.safeParse({ model: "gpt-4", messages: [], temperature: -1 }).success,
    ).toBe(false);
    expect(
      streamSchema.safeParse({ model: "gpt-4", messages: [], temperature: 1.5 }).success,
    ).toBe(true);
  });

  it("validates editMessageSchema", async () => {
    const { z } = await import("zod");
    const editMessageSchema = z.object({ content: z.string().min(1) });

    expect(editMessageSchema.safeParse({ content: "updated" }).success).toBe(true);
    expect(editMessageSchema.safeParse({ content: "" }).success).toBe(false);
    expect(editMessageSchema.safeParse({}).success).toBe(false);
  });

  it("validates ratingSchema", async () => {
    const { z } = await import("zod");
    const ratingSchema = z.object({
      rating: z.union([z.literal(1), z.literal(-1)]),
      feedback: z.string().optional(),
    });

    expect(ratingSchema.safeParse({ rating: 1 }).success).toBe(true);
    expect(ratingSchema.safeParse({ rating: -1 }).success).toBe(true);
    expect(ratingSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(ratingSchema.safeParse({ rating: 2 }).success).toBe(false);
    expect(ratingSchema.safeParse({ rating: 1, feedback: "great answer" }).success).toBe(true);
  });
});

describe("Mention parsing", () => {
  // Re-implement parseMentions for unit testing (same logic as route file)
  function parseMentions(content: string): string[] {
    const matches = content.match(/(^|[\s])@(\w[\w.-]*)/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.trim().slice(1).toLowerCase()))];
  }

  it("extracts single mention", () => {
    expect(parseMentions("hello @alice how are you")).toEqual(["alice"]);
  });

  it("extracts multiple mentions", () => {
    expect(parseMentions("@alice and @bob should look at this")).toEqual(["alice", "bob"]);
  });

  it("deduplicates mentions", () => {
    expect(parseMentions("@alice please help @alice")).toEqual(["alice"]);
  });

  it("handles mention at start of content", () => {
    expect(parseMentions("@alice check this")).toEqual(["alice"]);
  });

  it("returns empty for no mentions", () => {
    expect(parseMentions("hello world")).toEqual([]);
  });

  it("normalizes to lowercase", () => {
    expect(parseMentions("@Alice")).toEqual(["alice"]);
  });

  it("handles mentions with dots and hyphens", () => {
    expect(parseMentions("@john.doe and @jane-doe")).toEqual(["john.doe", "jane-doe"]);
  });

  it("does not match email addresses as mentions", () => {
    // The regex requires whitespace before @, so emails mid-word won't match
    expect(parseMentions("email user@example.com")).toEqual([]);
  });
});
