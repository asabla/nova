import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { insertConversationSchema, updateConversationSchema } from "@nova/shared/schema";
import type { AppContext } from "../types/context";
import * as conversationService from "../services/conversation.service";
import * as auditService from "../services/audit.service";
import { AppError } from "@nova/shared/utils";

const conversations = new Hono<AppContext>();

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

conversations.post("/", zValidator("json", insertConversationSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const data = c.req.valid("json");
  const conversation = await conversationService.createConversation(orgId, userId, data);

  await auditService.writeAuditLog({
    orgId,
    actorId: userId,
    actorType: "user",
    action: "conversation.create",
    resourceType: "conversation",
    resourceId: conversation.id,
  });

  return c.json(conversation, 201);
});

conversations.patch("/:id", zValidator("json", updateConversationSchema), async (c) => {
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

  await auditService.writeAuditLog({
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
  zValidator("json", z.object({ messageId: z.string().uuid() })),
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

export { conversations as conversationRoutes };
