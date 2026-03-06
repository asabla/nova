import { Hono } from "hono";
import { z } from "zod";
import type { AppContext } from "../types/context";
import { knowledgeService } from "../services/knowledge.service";
import { auditService } from "../services/audit.service";
import { parsePagination } from "@nova/shared/utils";

const knowledgeRoutes = new Hono<AppContext>();

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

const createCollectionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  embeddingModel: z.string().optional(),
});

knowledgeRoutes.post("/", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = createCollectionSchema.parse(await c.req.json());
  const collection = await knowledgeService.createCollection(orgId, userId, body);
  await auditService.writeAuditLog({ orgId, userId, action: "knowledge.collection.create", resourceType: "knowledge_collection", resourceId: collection.id });
  return c.json(collection, 201);
});

knowledgeRoutes.patch("/:id", async (c) => {
  const orgId = c.get("orgId");
  const body = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
  }).parse(await c.req.json());
  const collection = await knowledgeService.updateCollection(orgId, c.req.param("id"), body);
  return c.json(collection);
});

knowledgeRoutes.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  await knowledgeService.deleteCollection(orgId, c.req.param("id"));
  await auditService.writeAuditLog({ orgId, userId, action: "knowledge.collection.delete", resourceType: "knowledge_collection", resourceId: c.req.param("id") });
  return c.body(null, 204);
});

// Documents within a collection
knowledgeRoutes.get("/:id/documents", async (c) => {
  const orgId = c.get("orgId");
  const docs = await knowledgeService.listDocuments(orgId, c.req.param("id"));
  return c.json({ data: docs });
});

const addDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  sourceUrl: z.string().url().optional(),
  fileId: z.string().uuid().optional(),
  content: z.string().max(10_000_000).optional(),
});

knowledgeRoutes.post("/:id/documents", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const body = addDocumentSchema.parse(await c.req.json());
  const doc = await knowledgeService.addDocument(orgId, c.req.param("id"), userId, body);
  return c.json(doc, 201);
});

knowledgeRoutes.delete("/:collectionId/documents/:docId", async (c) => {
  const orgId = c.get("orgId");
  await knowledgeService.deleteDocument(orgId, c.req.param("docId"));
  return c.body(null, 204);
});

export { knowledgeRoutes };
