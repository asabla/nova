import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { AppContext } from "../types/context";
import * as messageService from "../services/message.service";
import * as conversationService from "../services/conversation.service";
import { chatCompletion } from "../lib/litellm";
import { AppError } from "@nova/shared/utils";
import { DEFAULTS } from "@nova/shared/constants";
import { notificationService } from "../services/notification.service";
import { db } from "../lib/db";
import { userProfiles, users, agents } from "@nova/shared/schemas";
import { eq, and, isNull } from "drizzle-orm";

// --- Mention helpers (stories #45, #46) ---

/** Extract all @mentions from message content */
function parseMentions(content: string): string[] {
  const matches = content.match(/(^|[\s])@(\w[\w.-]*)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.trim().slice(1).toLowerCase()))];
}

/** Resolve mention usernames to user IDs and agent IDs within an org */
async function resolveMentions(orgId: string, usernames: string[]) {
  if (usernames.length === 0) return { userIds: [], agentIds: [] };

  // Look up users by displayName (lowered, spaces -> dots)
  const allProfiles = await db
    .select({ userId: userProfiles.userId, displayName: userProfiles.displayName })
    .from(userProfiles)
    .innerJoin(users, eq(userProfiles.userId, users.id))
    .where(and(eq(userProfiles.orgId, orgId), isNull(userProfiles.deletedAt), eq(users.isActive, true)));

  const userIds: string[] = [];
  for (const profile of allProfiles) {
    const normalised = (profile.displayName ?? "").toLowerCase().replace(/\s+/g, ".");
    if (usernames.includes(normalised)) {
      userIds.push(profile.userId);
    }
  }

  // Also check email-prefix matches (for users without displayName)
  if (userIds.length < usernames.length) {
    const allUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(eq(users.isActive, true), isNull(users.deletedAt)));

    for (const u of allUsers) {
      const prefix = u.email.split("@")[0].toLowerCase();
      if (usernames.includes(prefix) && !userIds.includes(u.id)) {
        userIds.push(u.id);
      }
    }
  }

  // Look up agents by name (lowered, spaces -> hyphens)
  const allAgents = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(and(eq(agents.orgId, orgId), eq(agents.isEnabled, true), isNull(agents.deletedAt)));

  const agentIds: string[] = [];
  for (const agent of allAgents) {
    const normalised = agent.name.toLowerCase().replace(/\s+/g, "-");
    if (usernames.includes(normalised)) {
      agentIds.push(agent.id);
    }
  }

  return { userIds, agentIds };
}

/** Fire-and-forget: create notifications for mentioned users and handle agent mentions */
async function processMentions(
  orgId: string,
  senderUserId: string,
  conversationId: string,
  content: string,
) {
  const usernames = parseMentions(content);
  if (usernames.length === 0) return;

  const { userIds, agentIds } = await resolveMentions(orgId, usernames);

  // Notify mentioned users (skip self-mentions)
  for (const mentionedUserId of userIds) {
    if (mentionedUserId === senderUserId) continue;
    await notificationService.notifyMention(orgId, senderUserId, mentionedUserId, conversationId, content);
  }

  // For agent mentions, log notification for future agent-response triggering
  for (const agentId of agentIds) {
    await notificationService.create({
      orgId,
      userId: senderUserId,
      type: "agent_mentioned",
      title: "Agent mentioned in conversation",
      body: content.slice(0, 200),
      resourceType: "conversation",
      resourceId: conversationId,
    });
  }
}

const messagesRouter = new Hono<AppContext>();

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

messagesRouter.get("/:conversationId/messages", zValidator("query", listQuerySchema), async (c) => {
  const orgId = c.get("orgId");
  const result = await messageService.listMessages(orgId, c.req.param("conversationId"), c.req.valid("query"));
  return c.json(result);
});

messagesRouter.get("/:conversationId/messages/:messageId", async (c) => {
  const orgId = c.get("orgId");
  const message = await messageService.getMessage(orgId, c.req.param("messageId"));
  if (!message) throw AppError.notFound("Message");
  return c.json(message);
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
  parentMessageId: z.string().uuid().optional(),
  attachments: z.array(z.object({
    fileId: z.string().uuid().optional(),
    url: z.string().url().optional(),
    attachmentType: z.enum(["file", "url", "image_paste"]),
  })).optional(),
});

