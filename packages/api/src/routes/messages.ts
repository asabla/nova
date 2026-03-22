import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { AppContext } from "../types/context";
import * as messageService from "../services/message.service";
import * as conversationService from "../services/conversation.service";
import { streamChatCompletion, chatCompletion } from "../lib/litellm";
import { AppError } from "@nova/shared/utils";
import { DEFAULTS, TASK_QUEUES } from "@nova/shared/constants";
import { notificationService } from "../services/notification.service";
import { getTemporalClient } from "../lib/temporal";
import { db } from "../lib/db";
import { userProfiles, users, agents, orgSettings, files, toolCalls as toolCallsTable, messageAttachments, messages as messagesTable } from "@nova/shared/schemas";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { extractFileContent } from "../lib/file-extract";
import { SKILLS, SANDBOX_PACKAGES_NOTE } from "@nova/shared/skills";
import * as artifactService from "../services/artifact.service";

/** Strip <think>...</think> reasoning blocks from model output */
function stripThinkBlocks(text: string): string {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/g, "").trim();
  // If stripping removed all content, return the original with tags removed but text preserved
  return stripped || text.replace(/<\/?think>/g, "").trim();
}

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
  {
    type: "function" as const,
    function: {
      name: "invoke_agent",
      description: "Delegate a task to a specialized agent. Use when users @mention an agent or when the task matches an agent's expertise.",
      parameters: {
        type: "object",
        properties: {
          agent_id: { type: "string", description: "The agent's ID" },
          task: { type: "string", description: "Clear description of what the agent should do" },
        },
        required: ["agent_id", "task"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "code_execute",
      description:
        "Execute code in a secure sandboxed environment. Returns stdout, stderr, and exit code. Network access is disabled. Supports Python, JavaScript, TypeScript, Bash. To process uploaded files, pass their IDs (from the conversation file list) via input_file_ids — they will be available at /sandbox/input/<filename>. Write output files to /sandbox/output/ to return them. Never ask the user for file IDs.",
      parameters: {
        type: "object",
        properties: {
          language: {
            type: "string",
            description: "Programming language (e.g. python, javascript, typescript, bash)",
          },
          code: { type: "string", description: "Source code to execute" },
          stdin: {
            type: ["string", "null"],
            description: "Standard input to provide to the program",
          },
          timeout: {
            type: ["number", "null"],
            description: "Execution timeout in milliseconds (default 30000, max 300000)",
          },
          input_file_ids: {
            type: ["array", "null"],
            items: { type: "string" },
            description: "IDs of uploaded files to make available in /sandbox/input/",
          },
          skill: {
            type: ["string", "null"],
            description: "Skill for specialized processing: 'xlsx' (spreadsheets), 'pdf' (PDFs), 'docx' (Word), 'pptx' (PowerPoint), 'algorithmic-art' (generative art), 'brand-guidelines' (brand styling), 'canvas-design' (visual art), 'claude-api' (Claude SDK), 'doc-coauthoring' (writing), 'frontend-design' (UI), 'internal-comms' (org comms), 'mcp-builder' (MCP servers), 'theme-factory' (themes), 'web-artifacts-builder' (React artifacts), 'webapp-testing' (Playwright). Scripts at /sandbox/skills/{name}/.",
          },
        },
        required: ["language", "code", "stdin", "timeout", "input_file_ids", "skill"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_workspace",
      description:
        "Search the workspace for information across past conversations, messages, knowledge base documents, and files. " +
        "Supports keyword (full-text) and semantic (embedding-based) search, plus date range filtering. " +
        "Use this when the user wants to find something from earlier conversations, stored knowledge, or uploaded files. " +
        "IMPORTANT: Always use type 'all' unless the user specifically asks to search only one type. " +
        "For temporal queries like 'yesterday' or 'last week', use dateFrom/dateTo to filter by time range. " +
        "You can combine date filters with a broad query (e.g. query='' with dateFrom to list recent activity).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query. Can be empty when using date filters to browse recent content." },
          type: {
            type: ["string", "null"],
            enum: ["all", "conversations", "messages", "knowledge", "files", null],
            description: "Type of content to search (default: all)",
          },
          mode: {
            type: ["string", "null"],
            enum: ["keyword", "semantic", null],
            description: "Search mode: keyword for exact matches, semantic for meaning-based matches (default: semantic). When using date filters without a meaningful query, use 'keyword'.",
          },
          limit: {
            type: ["number", "null"],
            description: "Maximum number of results per type (default: 10, max: 20)",
          },
          dateFrom: {
            type: ["string", "null"],
            description: "ISO 8601 date string (e.g. '2025-03-20T00:00:00Z'). Only return results created on or after this date.",
          },
          dateTo: {
            type: ["string", "null"],
            description: "ISO 8601 date string (e.g. '2025-03-21T00:00:00Z'). Only return results created before this date.",
          },
        },
        required: ["query", "type", "mode", "limit", "dateFrom", "dateTo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description:
        "Read the full content of an uploaded file by its file ID or filename. " +
        "Returns raw text content with full row/column data for spreadsheets (xlsx/csv). " +
        "Use this when you need the complete file content rather than semantic search snippets. " +
        "File IDs are available from the conversation context (look for attached files). " +
        "You can also search by filename if you don't have the ID.",
      parameters: {
        type: "object",
        properties: {
          file_id: {
            type: ["string", "null"],
            description: "The UUID of the file to read",
          },
          filename: {
            type: ["string", "null"],
            description: "Search for a file by name if you don't have the file ID",
          },
        },
        required: ["file_id", "filename"],
      },
    },
  },
];

/** Fetch enabled agents for the org and return them for system prompt injection */
async function getAvailableAgents(orgId: string) {
  return db
    .select({ id: agents.id, name: agents.name, description: agents.description })
    .from(agents)
    .where(and(eq(agents.orgId, orgId), eq(agents.isEnabled, true), isNull(agents.deletedAt)));
}

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

  const lastUserContent = [...body.messages].reverse().find((m) => m.role === "user")?.content;

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
  let fileRecords: Record<string, { storagePath: string; contentType: string; filename: string | null }> = {};
  if (fileIdsNeeded.length > 0) {
    const rows = await db.select({ id: files.id, storagePath: files.storagePath, contentType: files.contentType, filename: files.filename }).from(files).where(inArray(files.id, fileIdsNeeded));
    for (const r of rows) {
      fileRecords[r.id] = { storagePath: r.storagePath, contentType: r.contentType, filename: r.filename };
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
    // Types where the ingestion pipeline extracts content into RAG (Qdrant) —
    // don't dump full text into context; let the agent use search_workspace or read_file.
    const RAG_INDEXED_TYPES = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]);
    for (const a of atts) {
      const file = a.fileId ? fileRecords[a.fileId] : null;
      if (file) {
        if (RAG_INDEXED_TYPES.has(file.contentType)) {
          const sizeStr = `${((file.sizeBytes ?? 0) / 1024).toFixed(0)} KB`;
          fileSections.push(`[Attached file: ${a.filename ?? "unknown"} (${file.contentType}, ${sizeStr}) — content indexed for search. Use search_workspace to find relevant sections, or read_file / code_execute for full content.]`);
        } else {
          const text = await extractFileContent(file.storagePath, file.contentType, file.filename ?? undefined);
          if (text) {
            fileSections.push(`--- File: ${a.filename ?? "attachment"} ---\n${text}\n--- End of file ---`);
          } else {
            fileSections.push(`[Attached file: ${a.filename ?? "unknown"} (${file.contentType}) — content could not be extracted]`);
          }
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
      "## Widgets",
      'Embed interactive widgets using ```widget\\n{"type":"<type>","title":"...","params":{...}}\\n```.',
      "Available types: weather, countdown, poll, iframe, chart (bar/line/pie), progress, timer, map, math, colorpalette, checklist, timeline, dice, unitconverter, calendar, qrcode, diff, jsonexplorer, codedisplay, currency, stock, youtube, kanban, quiz.",
      "Widgets render CLIENT-SIDE — no internet access or tools needed. Just output the JSON block.",
      "Key params by type: weather→location; countdown→date,label; poll→question,options; iframe→src,height; chart→chartType,data,labels; progress→steps,current,status; map→lat,lon,zoom,query; math→expression,displayMode; timeline→events (JSON array); stock→symbol,price,change,sparkline; kanban→columns,cards; quiz→questions (JSON array with question,options[],correctIndex).",
      "Rules:",
      "- WEATHER: Always use for weather questions — it fetches live data automatically.",
      "- IFRAME: Always use to embed/show websites. You CAN embed sites. Never say you cannot.",
      "- CURRENCY: Fetches live rates automatically. STOCK: You must provide price data via web_search first.",
      "- Do not overuse widgets — only when they enhance the response.",
      "- Prefer widgets over tool calls when the widget can answer directly.",
      "",
      "## Response Style",
      "Be concise. Answer directly without unnecessary preamble, filler, or restating the question.",
      "Match response length to question complexity — short questions get short answers.",
      "Use structured formatting (lists, headings) to be scannable rather than writing long paragraphs.",
      "Never narrate your thought process, internal reasoning, or what you are 'considering'. Just give the answer.",
      "If a file operation (read_file, code_execute) fails, tell the user the file could not be accessed and suggest re-uploading. Do NOT fall back to web search as a workaround.",
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

  // Fetch available agents and inject into system prompt so the LLM knows about them
  if (body.enableTools) {
    const availableAgents = await getAvailableAgents(orgId);
    if (availableAgents.length > 0) {
      const agentList = availableAgents
        .map((a) => {
          const slug = a.name.toLowerCase().replace(/\s+/g, "-");
          return `- @${slug} (id: ${a.id}): ${a.description ?? a.name}`;
        })
        .join("\n");
      const agentSection = [
        "## Available Agents",
        "You can delegate tasks to specialized agents using the invoke_agent tool.",
        agentList,
        "When a user mentions an agent with @name, use the invoke_agent tool to delegate to them.",
      ].join("\n");
      enrichedMessages[0] = {
        ...enrichedMessages[0],
        content: `${enrichedMessages[0].content}\n\n${agentSection}`,
      };
    }

    // Build a manifest of all files in this conversation so the agent always
    // knows what files are available and can pass their IDs to code_execute.
    const TABULAR_MIMES = new Set([
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ]);

    const conversationFiles = await db
      .selectDistinct({
        fileId: messageAttachments.fileId,
        filename: files.filename,
        contentType: files.contentType,
        sizeBytes: files.sizeBytes,
        metadata: files.metadata,
      })
      .from(messageAttachments)
      .innerJoin(messagesTable, eq(messageAttachments.messageId, messagesTable.id))
      .innerJoin(files, eq(messageAttachments.fileId, files.id))
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          eq(messageAttachments.orgId, orgId),
          isNull(files.deletedAt),
        ),
      );

    if (conversationFiles.length > 0) {
      const hasTabularFiles = conversationFiles.some((f) => TABULAR_MIMES.has(f.contentType ?? ""));
      const fileList = conversationFiles
        .map((f) => {
          const sizeStr = `${((f.sizeBytes ?? 0) / 1024).toFixed(1)} KB`;
          const isTabular = TABULAR_MIMES.has(f.contentType ?? "");
          const meta = f.metadata as any;
          const rowInfo = meta?.tabular?.totalRows ? `, ~${meta.tabular.totalRows} rows` : "";
          const tabularHint = isTabular ? " [TABULAR — use code_execute for analysis]" : "";
          return `- "${f.filename}" (id: ${f.fileId}, type: ${f.contentType}, ${sizeStr}${rowInfo})${tabularHint}`;
        })
        .join("\n");

      const filesSectionParts = [
        "## Files in this conversation",
        "The following files have been uploaded by the user. When using the code_execute tool, pass file IDs via `input_file_ids` to make them available at `/sandbox/input/<filename>`.",
        "Do NOT ask the user for file IDs — use the IDs listed below.",
        fileList,
      ];

      if (hasTabularFiles) {
        filesSectionParts.push(
          "",
          "### Working with tabular data",
          "CSV/XLSX file content shown in messages is only a PREVIEW (schema + first ~10 rows).",
          "The actual data is NOT in the conversation — it is stored in MinIO and must be accessed via tools.",
          "For complete data analysis:",
          "1. **PREFERRED**: Use `code_execute` with `input_file_ids` to load the file with pandas in the sandbox",
          "2. **Alternative**: Use `read_file` to retrieve full text content",
          "NEVER answer data analysis questions (counts, aggregations, filtering, statistics) based solely on the preview content in messages.",
        );
      }

      const filesSection = filesSectionParts.join("\n");
      enrichedMessages[0] = {
        ...enrichedMessages[0],
        content: `${enrichedMessages[0].content}\n\n${filesSection}`,
      };

      // Inject skill instructions for file types present in the conversation
      const fileTypeSkills = Object.values(SKILLS).filter((skill) =>
        skill.fileTypes.length > 0 &&
        conversationFiles.some((f) => skill.fileTypes.includes(f.contentType ?? "")),
      );

      // Keyword-triggered skills (deduplicated with file-type triggers)
      const injectedNames = new Set(fileTypeSkills.map((s) => s.name));
      const userContent = (lastUserContent ?? "").toLowerCase();
      const keywordSkills = Object.values(SKILLS).filter((skill) =>
        !injectedNames.has(skill.name) &&
        skill.triggerKeywords?.some((kw) => userContent.includes(kw.toLowerCase())),
      );

      // Cap total injected skills at 4 to limit prompt bloat
      const allSkills = [...fileTypeSkills, ...keywordSkills].slice(0, 4);

      if (allSkills.length > 0) {
        const skillInstructions = allSkills.map((s) => s.instructions).join("\n\n");
        enrichedMessages[0] = {
          ...enrichedMessages[0],
          content: `${enrichedMessages[0].content}\n\n${skillInstructions}`,
        };
      }

      // Always include the pre-installed packages note when files are present
      enrichedMessages[0] = {
        ...enrichedMessages[0],
        content: `${enrichedMessages[0].content}\n\n${SANDBOX_PACKAGES_NOTE}`,
      };
    } else {
      // Even without files, check for keyword-triggered skills
      const userContent = (lastUserContent ?? "").toLowerCase();
      const keywordSkills = Object.values(SKILLS).filter((skill) =>
        skill.triggerKeywords?.some((kw) => userContent.includes(kw.toLowerCase())),
      ).slice(0, 4);

      if (keywordSkills.length > 0) {
        const skillInstructions = keywordSkills.map((s) => s.instructions).join("\n\n");
        enrichedMessages[0] = {
          ...enrichedMessages[0],
          content: `${enrichedMessages[0].content}\n\n${skillInstructions}\n\n${SANDBOX_PACKAGES_NOTE}`,
        };
      }
    }
  }

  return streamSSE(c, async (stream) => {
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: "heartbeat", data: "" });
    }, DEFAULTS.SSE_HEARTBEAT_INTERVAL_MS);

    try {
      const startTime = Date.now();

      // ── Tier assessment: decide execution strategy before LLM call ──
      // For complex requests, skip the initial LLM call and hand off
      // directly to the Temporal workflow for planned execution.
      let assessedTier: "direct" | "sequential" | "orchestrated" = "direct";
      if (body.enableTools) {
        try {
          const userMsg = enrichedMessages.filter((m: any) => m.role === "user").pop()?.content ?? "";
          const priorTurns = enrichedMessages.filter((m: any) => m.role === "user" || m.role === "assistant");
          const contextSummary = priorTurns.length > 1
            ? priorTurns.slice(-6).map((m: any) => `${m.role}: ${(m.content ?? "").slice(0, 200)}`).join("\n")
            : undefined;

          const tierResult = await chatCompletion({
            model: resolvedModel,
            messages: [
              {
                role: "system",
                content: `You are a task complexity router. Classify the user's request into one of three execution tiers.

Tiers:
- "direct": Simple Q&A, greetings, factual answers, single-step tasks, follow-ups to prior answers, reformatting data already in context. Most messages are direct.
- "sequential": Needs 2-4 ordered steps. Single web search + synthesis, document lookup + analysis, one tool call with follow-up reasoning.
- "orchestrated": Needs 4+ steps, multiple tools, parallel work, or multi-source research. Cross-referencing multiple sources, complex analysis requiring code execution + web research, tasks with independent sub-problems.

${contextSummary ? "IMPORTANT: Consider conversation context. Follow-ups building on existing content are almost always direct." : ""}

Respond with ONLY valid JSON: {"tier": "direct"|"sequential"|"orchestrated", "reasoning": "one sentence"}`,
              },
              ...(contextSummary ? [{ role: "system" as const, content: `Conversation context:\n${contextSummary}` }] : []),
              { role: "user" as const, content: userMsg },
            ],
            temperature: 0,
            max_tokens: 150,
          } as any);

          const tierContent = tierResult.choices?.[0]?.message?.content ?? "";
          try {
            const parsed = JSON.parse(tierContent);
            if (parsed.tier === "sequential" || parsed.tier === "orchestrated") {
              assessedTier = parsed.tier;
            }
          } catch { /* default to direct */ }
          console.log(`[stream] tier assessment: ${assessedTier} (raw: ${tierContent.slice(0, 100)})`);
        } catch (err) {
          console.warn("[stream] tier assessment failed, defaulting to direct:", err);
        }
      }

      // For sequential/orchestrated tiers, skip the initial LLM call and go straight to Temporal
      if (assessedTier !== "direct" && body.enableTools) {
        await stream.writeSSE({
          event: "tier.assessed",
          data: JSON.stringify({ tier: assessedTier }),
        });

        const streamChannelId = `stream:${conversationId}:${crypto.randomUUID()}`;
        const { relayRedisToSSE } = await import("../lib/stream-relay");
        const relayPromise = relayRedisToSSE(stream, streamChannelId, { timeoutMs: 600_000 });

        const client = await getTemporalClient();
        const workflowId = `agent-chat-${conversationId}-${Date.now()}`;

        await client.workflow.start("agentWorkflow", {
          taskQueue: TASK_QUEUES.AGENT,
          workflowId,
          args: [{
            orgId,
            userId: c.get("userId"),
            conversationId,
            streamChannelId,
            userMessage: enrichedMessages.filter((m: any) => m.role === "user").pop()?.content,
            messageHistory: enrichedMessages,
            model: resolvedModel,
            modelParams: { temperature: body.temperature, maxTokens: body.maxTokens },
            tools: DEFAULT_TOOLS,
            maxSteps: 25,
            enableSearchAttributes: true,
            preAssessedTier: assessedTier,
          }],
        });

        const relayResult = await relayPromise;
        const totalContent = stripThinkBlocks(relayResult?.content ?? "");

        let toolCallRecords: any[] = [];
        let wfTier: string | undefined;
        let wfPlanSummary: Record<string, unknown> | undefined;
        try {
          const handle = client.workflow.getHandle(workflowId);
          const wfResult = await handle.result();
          toolCallRecords = (wfResult as any)?.toolCallRecords ?? [];
          wfTier = (wfResult as any)?.tier;
          const wfPlan = (wfResult as any)?.plan;
          if (wfPlan) {
            wfPlanSummary = {
              id: wfPlan.id, tier: wfPlan.tier, reasoning: wfPlan.reasoning,
              nodes: (wfPlan.nodes ?? []).map((n: any) => ({
                id: n.id, description: n.description, tools: n.tools, dependencies: n.dependencies,
                status: n.status, result: n.result ? { durationMs: n.result.durationMs, tokensUsed: n.result.tokensUsed } : undefined,
              })),
            };
          }
        } catch { /* workflow may still be running */ }

        const toolSummary = toolCallRecords.length > 0
          ? toolCallRecords.map((r: any) => ({ name: r.toolName, durationMs: r.durationMs, error: r.error, args: r.input }))
          : undefined;

        const assistantMessage = await messageService.createMessage(orgId, {
          conversationId,
          senderType: "assistant",
          content: totalContent,
          modelId: conversation.modelId ?? undefined,
          tokenCountPrompt: relayResult?.usage?.prompt_tokens ?? 0,
          tokenCountCompletion: relayResult?.usage?.completion_tokens ?? 0,
          metadata: { latencyMs: Date.now() - startTime, model: body.model, smartRouted: true, toolSummary, tier: wfTier ?? assessedTier, plan: wfPlanSummary },
        });

        if (toolCallRecords.length > 0) {
          try {
            await db.insert(toolCallsTable).values(
              toolCallRecords.map((r: any) => ({
                messageId: assistantMessage.id, conversationId, orgId,
                toolName: r.toolName, input: r.input, output: r.output ?? null,
                status: r.error ? "error" : "completed", errorMessage: r.error ?? null, durationMs: r.durationMs,
              })),
            );
          } catch (dbErr) { console.error("[planned-chat] Failed to persist tool calls:", dbErr); }
        }

        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({
            messageId: assistantMessage.id,
            tokenCountPrompt: relayResult?.usage?.prompt_tokens ?? 0,
            tokenCountCompletion: relayResult?.usage?.completion_tokens ?? 0,
            latencyMs: Date.now() - startTime,
          }),
        });

        return;
      }

      // ── Direct tier: standard LLM call with optional tool handoff ──
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

      // When tools are enabled, the model may output reasoning text ("I need to search...")
      // before deciding to call tools. We buffer this initial content and only stream it
      // if the response finishes without tool calls. If tool calls are detected, we discard
      // the pre-tool reasoning and send a content_clear event to the frontend.
      let hasToolCallDelta = false;

      for await (const chunk of llmStream) {
        const delta = chunk.choices?.[0]?.delta;
        const choiceFinish = chunk.choices?.[0]?.finish_reason;

        const token = delta?.content;
        if (token) {
          fullContent += token;
          // Only stream tokens if we haven't seen tool call deltas yet
          if (!hasToolCallDelta) {
            await stream.writeSSE({
              event: "token",
              data: JSON.stringify({ content: token }),
            });
          }
        }

        // Accumulate tool calls from streaming deltas
        if (delta?.tool_calls) {
          if (!hasToolCallDelta) {
            hasToolCallDelta = true;
            // Tell the frontend to discard any pre-tool reasoning content it received
            if (fullContent.trim()) {
              await stream.writeSSE({
                event: "content_clear",
                data: JSON.stringify({ reason: "tool_calls_detected" }),
              });
            }
          }
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
        // Send tool status events to the client (with parsed args)
        for (const tc of toolCalls) {
          let parsedArgs: Record<string, unknown> = {};
          try { parsedArgs = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
          await stream.writeSSE({
            event: "tool_status",
            data: JSON.stringify({ tool: tc.function.name, status: "running", args: parsedArgs }),
          });
        }

        const streamChannelId = `stream:${conversationId}:${crypto.randomUUID()}`;

        try {
          // Subscribe to Redis BEFORE starting workflow to avoid race condition
          const { relayRedisToSSE } = await import("../lib/stream-relay");
          const relayPromise = relayRedisToSSE(stream, streamChannelId, { timeoutMs: 600_000 });

          const client = await getTemporalClient();
          const workflowId = `agent-chat-${conversationId}-${Date.now()}`;

          await client.workflow.start("agentWorkflow", {
            taskQueue: TASK_QUEUES.AGENT,
            workflowId,
            args: [{
              orgId,
              userId: c.get("userId"),
              conversationId,
              streamChannelId,
              messageHistory: enrichedMessages,
              pendingToolCalls: toolCalls,
              model: resolvedModel,
              modelParams: { temperature: body.temperature, maxTokens: body.maxTokens },
              tools: body.enableTools ? DEFAULT_TOOLS : undefined,
              maxSteps: 12,
              enableSearchAttributes: true,
            }],
          });

          const relayResult = await relayPromise;

          // When tool calls were triggered, the initial fullContent is the model's
          // reasoning preamble ("I need to search for...", "Let me look up...") — not the real answer.
          // The actual response comes from the workflow relay. Never fall back to pre-tool reasoning.
          const relayContent = stripThinkBlocks(relayResult?.content ?? "");
          const totalContent = relayContent;
          const totalPromptTokens = promptTokens + (relayResult?.usage?.prompt_tokens ?? 0);
          const totalCompletionTokens = completionTokens + (relayResult?.usage?.completion_tokens ?? 0);

          // Try to get tool call records from Temporal workflow result
          let toolCallRecords: { toolName: string; input: Record<string, unknown>; output: unknown; error?: string; durationMs: number }[] = [];
          let wfTier: string | undefined;
          let wfPlanSummary: Record<string, unknown> | undefined;
          try {
            const handle = client.workflow.getHandle(workflowId);
            const wfResult = await handle.result();
            toolCallRecords = (wfResult as any)?.toolCallRecords ?? [];
            wfTier = (wfResult as any)?.tier;
            const wfPlan = (wfResult as any)?.plan;
            if (wfPlan) {
              wfPlanSummary = {
                id: wfPlan.id,
                tier: wfPlan.tier,
                reasoning: wfPlan.reasoning,
                approvalRequired: wfPlan.approvalRequired,
                approved: wfPlan.approved,
                nodes: (wfPlan.nodes ?? []).map((n: any) => ({
                  id: n.id,
                  description: n.description,
                  tools: n.tools,
                  dependencies: n.dependencies,
                  status: n.status,
                  result: n.result ? { durationMs: n.result.durationMs, tokensUsed: n.result.tokensUsed, toolCallCount: n.result.toolCallRecords?.length ?? 0 } : undefined,
                })),
              };
            }
          } catch {
            // Workflow may still be running or failed — skip tool call persistence
          }

          // Build tool call summary for metadata
          const toolSummary = toolCallRecords.length > 0
            ? toolCallRecords.map((r) => ({ name: r.toolName, durationMs: r.durationMs, error: r.error, args: r.input }))
            : undefined;

          const assistantMessage = await messageService.createMessage(orgId, {
            conversationId,
            senderType: "assistant",
            content: totalContent,
            modelId: conversation.modelId ?? undefined,
            tokenCountPrompt: totalPromptTokens,
            tokenCountCompletion: totalCompletionTokens,
            metadata: { latencyMs: Date.now() - startTime, model: body.model, smartRouted: true, toolSummary, tier: wfTier, plan: wfPlanSummary },
          });

          // Persist tool calls to DB
          if (toolCallRecords.length > 0) {
            try {
              await db.insert(toolCallsTable).values(
                toolCallRecords.map((r) => ({
                  messageId: assistantMessage.id,
                  conversationId,
                  orgId,
                  toolName: r.toolName,
                  input: r.input,
                  output: r.output ?? null,
                  status: r.error ? "error" : "completed",
                  errorMessage: r.error ?? null,
                  durationMs: r.durationMs,
                })),
              );
            } catch (dbErr) {
              console.error("[smart-chat] Failed to persist tool calls:", dbErr);
            }

            // Extract output files from code_execute results and attach to message
            try {
              const { env } = await import("../lib/env");
              for (const r of toolCallRecords) {
                if (r.toolName !== "code_execute") continue;
                const output = r.output as { outputFiles?: { name: string; sizeBytes: number; storageKey: string }[] } | null;
                if (!output?.outputFiles?.length) continue;

                for (const of of output.outputFiles) {
                  // Infer content type from extension
                  const ext = of.name.split(".").pop()?.toLowerCase() ?? "";

                  // Handle .excalidraw files as artifacts instead of attachments
                  if (ext === "excalidraw") {
                    try {
                      const { getObjectBuffer } = await import("../lib/minio");
                      const buf = await getObjectBuffer(of.storageKey);
                      const content = buf.toString("utf-8");
                      const title = of.name.replace(/\.excalidraw$/, "") || "Diagram";
                      await artifactService.createArtifact(orgId, {
                        messageId: assistantMessage.id,
                        conversationId,
                        type: "excalidraw",
                        title,
                        content,
                        metadata: { sourceType: "sandbox" },
                      });
                    } catch (artifactErr) {
                      console.error("[smart-chat] Failed to create excalidraw artifact:", artifactErr);
                    }
                    continue;
                  }

                  const mimeMap: Record<string, string> = {
                    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
                    pdf: "application/pdf", csv: "text/csv", json: "application/json", txt: "text/plain",
                    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    html: "text/html", xml: "application/xml", zip: "application/zip",
                  };
                  const contentType = mimeMap[ext] ?? "application/octet-stream";

                  // Create file record
                  const [fileRecord] = await db.insert(files).values({
                    orgId,
                    userId,
                    filename: of.name,
                    contentType,
                    sizeBytes: of.sizeBytes,
                    storagePath: of.storageKey,
                    storageBucket: env.MINIO_BUCKET,
                    metadata: { source: "sandbox" },
                  }).returning();

                  // Attach to assistant message
                  await db.insert(messageAttachments).values({
                    messageId: assistantMessage.id,
                    orgId,
                    fileId: fileRecord.id,
                    attachmentType: "file",
                  });
                }
              }
            } catch (fileErr) {
              console.error("[smart-chat] Failed to persist output files:", fileErr);
            }
          }

          // Auto-generate title for untitled conversations
          if (!conversation.title) {
            const titleMsgs = [
              ...body.messages.slice(0, 2).map((m) => ({ role: m.role, content: String(m.content).slice(0, 500) })),
              { role: "assistant", content: totalContent.slice(0, 500) },
            ];
            try {
              const title = await conversationService.generateConversationTitle(titleMsgs);
              if (title && title !== "Untitled Conversation") {
                await conversationService.updateConversation(orgId, conversationId, { title });
                await stream.writeSSE({ event: "title_generated", data: JSON.stringify({ title }) });
              }
            } catch (e) {
              console.error("[stream] title generation failed:", e);
            }
            try {
              const tagNames = await conversationService.generateConversationTags(titleMsgs);
              if (tagNames.length > 0) {
                const tags = await conversationService.assignTagsToConversation(orgId, userId, conversationId, tagNames);
                await stream.writeSSE({ event: "tags_generated", data: JSON.stringify({ tags }) });
              }
            } catch (e) {
              console.error("[stream] tag generation failed:", e);
            }
          }

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
              metadata: { latencyMs, model: body.model, partial: true },
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
      fullContent = stripThinkBlocks(fullContent);
      const assistantMessage = await messageService.createMessage(orgId, {
        conversationId,
        senderType: "assistant",
        content: fullContent,
        modelId: conversation.modelId ?? undefined,
        tokenCountPrompt: promptTokens,
        tokenCountCompletion: completionTokens,
        metadata: { latencyMs, model: body.model },
      });

      // Auto-generate title for untitled conversations
      if (!conversation.title) {
        const titleMsgs = [
          ...body.messages.slice(0, 2).map((m) => ({ role: m.role, content: String(m.content).slice(0, 500) })),
          { role: "assistant", content: fullContent.slice(0, 500) },
        ];
        try {
          const title = await conversationService.generateConversationTitle(titleMsgs);
          if (title && title !== "Untitled Conversation") {
            await conversationService.updateConversation(orgId, conversationId, { title });
            await stream.writeSSE({ event: "title_generated", data: JSON.stringify({ title }) });
          }
        } catch (e) {
          console.error("[stream] title generation failed:", e);
        }
        try {
          const tagNames = await conversationService.generateConversationTags(titleMsgs);
          if (tagNames.length > 0) {
            const tags = await conversationService.assignTagsToConversation(orgId, userId, conversationId, tagNames);
            await stream.writeSSE({ event: "tags_generated", data: JSON.stringify({ tags }) });
          }
        } catch (e) {
          console.error("[stream] tag generation failed:", e);
        }
      }

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

messagesRouter.delete("/:conversationId/messages", async (c) => {
  const orgId = c.get("orgId");
  const count = await messageService.clearMessages(orgId, c.req.param("conversationId"));
  return c.json({ ok: true, deleted: count });
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
    metadata: { replayOf: messageId, model },
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
