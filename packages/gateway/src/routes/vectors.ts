import { Hono } from "hono";
import type { GatewayEnv } from "../app";
import {
  searchVector,
  upsertPoints,
  deletePointsByFilter,
  scrollFullText,
  scrollFiltered,
} from "@nova/worker-shared/qdrant";

export const vectorRoutes = new Hono<GatewayEnv>();

vectorRoutes.post("/search", async (c) => {
  const body = await c.req.json();

  const results = await searchVector(body.collection, body.query, {
    filter: body.filter,
    limit: body.limit,
    scoreThreshold: body.scoreThreshold,
    withPayload: body.withPayload ?? true,
  });

  return c.json(results);
});

vectorRoutes.post("/upsert", async (c) => {
  const body = await c.req.json();
  await upsertPoints(body.collection, body.points);
  return c.json({ ok: true });
});

vectorRoutes.post("/delete", async (c) => {
  const body = await c.req.json();
  await deletePointsByFilter(body.collection, body.filter);
  return c.json({ ok: true });
});

vectorRoutes.post("/scroll-text", async (c) => {
  const body = await c.req.json();

  const results = await scrollFullText(body.collection, body.field, body.query, {
    filter: body.filter,
    limit: body.limit,
  });

  return c.json(results);
});

vectorRoutes.post("/scroll-filtered", async (c) => {
  const body = await c.req.json();

  const results = await scrollFiltered(body.collection, {
    filter: body.filter,
    limit: body.limit,
  });

  return c.json(results);
});
