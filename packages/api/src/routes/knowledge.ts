import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { knowledgeService } from "../services/knowledge.service";
import { writeAuditLog } from "../services/audit.service";
import { parsePagination } from "@nova/shared/utils";
import * as fileService from "../services/file.service";
import { minio } from "../lib/minio";
import { env } from "../lib/env";
import { getTemporalClient } from "../lib/temporal";
import { listModels } from "../lib/litellm";

const knowledgeRoutes = new Hono<AppContext>();

// List available embedding models from LiteLLM (must be before /:id to avoid conflict)
knowledgeRoutes.get("/models/embedding", async (c) => {
  try {
    const modelsPage = await listModels();
    const allModels = modelsPage?.data ?? [];
    const embeddingModels = allModels.filter((m: any) => {
      const id = (m.id ?? m.model_name ?? "").toLowerCase();
      return id.includes("embed");
    });
    return c.json({
      data: embeddingModels.map((m: any) => ({
        id: m.id ?? m.model_name,
        name: m.id ?? m.model_name,
      })),
    });
  } catch {
    return c.json({ data: [] });
  }
});

knowledgeRoutes.get("/", async (c) => {
  const orgId = c.get("orgId");
  const { limit, offset } = parsePagination(c.req.query());
  const search = c.req.query("search");
  const result = await knowledgeService.listCollections(orgId, { search, limit, offset });
  return c.json(result);
});

knowledgeRoutes.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const collection = await knowledgeService.getCollection(orgId, c.req.param("id"));
  return c.json(collection);
});

knowledgeRoutes.get("/:id/history", async (c) => {
  const orgId = c.get("orgId");
  const { limit, offset } = parsePagination(c.req.query());
  const result = await knowledgeService.getCollectionHistory(orgId, c.req.param("id"), { limit, offset });
  return c.json(result);
});

const createCollectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  embeddingModelId: z.string().uuid().optional(),
});

knowledgeRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createCollectionSchema.parse(await c.req.json());
  const collection = await knowledgeService.createCollection(orgId, userId, body);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "knowledge.collection.create", resourceType: "knowledge_collection", resourceId: collection.id });
  return c.json(collection, 201);
});

knowledgeRoutes.patch("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }).parse(await c.req.json());
  const collection = await knowledgeService.updateCollection(orgId, c.req.param("id"), body);
  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.collection.update",
    resourceType: "knowledge_collection",
    resourceId: c.req.param("id"),
    details: { changes: body },
  });
  return c.json(collection);
});

knowledgeRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await knowledgeService.deleteCollection(orgId, c.req.param("id"));
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "knowledge.collection.delete", resourceType: "knowledge_collection", resourceId: c.req.param("id") });
  return c.body(null, 204);
});

// Documents within a collection
knowledgeRoutes.get("/:id/documents", async (c) => {
  const orgId = c.get("orgId");
  const docs = await knowledgeService.listDocuments(orgId, c.req.param("id"));
  return c.json({ data: docs });
});

async function triggerDocumentIngestion(doc: { id: string; fileId?: string | null; sourceUrl?: string | null }, orgId: string, collectionId: string) {
  try {
    const client = await getTemporalClient();
    await client.workflow.start("documentIngestionWorkflow", {
      taskQueue: "nova-main",
      workflowId: `doc-ingest-${doc.id}`,
      args: [{
        orgId,
        collectionId,
        documentId: doc.id,
        fileId: doc.fileId ?? undefined,
        sourceUrl: doc.sourceUrl ?? undefined,
      }],
    });
  } catch (err) {
    console.error(`[knowledge] Failed to start ingestion workflow for doc ${doc.id}:`, err);
  }
}

const addDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  sourceUrl: z.string().url().optional(),
  fileId: z.string().uuid().optional(),
  content: z.string().max(500_000).optional(),
});

knowledgeRoutes.post("/:id/documents", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const collectionId = c.req.param("id");
  const body = addDocumentSchema.parse(await c.req.json());
  const doc = await knowledgeService.addDocument(orgId, collectionId, body);
  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.collection.document_add",
    resourceType: "knowledge_collection",
    resourceId: collectionId,
    details: { documentId: doc.id, title: body.title },
  });
  await triggerDocumentIngestion(doc, orgId, collectionId);
  return c.json(doc, 201);
});

