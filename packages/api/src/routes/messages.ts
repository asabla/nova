import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { AppContext } from "../types/context";
import * as messageService from "../services/message.service";
import * as conversationService from "../services/conversation.service";
import { streamChatCompletion, chatCompletion } from "../lib/litellm";
import { AppError } from "@nova/shared/utils";
import { DEFAULTS } from "@nova/shared/constants";
import { notificationService } from "../services/notification.service";
import { getTemporalClient } from "../lib/temporal";
import { db } from "../lib/db";
import { userProfiles, users, agents, orgSettings, files } from "@nova/shared/schemas";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { extractFileContent } from "../lib/file-extract";
import { retrieveWorkspaceContext, formatRAGContext } from "../services/knowledge.service";

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
    content: z.string().default(""),
  })),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  enableTools: z.boolean().optional().default(true),
});

// Default tool definitions included in chat completions when tools are enabled
const DEFAULT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for current information. Use when the user asks about recent events, facts you're unsure about, or anything requiring up-to-date information.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fetch_url",
      description: "Fetch the content of a web page. Use when the user provides a URL or when you need to read a specific page.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "The URL to fetch" } },
        required: ["url"],
      },
    },
  },
];

messagesRouter.post("/:conversationId/messages/stream", zValidator("json", streamSchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const conversationId = c.req.param("conversationId");
  const body = c.req.valid("json");

  const conversation = await conversationService.getConversation(orgId, conversationId);
  if (!conversation) throw AppError.notFound("Conversation");

  // Resolve "default" to the org's configured default model
  let resolvedModel = body.model;
  if (!resolvedModel || resolvedModel === "default") {
    const [setting] = await db.select().from(orgSettings).where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, "defaultModel")));
    resolvedModel = setting?.value ?? body.model;
  }

  // Start RAG retrieval in parallel with file enrichment (zero net latency)
  const lastUserContent = [...body.messages].reverse().find((m) => m.role === "user")?.content;
  const ragPromise = conversation.workspaceId && lastUserContent
    ? retrieveWorkspaceContext(orgId, conversation.workspaceId, lastUserContent)
    : Promise.resolve([]);

  // Enrich messages with file content so the LLM can read uploaded files
  const dbMessages = await messageService.listMessages(orgId, conversationId, { page: 1, pageSize: 1000 });
  const dbMsgList: any[] = (dbMessages as any).data ?? dbMessages;
  const attachmentsByContent = new Map<string, any[]>();
  const fileIdsNeeded: string[] = [];
  for (const m of dbMsgList) {
    if (m.attachments?.length && m.content) {
      attachmentsByContent.set(m.content, m.attachments);
      for (const a of m.attachments) {
        if (a.fileId) fileIdsNeeded.push(a.fileId);
      }
    }
  }

  // Fetch storagePath for all attached files
  let fileRecords: Record<string, { storagePath: string; contentType: string }> = {};
  if (fileIdsNeeded.length > 0) {
    const rows = await db.select({ id: files.id, storagePath: files.storagePath, contentType: files.contentType }).from(files).where(inArray(files.id, fileIdsNeeded));
    for (const r of rows) {
      fileRecords[r.id] = { storagePath: r.storagePath, contentType: r.contentType };
    }
  }

  // Extract file contents and build enriched messages
  const enrichedMessages: any[] = [];
  for (const msg of body.messages) {
    if (msg.role !== "user" || !msg.content) {
      enrichedMessages.push(msg);
      continue;
    }
    const atts = attachmentsByContent.get(msg.content);
    if (!atts || atts.length === 0) {
      enrichedMessages.push(msg);
      continue;
    }

    const fileSections: string[] = [];
    for (const a of atts) {
      const file = a.fileId ? fileRecords[a.fileId] : null;
      if (file) {
        const text = await extractFileContent(file.storagePath, file.contentType);
        if (text) {
          fileSections.push(`--- File: ${a.filename ?? "attachment"} ---\n${text}\n--- End of file ---`);
        } else {
          fileSections.push(`[Attached file: ${a.filename ?? "unknown"} (${file.contentType}) — content could not be extracted]`);
        }
      }
    }

    if (fileSections.length > 0) {
      enrichedMessages.push({ ...msg, content: `${msg.content}\n\n${fileSections.join("\n\n")}` });
    } else {
      enrichedMessages.push(msg);
    }
  }

  // Prepend a default formatting system instruction unless the conversation
  // already starts with a user-provided system prompt.
  const hasSystemPrompt = enrichedMessages.length > 0 && enrichedMessages[0].role === "system";
  const formattingInstruction = {
    role: "system",
    content: [
      "Format all responses using standard Markdown.",
      "Use headings (##, ###), bullet/numbered lists, bold, italic, code blocks, and blockquotes where appropriate.",
      "When citing sources or references, use inline Markdown links: [title](url).",
      "For multiple references, collect them in a **References** section at the end using a numbered list with links.",
      "Keep the formatting clean and readable — do not use HTML tags.",
      "",
      "You can embed interactive widgets in your responses using fenced code blocks with the language `widget`.",
      "The content must be valid JSON matching one of these types:",
      '- Weather (fetches LIVE data from wttr.in — you do NOT need internet access, the widget does it): ```widget\n{"type":"weather","title":"Weather in Stockholm","params":{"location":"Stockholm"}}\n```',
      '- Countdown (live ticking timer): ```widget\n{"type":"countdown","title":"Countdown","params":{"date":"2027-01-01T00:00:00Z","label":"New Year"}}\n```',
      '- Poll (interactive voting): ```widget\n{"type":"poll","title":"Quick Poll","params":{"question":"Your question?","options":"Option1,Option2,Option3"}}\n```',
      '- Iframe (embed any website): ```widget\n{"type":"iframe","title":"Embedded Page","src":"https://example.com","height":400}\n```',
      '- Chart (bar/line/pie data visualization): ```widget\n{"type":"chart","title":"Q1 Sales","params":{"chartType":"bar","data":"10,25,40,30","labels":"Q1,Q2,Q3,Q4"}}\n```',
      '- Progress (step tracker): ```widget\n{"type":"progress","title":"Setup Progress","params":{"steps":"Account,Profile,Settings,Done","current":"2","status":"in-progress"}}\n```',
      '- Timer (stopwatch counting up): ```widget\n{"type":"timer","title":"Focus Timer","params":{"autoStart":"true","label":"Focus Session"}}\n```',
      '- Map (OpenStreetMap embed): ```widget\n{"type":"map","title":"Location","params":{"lat":"48.8566","lon":"2.3522","zoom":"13","query":"Paris, France"}}\n```',
      '- Math (LaTeX equation): ```widget\n{"type":"math","title":"Equation","params":{"expression":"E = mc^2","displayMode":"true"}}\n```',
      "",
      "IMPORTANT widget rules — you MUST follow these:",
      "- Widgets are rendered CLIENT-SIDE by the app. You do NOT need internet access, tools, or any special capability to use them. Just output the JSON block.",
      "- WEATHER: Always use the weather widget when asked about weather. It fetches live data from wttr.in automatically. Example: user says 'weather in Paris' → output a weather widget.",
      "- IFRAME: Always use the iframe widget when the user asks to embed, show, display, or open a website/page/URL. You CAN embed sites. Example: user says 'embed feber.se' → output ```widget\n{\"type\":\"iframe\",\"title\":\"feber.se\",\"src\":\"https://feber.se\",\"height\":500}\n```. NEVER say you cannot embed websites — you can, using the iframe widget.",
      "- COUNTDOWN: Use for date/time questions like 'how long until X' or 'days until Y'.",
      "- POLL: Use when the user wants to vote, pick, or decide between options.",
      "- CHART: Use when the user provides numerical data to visualize. chartType can be 'bar', 'line', or 'pie'. Data and labels are comma-separated.",
      "- PROGRESS: Use to show multi-step processes. current is 0-based index. status: 'in-progress', 'completed', or 'failed'.",
      "- TIMER: Use when the user wants a stopwatch or to time something. Set autoStart to 'true' to start immediately.",
      "- MAP: Use when the user asks about a location or place. Provide lat/lon coordinates and a query label.",
      "- MATH: Use when showing mathematical equations. expression uses LaTeX syntax. displayMode 'true' for block, 'false' for inline.",
      "- Do not overuse widgets — only include them when they enhance the response.",
      "- When you can answer a question directly or use a widget, do NOT call tools. Only use tools (web_search, fetch_url) when you genuinely need external information that no widget can provide.",
    ].join("\n"),
  };

  if (hasSystemPrompt) {
    // Append formatting guidance to the existing system prompt
    enrichedMessages[0] = {
      ...enrichedMessages[0],
      content: `${enrichedMessages[0].content}\n\n${formattingInstruction.content}`,
    };
  } else {
    enrichedMessages.unshift(formattingInstruction);
  }

  // Await RAG results and inject into system message
  const ragChunks = await ragPromise;
  const ragContext = formatRAGContext(ragChunks);
  if (ragContext) {
    enrichedMessages[0] = {
      ...enrichedMessages[0],
      content: `${enrichedMessages[0].content}\n\n${ragContext}`,
    };
  }

  return streamSSE(c, async (stream) => {
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: "heartbeat", data: "" });
    }, DEFAULTS.SSE_HEARTBEAT_INTERVAL_MS);

    try {
      // Emit RAG context event for frontend
      const ragSources = ragChunks.length > 0
        ? ragChunks.map((c) => ({ document: c.documentName, score: c.score }))
        : undefined;
      if (ragSources) {
        await stream.writeSSE({
          event: "rag_context",
          data: JSON.stringify({ sources: ragSources }),
        });
      }

      const startTime = Date.now();
      const completionParams: Record<string, unknown> = {
        model: resolvedModel,
        messages: enrichedMessages,
        temperature: body.temperature,
        top_p: body.topP,
        max_tokens: body.maxTokens,
      };

      if (body.enableTools) {
        completionParams.tools = DEFAULT_TOOLS;
      }

      const llmStream = await streamChatCompletion(completionParams as any);

      let fullContent = "";
      let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
      let toolCalls: { id: string; function: { name: string; arguments: string } }[] = [];
      let finishReason = "stop";

      for await (const chunk of llmStream) {
        const delta = chunk.choices?.[0]?.delta;
        const choiceFinish = chunk.choices?.[0]?.finish_reason;

        const token = delta?.content;
        if (token) {
          fullContent += token;
          await stream.writeSSE({
            event: "token",
            data: JSON.stringify({ content: token }),
          });
        }

        // Accumulate tool calls from streaming deltas
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id ?? "", function: { name: "", arguments: "" } };
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }

        if (choiceFinish) {
          finishReason = choiceFinish;
        }

        if (chunk.usage) {
          usageData = chunk.usage;
        }
      }

      // Filter out any sparse entries from tool_calls accumulation
      toolCalls = toolCalls.filter(Boolean);

      const latencyMs = Date.now() - startTime;
      const promptTokens = usageData?.prompt_tokens ?? Math.ceil(JSON.stringify(body.messages).length / 4);
      const completionTokens = usageData?.completion_tokens ?? Math.ceil(fullContent.length / 4);

      // --- Smart routing: if tool calls detected, hand off to Temporal ---
      console.log(`[stream] finishReason=${finishReason} toolCalls=${toolCalls.length} contentLen=${fullContent.length}`);
      if (finishReason === "tool_calls" && toolCalls.length > 0) {
        console.log(`[stream] tool calls:`, toolCalls.map(tc => `${tc.function.name}(${tc.function.arguments.slice(0, 50)})`));
        // Send tool status events to the client
        for (const tc of toolCalls) {
          await stream.writeSSE({
            event: "tool_status",
            data: JSON.stringify({ tool: tc.function.name, status: "running" }),
          });
        }

        const streamChannelId = `stream:${conversationId}:${crypto.randomUUID()}`;

        try {
          // Subscribe to Redis BEFORE starting workflow to avoid race condition
          const { relayRedisToSSE } = await import("../lib/stream-relay");
          const relayPromise = relayRedisToSSE(stream, streamChannelId, { timeoutMs: 120_000 });

          const client = await getTemporalClient();
          const workflowId = `smart-chat-${conversationId}-${Date.now()}`;

          await client.workflow.start("smartChatWorkflow", {
            taskQueue: "nova-main",
            workflowId,
            args: [{
              orgId,
              conversationId,
              streamChannelId,
              messageHistory: enrichedMessages,
              pendingToolCalls: toolCalls,
              model: resolvedModel,
              modelParams: { temperature: body.temperature, maxTokens: body.maxTokens },
              tools: body.enableTools ? DEFAULT_TOOLS : undefined,
              maxSteps: 5,
            }],
          });

          const relayResult = await relayPromise;

          // Combine initial content + relay content for the final message
          const totalContent = fullContent + (relayResult?.content ?? "");
          const totalPromptTokens = promptTokens + (relayResult?.usage?.prompt_tokens ?? 0);
          const totalCompletionTokens = completionTokens + (relayResult?.usage?.completion_tokens ?? 0);

          const assistantMessage = await messageService.createMessage(orgId, {
            conversationId,
            senderType: "assistant",
            content: totalContent,
            modelId: conversation.modelId ?? undefined,
            tokenCountPrompt: totalPromptTokens,
            tokenCountCompletion: totalCompletionTokens,
            metadata: { latencyMs: Date.now() - startTime, model: body.model, smartRouted: true, ragSources },
          });

          await stream.writeSSE({
            event: "done",
            data: JSON.stringify({
              messageId: assistantMessage.id,
              tokenCountPrompt: totalPromptTokens,
              tokenCountCompletion: totalCompletionTokens,
              latencyMs: Date.now() - startTime,
            }),
          });
          console.log(`[stream] relay done, relayContent=${(relayResult?.content ?? "").length} chars`);
        } catch (temporalErr) {
          // Temporal unavailable — save partial response and return error
          console.error("[smart-chat] Temporal workflow failed:", temporalErr);

          if (fullContent) {
            const partialMessage = await messageService.createMessage(orgId, {
              conversationId,
              senderType: "assistant",
              content: fullContent,
              modelId: conversation.modelId ?? undefined,
              tokenCountPrompt: promptTokens,
              tokenCountCompletion: completionTokens,
              metadata: { latencyMs, model: body.model, partial: true, ragSources },
            });

            await stream.writeSSE({
              event: "done",
              data: JSON.stringify({
                messageId: partialMessage.id,
                tokenCountPrompt: promptTokens,
                tokenCountCompletion: completionTokens,
                latencyMs,
                partial: true,
              }),
            });
          }

          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({
              message: "Tool execution unavailable — showing partial response",
              code: "temporal_unavailable",
            }),
          });
        }

        return;
      }

      // --- Normal path: no tool calls, save message as before ---
      const assistantMessage = await messageService.createMessage(orgId, {
        conversationId,
        senderType: "assistant",
        content: fullContent,
        modelId: conversation.modelId ?? undefined,
        tokenCountPrompt: promptTokens,
        tokenCountCompletion: completionTokens,
        metadata: { latencyMs, model: body.model, ragSources },
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
      console.error("[stream] outer error:", err);
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

// Replay a message with a different model (Story #41)
const replaySchema = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().positive().optional(),
});

