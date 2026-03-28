import { Hono } from "hono";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import type { AppContext } from "../types/context";
import { db } from "../lib/db";
import { customWorkers, insertCustomWorkerSchema, updateCustomWorkerSchema } from "@nova/shared/schemas";
import { writeAuditLog } from "../services/audit.service";
import crypto from "node:crypto";

const customWorkerRoutes = new Hono<AppContext>();

// List all custom workers for the org
customWorkerRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");

  const workers = await db
    .select()
    .from(customWorkers)
    .where(and(eq(customWorkers.orgId, orgId), isNull(customWorkers.deletedAt)));

  return c.json({ data: workers });
});

// Get a single custom worker
customWorkerRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const id = c.req.param("id");

  const [worker] = await db
    .select()
    .from(customWorkers)
    .where(and(eq(customWorkers.id, id), eq(customWorkers.orgId, orgId), isNull(customWorkers.deletedAt)))
    .limit(1);

  if (!worker) return c.json({ error: "Custom worker not found" }, 404);
  return c.json({ data: worker });
});

// Register a new custom worker
customWorkerRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = insertCustomWorkerSchema.parse(await c.req.json());

  // Generate HMAC shared secret for worker authentication
  const sharedSecret = crypto.randomBytes(32).toString("hex");

  const [worker] = await db
    .insert(customWorkers)
    .values({
      ...body,
      orgId,
      registeredById: userId,
      authSecretEncrypted: sharedSecret,
    })
    .returning();

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "custom_worker.create",
    resourceType: "custom_worker",
    resourceId: worker.id,
  });

  // Return the secret only on creation — it won't be shown again
  return c.json({ data: worker, secret: sharedSecret }, 201);
});

// Update a custom worker
customWorkerRoutes.patch("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = updateCustomWorkerSchema.parse(await c.req.json());

  const [worker] = await db
    .update(customWorkers)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(customWorkers.id, id), eq(customWorkers.orgId, orgId), isNull(customWorkers.deletedAt)))
    .returning();

  if (!worker) return c.json({ error: "Custom worker not found" }, 404);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "custom_worker.update",
    resourceType: "custom_worker",
    resourceId: id,
  });

  return c.json({ data: worker });
});

// Soft-delete a custom worker
customWorkerRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [worker] = await db
    .update(customWorkers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(customWorkers.id, id), eq(customWorkers.orgId, orgId), isNull(customWorkers.deletedAt)))
    .returning();

  if (!worker) return c.json({ error: "Custom worker not found" }, 404);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "custom_worker.delete",
    resourceType: "custom_worker",
    resourceId: id,
  });

  return c.body(null, 204);
});

// Test/health-check a custom worker
customWorkerRoutes.post("/:id/test", async (c) => {
  const orgId = c.get("orgId");
  const id = c.req.param("id");

  const [worker] = await db
    .select()
    .from(customWorkers)
    .where(and(eq(customWorkers.id, id), eq(customWorkers.orgId, orgId), isNull(customWorkers.deletedAt)))
    .limit(1);

  if (!worker) return c.json({ error: "Custom worker not found" }, 404);

  try {
    const response = await fetch(`${worker.url}/health`, {
      signal: AbortSignal.timeout(10_000),
    });

    const healthy = response.ok;
    const body = await response.json().catch(() => ({}));

    // Update health status
    await db
      .update(customWorkers)
      .set({
        healthStatus: healthy ? "healthy" : "unhealthy",
        lastHealthCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customWorkers.id, id));

    return c.json({
      healthy,
      status: response.status,
      body,
    });
  } catch (err: any) {
    // Update health status on failure
    await db
      .update(customWorkers)
      .set({
        healthStatus: "unhealthy",
        lastHealthCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customWorkers.id, id));

    return c.json({
      healthy: false,
      error: err.message ?? "Connection failed",
    });
  }
});

// Rotate the shared secret for a custom worker
customWorkerRoutes.post("/:id/rotate-secret", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const newSecret = crypto.randomBytes(32).toString("hex");

  const [worker] = await db
    .update(customWorkers)
    .set({ authSecretEncrypted: newSecret, updatedAt: new Date() })
    .where(and(eq(customWorkers.id, id), eq(customWorkers.orgId, orgId), isNull(customWorkers.deletedAt)))
    .returning();

  if (!worker) return c.json({ error: "Custom worker not found" }, 404);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "custom_worker.rotate_secret",
    resourceType: "custom_worker",
    resourceId: id,
  });

  return c.json({ secret: newSecret });
});

export { customWorkerRoutes };
