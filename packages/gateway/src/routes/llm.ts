import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { GatewayEnv } from "../app";
import { resolveModelClient, getDefaultChatModel, getDefaultEmbeddingModel, getVisionModel, buildChatParams } from "@nova/worker-shared/models";

export const llmRoutes = new Hono<GatewayEnv>();

llmRoutes.post("/chat/completions", async (c) => {
  const orgId = c.get("orgId");
  const body = await c.req.json();

  const { client, modelId } = await resolveModelClient(orgId, body.model);
  const params = await buildChatParams(modelId, {
    model: modelId,
    messages: body.messages,
    temperature: body.temperature,
    max_tokens: body.maxTokens,
    tools: body.tools,
  });

  if (body.stream) {
    // Return SSE stream
    const response = await client.chat.completions.create({
      ...params,
      stream: true,
    } as any);

    return stream(c, async (sseStream) => {
      for await (const chunk of response as any) {
        await sseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      await sseStream.write("data: [DONE]\n\n");
    });
  }

  const result = await client.chat.completions.create(params as any);
  return c.json(result);
});

llmRoutes.post("/embeddings", async (c) => {
  const orgId = c.get("orgId");
  const body = await c.req.json();

  const embeddingModel = body.model ?? await getDefaultEmbeddingModel();
  const { client } = await resolveModelClient(orgId, embeddingModel);

  const result = await client.embeddings.create({
    model: embeddingModel,
    input: body.input,
  });

  return c.json(result);
});

llmRoutes.get("/models/default", async (c) => {
  const chatModel = await getDefaultChatModel();
  const embeddingModel = await getDefaultEmbeddingModel();
  const visionModel = await getVisionModel();

  return c.json({
    chat: chatModel,
    embedding: embeddingModel,
    vision: visionModel,
  });
});