// Upload files directly to a collection (multipart/form-data)
knowledgeRoutes.post("/:id/documents/upload", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const collectionId = c.req.param("id");

  // Verify collection exists
  await knowledgeService.getCollection(orgId, collectionId);

  const body = await c.req.parseBody({ all: true });
  const rawFiles = body["files"];
  const fileList = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : [];
  const uploadedFiles = fileList.filter((f): f is File => f instanceof File);

  if (uploadedFiles.length === 0) {
    return c.json({ title: "No files provided" }, 400);
  }

  const docs = [];
  for (const file of uploadedFiles) {
    const contentType = file.type || "application/octet-stream";
    const key = `${orgId}/${crypto.randomUUID()}/${file.name}`;

    // Upload directly to MinIO via the client (avoids presigned URL localhost issues in Docker)
    const buffer = Buffer.from(await file.arrayBuffer());
    await minio.putObject(env.MINIO_BUCKET, key, buffer, buffer.length, {
      "Content-Type": contentType,
    });

    // Create file record in DB
    const fileRecord = await fileService.createFileRecord(orgId, userId, file.name, contentType, file.size, key);

    // Create knowledge document linked to the file
    const doc = await knowledgeService.addDocument(orgId, collectionId, {
      title: file.name,
      fileId: fileRecord.id,
    });

    await writeAuditLog({
      orgId,
      actorId: userId,
      actorType: "user",
      action: "knowledge.collection.document_add",
      resourceType: "knowledge_collection",
      resourceId: collectionId,
      details: { documentId: doc.id, title: file.name },
    });

    await triggerDocumentIngestion(doc, orgId, collectionId);
    docs.push(doc);
  }

  return c.json({ data: docs }, 201);
});

knowledgeRoutes.delete("/:collectionId/documents/:docId", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await knowledgeService.removeDocument(orgId, c.req.param("docId"));
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "knowledge.document.delete", resourceType: "knowledge_document", resourceId: c.req.param("docId") });
  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "knowledge.collection.document_remove",
    resourceType: "knowledge_collection",
    resourceId: c.req.param("collectionId"),
    details: { documentId: c.req.param("docId") },
  });
  return c.body(null, 204);
});

// Delete a document by ID (without needing collection ID in path)
knowledgeRoutes.delete("/documents/:docId", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await knowledgeService.removeDocument(orgId, c.req.param("docId"));
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "knowledge.document.delete", resourceType: "knowledge_document", resourceId: c.req.param("docId") });
  return c.body(null, 204);
});

// Re-index all documents in a collection
knowledgeRoutes.post("/:id/reindex", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const collectionId = c.req.param("id");
  const collection = await knowledgeService.reindexCollection(orgId, collectionId);

  // Trigger ingestion workflows for all pending documents
  const docs = await knowledgeService.listDocuments(orgId, collectionId);
  for (const doc of docs) {
    if (doc.status === "pending" && !doc.deletedAt) {
      await triggerDocumentIngestion(doc, orgId, collectionId);
    }
  }

  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "knowledge.collection.reindex", resourceType: "knowledge_collection", resourceId: collectionId });
  return c.json(collection);
});

// Semantic search against a collection
const querySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

knowledgeRoutes.post("/:id/query", async (c) => {
  const orgId = c.get("orgId");
  const body = querySchema.parse(await c.req.json());
  const results = await knowledgeService.queryCollection(orgId, c.req.param("id"), body.query, {
    topK: body.topK,
    threshold: body.threshold,
  });
  return c.json({ data: results });
});

// Get chunks for a specific document
knowledgeRoutes.get("/:id/documents/:docId/chunks", async (c) => {
  const orgId = c.get("orgId");
  const chunks = await knowledgeService.getChunks(orgId, c.req.param("docId"));
  return c.json({ data: chunks });
});

// Update embedding configuration
const updateConfigSchema = z.object({
  embeddingModel: z.string().optional(),
  chunkSize: z.number().int().min(64).max(8192).optional(),
  chunkOverlap: z.number().int().min(0).optional(),
});

knowledgeRoutes.patch("/:id/config", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = updateConfigSchema.parse(await c.req.json());
  const collection = await knowledgeService.updateCollectionConfig(orgId, c.req.param("id"), body);
  await writeAuditLog({ orgId, actorId: userId, actorType: "user", action: "knowledge.collection.config_update", resourceType: "knowledge_collection", resourceId: c.req.param("id") });
  return c.json(collection);
});

export { knowledgeRoutes };
