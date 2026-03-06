import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import * as artifactService from "../services/artifact.service";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const artifactRoutes = new Hono<AppContext>();

// List artifacts in a conversation
artifactRoutes.get("/conversations/:convId/artifacts", async (c) => {
  const orgId = c.get("orgId");
  const convId = c.req.param("convId");
  const artifacts = await artifactService.listArtifacts(orgId, convId);
  return c.json({ data: artifacts });
});

// Get single artifact
artifactRoutes.get("/artifacts/:id", async (c) => {
  const orgId = c.get("orgId");
  const artifact = await artifactService.getArtifact(orgId, c.req.param("id"));
  if (!artifact) throw AppError.notFound("Artifact");
  return c.json(artifact);
});

const createSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().max(500).optional(),
  content: z.string().optional(),
  fileId: z.string().uuid().optional(),
  language: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Create artifact manually
artifactRoutes.post("/artifacts", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createSchema.parse(await c.req.json());

  const artifact = await artifactService.createArtifact(orgId, body);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "artifact.create",
    resourceType: "artifact",
    resourceId: artifact.id,
    details: { type: body.type },
  });

  return c.json(artifact, 201);
});

// Delete artifact (soft delete)
artifactRoutes.delete("/artifacts/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const artifact = await artifactService.deleteArtifact(orgId, c.req.param("id"));
  if (!artifact) throw AppError.notFound("Artifact");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "artifact.delete",
    resourceType: "artifact",
    resourceId: artifact.id,
  });

  return c.json({ ok: true });
});

// Save artifact to user library (creates a file)
artifactRoutes.post("/artifacts/:id/save", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const file = await artifactService.saveToLibrary(orgId, c.req.param("id"), userId);
  if (!file) throw AppError.notFound("Artifact");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "artifact.save_to_library",
    resourceType: "artifact",
    resourceId: c.req.param("id"),
    details: { fileId: file.id },
  });

  return c.json({ ok: true, fileId: file.id });
});

// Download artifact content
artifactRoutes.post("/artifacts/:id/download", async (c) => {
  const orgId = c.get("orgId");
  const artifact = await artifactService.getArtifact(orgId, c.req.param("id"));
  if (!artifact) throw AppError.notFound("Artifact");

  const filename = artifact.title ?? "artifact";
  return new Response(artifact.content ?? "", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

export { artifactRoutes };