messagesRouter.post("/:conversationId/messages", zValidator("json", sendMessageSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const conversationId = c.req.param("conversationId");
  const data = c.req.valid("json");

  const conversation = await conversationService.getConversation(orgId, conversationId);
  if (!conversation) throw AppError.notFound("Conversation");

  const userMessage = await messageService.createMessage(orgId, {
    conversationId,
    senderType: "user",
    senderUserId: userId,
    content: data.content,
  });

  if (data.attachments) {
    for (const attachment of data.attachments) {
      await messageService.addAttachment(orgId, userMessage.id, attachment);
    }
  }

  // Process @mentions: create notifications for mentioned users, handle agent mentions.
  // Fire-and-forget to avoid blocking the response.
  processMentions(orgId, userId, conversationId, data.content).catch((err) => {
    console.error("[mentions] Failed to process mentions:", err);
  });

  return c.json(userMessage, 201);
});

const streamSchema = z.object({
  model: z.string(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
});

messagesRouter.post("/:conversationId/messages/stream", zValidator("json", streamSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const conversationId = c.req.param("conversationId");
  const body = c.req.valid("json");

  const conversation = await conversationService.getConversation(orgId, conversationId);
  if (!conversation) throw AppError.notFound("Conversation");

  return streamSSE(c, async (stream) => {
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: "heartbeat", data: "" });
    }, DEFAULTS.SSE_HEARTBEAT_INTERVAL_MS);

    try {
      const startTime = Date.now();
      const response = await chatCompletion({
        model: body.model,
        messages: body.messages,
        stream: true,
        temperature: body.temperature,
        top_p: body.topP,
        max_tokens: body.maxTokens,
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "Unknown error");
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "Model API error", code: `${response.status}`, detail: errBody }),
        });
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              const token = data.choices?.[0]?.delta?.content;
              if (token) {
                fullContent += token;
                await stream.writeSSE({
                  event: "token",
                  data: JSON.stringify({ content: token }),
                });
              }
              if (data.usage) {
                usageData = data.usage;
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      const promptTokens = usageData?.prompt_tokens ?? Math.ceil(JSON.stringify(body.messages).length / 4);
      const completionTokens = usageData?.completion_tokens ?? Math.ceil(fullContent.length / 4);

      const assistantMessage = await messageService.createMessage(orgId, {
        conversationId,
        senderType: "assistant",
        content: fullContent,
        modelId: conversation.modelId ?? undefined,
        tokenCountPrompt: promptTokens,
        tokenCountCompletion: completionTokens,
        metadata: { latencyMs, model: body.model },
      });

      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          messageId: assistantMessage.id,
          tokenCountPrompt: promptTokens,
          tokenCountCompletion: completionTokens,
          latencyMs,
        }),
      });
    } catch (err) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: "Stream error", code: "stream_error" }),
      });
    } finally {
      clearInterval(heartbeat);
    }
  });
});

const editMessageSchema = z.object({
  content: z.string().min(1),
});

messagesRouter.patch("/:conversationId/messages/:messageId", zValidator("json", editMessageSchema), async (c) => {
  const orgId = c.get("orgId");
  const message = await messageService.editMessage(orgId, c.req.param("messageId"), c.req.valid("json").content);
  if (!message) throw AppError.notFound("Message");
  return c.json(message);
});

messagesRouter.delete("/:conversationId/messages/:messageId", async (c) => {
  const orgId = c.get("orgId");
  const message = await messageService.deleteMessage(orgId, c.req.param("messageId"));
  if (!message) throw AppError.notFound("Message");
  return c.json({ ok: true });
});

const ratingSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  feedback: z.string().optional(),
});

messagesRouter.post("/:conversationId/messages/:messageId/rate", zValidator("json", ratingSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { rating, feedback } = c.req.valid("json");
  const result = await messageService.rateMessage(orgId, c.req.param("messageId"), userId, rating, feedback);
  return c.json(result);
});

const noteSchema = z.object({
  content: z.string().min(1),
});

messagesRouter.post("/:conversationId/messages/:messageId/notes", zValidator("json", noteSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const { content } = c.req.valid("json");
  const note = await messageService.addNote(orgId, c.req.param("messageId"), userId, content);
  return c.json(note, 201);
});

// Get message edit history
messagesRouter.get("/:conversationId/messages/:messageId/history", async (c) => {
  const orgId = c.get("orgId");
  const message = await messageService.getMessage(orgId, c.req.param("messageId"));
  if (!message) throw AppError.notFound("Message");

  const history = (message.editHistory as any[]) ?? [];
  return c.json({
    messageId: message.id,
    currentContent: message.content,
    isEdited: message.isEdited,
    history,
  });
});

// Get message attachments
messagesRouter.get("/:conversationId/messages/:messageId/attachments", async (c) => {
  const orgId = c.get("orgId");
  const attachments = await messageService.getAttachments(orgId, c.req.param("messageId"));
  return c.json(attachments);
});

export { messagesRouter as messageRoutes };
