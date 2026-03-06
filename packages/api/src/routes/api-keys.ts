import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { apikeyService } from "../services/apikey.service";
import { writeAuditLog } from "../services/audit.service";

const apiKeyRoutes = new Hono<AppContext>();

apiKeyRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const keys = await apikeyService.list(orgId, userId);
  return c.json({ data: keys });
});

apiKeyRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { name } = z.object({ name: z.string().min(1).max(100) }).parse(await c.req.json());

  const result = await apikeyService.create(orgId, userId, name);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "apikey.create", resourceType: "api_key", resourceId: result.id });
  return c.json({ id: result.id, key: result.key, keyPrefix: result.keyPrefix }, 201);
});

apiKeyRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await apikeyService.revoke(orgId, userId, c.req.param("id"));
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "apikey.revoke", resourceType: "api_key", resourceId: c.req.param("id") });
  return c.body(null, 204);
});

export { apiKeyRoutes };
