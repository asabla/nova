import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { chatCompletion, streamChatCompletion } from "../lib/litellm";
import { writeAuditLog } from "../services/audit.service";

const v1ChatRoutes = new Hono<AppContext>();

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().optional(),
  stream: z.boolean().optional(),
  top_p: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
});

// OpenAI-compatible chat completions endpoint
v1ChatRoutes.post("/completions", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = chatCompletionSchema.parse(await c.req.json());

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "api.chat_completion",
    resourceType: "model",
    details: { model: body.model, messageCount: body.messages.length, stream: !!body.stream },
  });

  if (body.stream) {
    return streamChatCompletion(c, {
      model: body.model,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      top_p: body.top_p,
    });
  }

  const result = await chatCompletion({
    model: body.model,
    messages: body.messages,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  });

  return c.json(result);
});

// List available models (OpenAI-compatible)
v1ChatRoutes.get("/../models", async (c) => {
  const { listModels } = await import("../lib/litellm");
  const result = await listModels() as any;
  const modelList = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
  return c.json({
    object: "list",
    data: modelList.map((m: any) => ({
      id: m.id ?? m.model_name,
      object: "model",
      created: Date.now(),
      owned_by: "nova",
    })),
  });
});

export { v1ChatRoutes };
