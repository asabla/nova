import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { chatCompletion } from "../lib/litellm";
import { writeAuditLog } from "../services/audit.service";

const batchRoutes = new Hono<AppContext>();

const batchRequestSchema = z.object({
  requests: z.array(z.object({
    id: z.string().min(1),
    model: z.string().min(1),
    messages: z.array(z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })).min(1),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  })).min(1).max(50),
  webhookUrl: z.string().url().optional(),
});

// Synchronous batch - process all requests and return results
batchRoutes.post("/", zValidator("json", batchRequestSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { requests } = c.req.valid("json");

  const results = await Promise.allSettled(
    requests.map(async (req) => {
      const result = await chatCompletion({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        orgId,
      });

      return {
        id: req.id,
        status: "success" as const,
        result: {
          content: result.choices?.[0]?.message?.content ?? "",
          model: result.model,
          usage: result.usage,
        },
      };
    }),
  );

  const output = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      id: requests[i].id,
      status: "error" as const,
      error: r.reason?.message ?? "Unknown error",
    };
  });

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "batch.execute",
    resourceType: "batch",
    details: { requestCount: requests.length, successCount: output.filter((r) => r.status === "success").length },
  });

  return c.json({
    results: output,
    summary: {
      total: output.length,
      succeeded: output.filter((r) => r.status === "success").length,
      failed: output.filter((r) => r.status === "error").length,
    },
  });
});

export { batchRoutes };