messagesRouter.post("/:conversationId/messages/:messageId/replay", zValidator("json", replaySchema), async (c) => {
  const orgId = c.get("orgId");
  const userId = c.get("userId");
  const conversationId = c.req.param("conversationId");
  const messageId = c.req.param("messageId");
  const { model, temperature, topP, maxTokens } = c.req.valid("json");

  const replayConversation = await conversationService.getConversation(orgId, conversationId);
  if (!replayConversation) throw AppError.notFound("Conversation");

  // Get the original message and all prior messages in the conversation
  const allMessages = await messageService.listMessages(orgId, conversationId, { page: 1, pageSize: 1000 });
  const msgList = (allMessages as any).data ?? allMessages;

  // Find the target message index
  const targetIndex = msgList.findIndex((m: any) => m.id === messageId);
  if (targetIndex === -1) throw AppError.notFound("Message");

  // Build message history up to (and including) the user message before the target
  const history: { role: string; content: string }[] = [];
  for (let i = 0; i <= targetIndex; i++) {
    const msg = msgList[i];
    if (msg.senderType === "user") {
      history.push({ role: "user", content: msg.content });
    } else if (msg.senderType === "assistant") {
      history.push({ role: "assistant", content: msg.content });
    } else if (msg.senderType === "system") {
      history.push({ role: "system", content: msg.content });
    }
  }

  // If the target is an assistant message, remove it and keep messages up to the user message before it
  if (msgList[targetIndex].senderType === "assistant") {
    history.pop();
  }

  // Prepend formatting instruction (same as streaming endpoint)
  const hasReplaySystemPrompt = history.length > 0 && history[0].role === "system";
  const replayFormatting = "Format all responses using standard Markdown. Use headings (##, ###), bullet/numbered lists, bold, italic, code blocks, and blockquotes where appropriate. When citing sources or references, use inline Markdown links: [title](url). For multiple references, collect them in a **References** section at the end using a numbered list with links. Keep the formatting clean and readable — do not use HTML tags.";
  if (hasReplaySystemPrompt) {
    history[0] = { ...history[0], content: `${history[0].content}\n\n${replayFormatting}` };
  } else {
    history.unshift({ role: "system", content: replayFormatting });
  }

  // Retrieve and inject RAG context for workspace conversations
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user")?.content;
  let replayRagSources: { document: string; score: number }[] | undefined;
  if (replayConversation.workspaceId && lastUserMsg) {
    const replayRagChunks = await retrieveWorkspaceContext(orgId, replayConversation.workspaceId, lastUserMsg);
    const replayRagContext = formatRAGContext(replayRagChunks);
    if (replayRagContext) {
      history[0] = { ...history[0], content: `${history[0].content}\n\n${replayRagContext}` };
      replayRagSources = replayRagChunks.map((c) => ({ document: c.documentName, score: c.score }));
    }
  }

  // Call the new model
  const result = await chatCompletion({
    model,
    messages: history,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
  });

  const data = result as any;
  const content = data.choices?.[0]?.message?.content ?? "";

  // Save as a new assistant message
  const replayMessage = await messageService.createMessage(orgId, {
    conversationId,
    senderType: "assistant",
    content,
    modelId: model,
    tokenCountPrompt: data.usage?.prompt_tokens,
    tokenCountCompletion: data.usage?.completion_tokens,
    metadata: { replayOf: messageId, model, ragSources: replayRagSources },
  });

  return c.json(replayMessage, 201);
});

// Stop a running agent execution (Story #52)
messagesRouter.post("/:conversationId/stop", async (c) => {
  const orgId = c.get("orgId");
  const conversationId = c.req.param("conversationId");

  const conversation = await conversationService.getConversation(orgId, conversationId);
  if (!conversation) throw AppError.notFound("Conversation");

  // Get the agent's workflow ID from conversation metadata
  const agentMeta = (conversation.modelParams as any);
  const workflowId = agentMeta?.workflowId;

  if (workflowId) {
    try {
      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(workflowId);
      await handle.signal("cancel");
      return c.json({ ok: true, message: "Agent stop signal sent" });
    } catch (err) {
      // Workflow may have already completed
      return c.json({ ok: true, message: "Agent may have already completed" });
    }
  }

  return c.json({ ok: true, message: "No active agent run found" });
});

export { messagesRouter as messageRoutes };
