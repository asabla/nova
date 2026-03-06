import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppContext } from "../types/context";
import * as conversationService from "../services/conversation.service";
import { writeAuditLog } from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const conversations = new Hono<AppContext>();

// --- Bulk endpoints (must be defined before /:id to avoid route conflicts) ---

const bulkQuerySchema = z.object({
  ids: z.string().transform((v) => v.split(",").filter(Boolean)),
});

conversations.get("/bulk", zValidator("query", bulkQuerySchema), async (c) => {
  const orgId = c.get("orgId");
  const { ids } = c.req.valid("query");
  if (ids.length === 0) return c.json([]);
  const result = await conversationService.getConversationsByIds(orgId, ids);
  return c.json(result);
});

const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["archive", "delete", "move-to-folder"]),
  payload: z
    .object({
      folderId: z.string().uuid().optional(),
    })
    .optional(),
});

conversations.post("/bulk", zValidator("json", bulkActionSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { ids, action, payload } = c.req.valid("json");
  const result = await conversationService.bulkAction(orgId, userId, ids, action, payload);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: `conversation.bulk.${action}`,
    resourceType: "conversation",
    resourceId: ids[0],
    details: { ids, bulkAction: action, affected: result.affected },
  });

  return c.json(result);
});

// --- List / query ---

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  workspaceId: z.string().uuid().optional(),
  isArchived: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  isPinned: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

conversations.get("/", zValidator("query", querySchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { page, pageSize, ...filters } = c.req.valid("query");
  const result = await conversationService.listConversations(orgId, userId, { page, pageSize }, filters);
  return c.json(result);
});

conversations.get("/:id", async (c) => {
  const orgId = c.get("orgId");
  const conversation = await conversationService.getConversation(orgId, c.req.param("id"));
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json(conversation);
});

const createSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  modelId: z.string().uuid().optional(),
  visibility: z.enum(["private", "team", "public"]).optional(),
  workspaceId: z.string().uuid().optional(),
});

conversations.post("/", zValidator("json", createSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");
  const conversation = await conversationService.createConversation(orgId, userId, data);

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "conversation.create",
    resourceType: "conversation",
    resourceId: conversation.id,
  });

  return c.json(conversation, 201);
});

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  systemPrompt: z.string().max(10_000).optional(),
  modelId: z.string().uuid().optional(),
  visibility: z.enum(["private", "team", "public"]).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

conversations.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const orgId = c.get("orgId");
  const data = c.req.valid("json");
  const conversation = await conversationService.updateConversation(orgId, c.req.param("id"), data);
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json(conversation);
});

conversations.delete("/:id", async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const conversation = await conversationService.deleteConversation(orgId, c.req.param("id"));
  if (!conversation) throw AppError.notFound("Conversation");

  await writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "conversation.delete",
    resourceType: "conversation",
    resourceId: conversation.id,
  });

  return c.json({ ok: true });
});

conversations.post("/:id/archive", async (c) => {
  const orgId = c.get("orgId");
  const conversation = await conversationService.archiveConversation(orgId, c.req.param("id"));
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json(conversation);
});

conversations.post("/:id/pin", zValidator("json", z.object({ isPinned: z.boolean() })), async (c) => {
  const orgId = c.get("orgId");
  const { isPinned } = c.req.valid("json");
  const conversation = await conversationService.pinConversation(orgId, c.req.param("id"), isPinned);
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json(conversation);
});

conversations.post(
  "/:id/fork",
  zValidator("json", z.object({ messageId: z.string().uuid().optional() })),
  async (c) => {
    const orgId = c.get("orgId");
    const userId = c.get("userId");
    const { messageId } = c.req.valid("json");
    const forked = await conversationService.forkConversation(orgId, userId, c.req.param("id"), messageId);
    if (!forked) throw AppError.notFound("Conversation");
    return c.json(forked, 201);
  },
);

conversations.post("/:id/share", async (c) => {
  const orgId = c.get("orgId");
  const conversation = await conversationService.generateShareToken(orgId, c.req.param("id"));
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json({ shareToken: conversation.publicShareToken });
});

// --- Model params ---

const modelParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
});

conversations.patch("/:id/model-params", zValidator("json", modelParamsSchema), async (c) => {
  const orgId = c.get("orgId");
  const params = c.req.valid("json");
  const conversation = await conversationService.updateModelParams(orgId, c.req.param("id"), params);
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json(conversation);
});

// --- System prompt ---

const systemPromptSchema = z.object({
  systemPrompt: z.string().max(10_000),
});

conversations.patch("/:id/system-prompt", zValidator("json", systemPromptSchema), async (c) => {
  const orgId = c.get("orgId");
  const { systemPrompt } = c.req.valid("json");
  const conversation = await conversationService.updateConversation(orgId, c.req.param("id"), { systemPrompt });
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json(conversation);
});

// --- Visibility ---

const visibilitySchema = z.object({
  visibility: z.enum(["private", "team", "public"]),
});

conversations.patch("/:id/visibility", zValidator("json", visibilitySchema), async (c) => {
  const orgId = c.get("orgId");
  const { visibility } = c.req.valid("json");
  const conversation = await conversationService.updateConversation(orgId, c.req.param("id"), { visibility });
  if (!conversation) throw AppError.notFound("Conversation");
  return c.json(conversation);
});

// --- Participants ---

conversations.get("/:id/participants", async (c) => {
  const orgId = c.get("orgId");
  const participants = await conversationService.listParticipants(orgId, c.req.param("id"));
  return c.json(participants);
});

const addParticipantSchema = z.object({
  userId: z.string().uuid(),
});

conversations.post("/:id/participants", zValidator("json", addParticipantSchema), async (c) => {
  const orgId = c.get("orgId");
  const { userId } = c.req.valid("json");
  const participant = await conversationService.addParticipant(orgId, c.req.param("id"), userId);
  if (!participant) throw AppError.notFound("Conversation");

  await writeAuditLog({
    orgId,
    actorId: c.get("userId"),
    actorType: "user",
    action: "conversation.participant.add",
    resourceType: "conversation",
    resourceId: c.req.param("id"),
    details: { addedUserId: userId },
  });

  return c.json(participant, 201);
});

conversations.delete("/:id/participants/:userId", async (c) => {
  const orgId = c.get("orgId");
  const conversationId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const removed = await conversationService.removeParticipant(orgId, conversationId, targetUserId);
  if (!removed) throw AppError.notFound("Participant");

  await writeAuditLog({
    orgId,
    actorId: c.get("userId"),
    actorType: "user",
    action: "conversation.participant.remove",
    resourceType: "conversation",
    resourceId: conversationId,
    details: { removedUserId: targetUserId },
  });

  return c.json({ ok: true });
});

export { conversations as conversationRoutes };
