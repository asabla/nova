import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { chatCompletion, streamChatCompletion, openai } from "../lib/litellm";
import { writeAuditLog } from "../services/audit.service";

const v1ChatRoutes = new Hono<AppContext>();

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().nullable().optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
});

const toolSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.unknown()).optional(),
  }),
});

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(messageSchema),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().optional(),
  stream: z.boolean().optional(),
  top_p: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  tools: z.array(toolSchema).optional(),
  tool_choice: z.union([z.string(), z.object({ type: z.string(), function: z.object({ name: z.string() }) })]).optional(),
  response_format: z.object({ type: z.enum(["text", "json_object"]) }).optional(),
  seed: z.number().int().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  n: z.number().int().min(1).max(5).optional(),
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
    const stream = await streamChatCompletion({
      model: body.model,
      messages: body.messages as Array<{ role: string; content: string }>,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      top_p: body.top_p,
      tools: body.tools,
      tool_choice: body.tool_choice,
      response_format: body.response_format,
      stop: body.stop,
    });

    return new Response(stream.toReadableStream(), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  const result = await chatCompletion({
    model: body.model,
    messages: body.messages as Array<{ role: string; content: string }>,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
    tools: body.tools,
    tool_choice: body.tool_choice,
    response_format: body.response_format,
    stop: body.stop,
  });

  return c.json(result);
});

// OpenAI-compatible embeddings endpoint
const embeddingSchema = z.object({
  model: z.string().default("lmstudio/text-embedding-nomic-embed-text-v1.5"),
  input: z.union([z.string(), z.array(z.string())]),
  encoding_format: z.enum(["float", "base64"]).optional(),
});

v1ChatRoutes.post("/../embeddings", async (c) => {
  const orgId = c.get("orgId");
  const body = embeddingSchema.parse(await c.req.json());
  const inputs = Array.isArray(body.input) ? body.input : [body.input];

  const result = await openai.embeddings.create({
    model: body.model,
    input: inputs,
    encoding_format: body.encoding_format,
  });

  return c.json(result);
});

// List available models (OpenAI-compatible)
v1ChatRoutes.get("/../models", async (c) => {
  const { listModels } = await import("../lib/litellm");
  const modelsPage = await listModels();
  const modelList = modelsPage?.data ?? [];
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

// Get specific model
v1ChatRoutes.get("/../models/:modelId", async (c) => {
  const modelId = c.req.param("modelId");
  return c.json({
    id: modelId,
    object: "model",
    created: Date.now(),
    owned_by: "nova",
  });
});

// --- Agent REST API (Story #108) ---

const agentRunSchema = z.object({
  agent_id: z.string().uuid(),
  input: z.string().min(1).max(50000),
  stream: z.boolean().optional().default(false),
});

v1ChatRoutes.post("/../agents/run", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = agentRunSchema.parse(await c.req.json());

  // Load agent config
  const { agentService } = await import("../services/agent.service");
  const agent = await agentService.get(orgId, body.agent_id);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "api.agent_run",
    resourceType: "agent",
    resourceId: agent.id,
  });

  // Build messages from agent config
  const messages: Array<{ role: string; content: string }> = [];
  if (agent.systemPrompt) {
    messages.push({ role: "system", content: agent.systemPrompt });
  }
  messages.push({ role: "user", content: body.input });

  const modelParams = (agent.modelParams as Record<string, unknown>) ?? {};

  if (body.stream) {
    const stream = await streamChatCompletion({
      model: agent.modelId ?? "default",
      messages,
      temperature: modelParams.temperature as number | undefined,
      max_tokens: modelParams.maxTokens as number | undefined,
      top_p: modelParams.topP as number | undefined,
    });

    return new Response(stream.toReadableStream(), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  const result = await chatCompletion({
    model: agent.modelId ?? "default",
    messages,
    temperature: modelParams.temperature as number | undefined,
    max_tokens: modelParams.maxTokens as number | undefined,
    top_p: modelParams.topP as number | undefined,
  });

  return c.json({
    agent_id: agent.id,
    agent_name: agent.name,
    content: result.choices?.[0]?.message?.content ?? "",
    model: result.model,
    usage: result.usage,
  });
});

export { v1ChatRoutes };
