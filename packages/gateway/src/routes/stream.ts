import { Hono } from "hono";
import type { GatewayEnv } from "../app";
import {
  publishToken,
  publishToolStatus,
  publishContentClear,
  publishDone,
  publishError,
  publishTierAssessed,
  publishPlanGeneratedV2,
  publishPlanApproved,
  publishPlanNodeStatus,
  publishInteractionRequest,
  publishResearchStatus,
  publishResearchSource,
  publishResearchProgress,
  publishResearchDone,
  publishResearchError,
  publishRetry,
  initStreamBuffer,
  cleanupStreamBuffer,
} from "@nova/worker-shared/stream";

export const streamRoutes = new Hono<GatewayEnv>();

streamRoutes.post("/init", async (c) => {
  const { channelId, conversationId } = await c.req.json();
  await initStreamBuffer(channelId, conversationId);
  return c.json({ ok: true });
});

streamRoutes.post("/cleanup", async (c) => {
  const { channelId } = await c.req.json();
  await cleanupStreamBuffer(channelId);
  return c.json({ ok: true });
});

streamRoutes.post("/token", async (c) => {
  const { channelId, token } = await c.req.json();
  await publishToken(channelId, token);
  return c.json({ ok: true });
});

streamRoutes.post("/tool-status", async (c) => {
  const { channelId, tool, status, args, resultSummary } = await c.req.json();
  await publishToolStatus(channelId, tool, status, { args, resultSummary });
  return c.json({ ok: true });
});

streamRoutes.post("/content-clear", async (c) => {
  const { channelId, reason } = await c.req.json();
  await publishContentClear(channelId, reason);
  return c.json({ ok: true });
});

streamRoutes.post("/done", async (c) => {
  const { channelId, content, usage } = await c.req.json();
  await publishDone(channelId, { content, usage });
  return c.json({ ok: true });
});

streamRoutes.post("/error", async (c) => {
  const { channelId, message } = await c.req.json();
  await publishError(channelId, message);
  return c.json({ ok: true });
});

streamRoutes.post("/tier-assessed", async (c) => {
  const { channelId, tier, reasoning } = await c.req.json();
  await publishTierAssessed(channelId, { tier, reasoning });
  return c.json({ ok: true });
});

streamRoutes.post("/plan-generated", async (c) => {
  const { channelId, plan } = await c.req.json();
  await publishPlanGeneratedV2(channelId, plan);
  return c.json({ ok: true });
});

streamRoutes.post("/plan-approved", async (c) => {
  const { channelId, planId } = await c.req.json();
  await publishPlanApproved(channelId, planId);
  return c.json({ ok: true });
});

streamRoutes.post("/plan-node-status", async (c) => {
  const { channelId, nodeId, status, detail } = await c.req.json();
  await publishPlanNodeStatus(channelId, { nodeId, status, detail });
  return c.json({ ok: true });
});

streamRoutes.post("/interaction-request", async (c) => {
  const { channelId, request } = await c.req.json();
  await publishInteractionRequest(channelId, request);
  return c.json({ ok: true });
});

streamRoutes.post("/research-status", async (c) => {
  const { channelId, status, phase } = await c.req.json();
  await publishResearchStatus(channelId, status, phase);
  return c.json({ ok: true });
});

streamRoutes.post("/research-source", async (c) => {
  const { channelId, title, url, relevance } = await c.req.json();
  await publishResearchSource(channelId, { title, url, relevance });
  return c.json({ ok: true });
});

streamRoutes.post("/research-progress", async (c) => {
  const { channelId, progressType, message, sourceUrl } = await c.req.json();
  await publishResearchProgress(channelId, progressType, message, { sourceUrl });
  return c.json({ ok: true });
});

streamRoutes.post("/research-done", async (c) => {
  const { channelId, reportId, sourcesCount } = await c.req.json();
  await publishResearchDone(channelId, { reportId, sourcesCount });
  return c.json({ ok: true });
});

streamRoutes.post("/research-error", async (c) => {
  const { channelId, message } = await c.req.json();
  await publishResearchError(channelId, message);
  return c.json({ ok: true });
});

streamRoutes.post("/retry", async (c) => {
  const { channelId, attempt, maxAttempts, error } = await c.req.json();
  await publishRetry(channelId, { attempt, maxAttempts, error });
  return c.json({ ok: true });
});
