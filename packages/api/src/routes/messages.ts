import { Hono } from "hono";
import { zValidator } from "../lib/validator";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { AppContext } from "../types/context";
import { logger } from "../lib/logger";
import * as messageService from "../services/message.service";
import * as conversationService from "../services/conversation.service";
import { streamChatCompletion, chatCompletion, resolveModelExternalId } from "../lib/litellm";
import { AppError } from "@nova/shared/utils";
import { DEFAULTS, TASK_QUEUES } from "@nova/shared/constants";
import { notificationService } from "../services/notification.service";
import { getTemporalClient, dispatchWorkflow } from "../lib/temporal";
import { db } from "../lib/db";
import { userProfiles, users, agents, orgSettings, files, toolCalls as toolCallsTable, messageAttachments, messages as messagesTable, models, workflows, conversationKnowledgeCollections, knowledgeCollections } from "@nova/shared/schemas";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { extractFileContent } from "../lib/file-extract";
import { SKILLS, SANDBOX_PACKAGES_NOTE } from "@nova/shared/skills";
import * as artifactService from "../services/artifact.service";
import { analyticsService, calculateCostCents } from "../services/analytics.service";

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
    parentMessageId: data.parentMessageId,
  });

  if (data.attachments) {
    for (const attachment of data.attachments) {
      await messageService.addAttachment(orgId, userMessage.id, attachment);
    }
  }

  // Process @mentions: create notifications for mentioned users, handle agent mentions.
  // Fire-and-forget to avoid blocking the response.
  processMentions(orgId, userId, conversationId, data.content).catch((err) => {
    logger.error({ err }, "[mentions] Failed to process mentions");
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
  parentMessageId: z.string().uuid().optional(),
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

  // Resolve "default" or UUID to actual model external ID
  const resolvedModel = await resolveModelExternalId(orgId, body.model);

  // Resolve model UUID from external ID for analytics tracking
  let resolvedModelId: string | null = conversation.modelId;
  if (!resolvedModelId && resolvedModel) {
    const [m] = await db.select({ id: models.id }).from(models).where(eq(models.modelIdExternal, resolvedModel)).limit(1);
    resolvedModelId = m?.id ?? null;
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
      'Embed interactive widgets using a fenced code block with the language tag "widget". The opening ``` and closing ``` MUST each be on their own line:\n```widget\n{"type":"<type>","title":"...","params":{...}}\n```',
      "Available types: weather, countdown, poll, iframe, chart (bar/line/pie), progress, timer, map, math, colorpalette, checklist, timeline, dice, unitconverter, calendar, qrcode, diff, jsonexplorer, codedisplay, currency, stock, youtube, kanban, quiz, table, comparison, proscons, metric, flashcard, rating, glossary, matrix.",
      "Widgets render CLIENT-SIDE — no internet access or tools needed. Just output the JSON block.",
      "Key params by type: weather→location; countdown→date,label; poll→question,options; iframe→src,height; chart→chartType,data,labels; progress→steps,current,status; map→lat,lon,zoom,query; math→expression,displayMode; timeline→events (JSON array); stock→symbol,price,change,sparkline; kanban→columns,cards; quiz→questions (JSON array with question,options[],correctIndex); table→columns (JSON [{key,label,align}]),rows (JSON [{key:val}]),sortable; comparison→items (JSON [{name,values:{dim:val}}]),highlight (highest/lowest/none); proscons→pros,cons (comma-separated),subject; metric→metrics (JSON [{label,value,change,trend}]); flashcard→cards (JSON [{front,back}]),shuffle; rating→items (JSON [{label,score,max}]),overall,style (bars/stars); glossary→terms (JSON [{term,definition,category}]),searchable; matrix→criteria (JSON [{name,weight}]),options (JSON [{name,scores:{criterion:score}}]).",
      "Rules:",
      "- WEATHER: Always use for weather questions — it fetches live data automatically.",
      "- IFRAME: Always use to embed/show websites. You CAN embed sites. Never say you cannot.",
      "- CURRENCY: Fetches live rates automatically. STOCK: You must provide price data via web_search first.",
      "- TABLE: Use when presenting 3+ rows of structured data instead of markdown tables. Supports sorting and CSV export.",
      "- COMPARISON: Use for side-by-side evaluation of 2-4 options across multiple dimensions.",
      "- PROSCONS: Use when evaluating tradeoffs of a single subject — two-column green/red layout.",
      "- METRIC: Use when reporting 2-6 key numbers/KPIs with trends.",
      "- FLASHCARD: Use for study, vocabulary, or educational content — click-to-flip cards with scoring.",
      "- RATING: Use for scored reviews or evaluations with visual bar/star breakdowns.",
      "- GLOSSARY: Use when explaining multiple terms — accordion-style expandable definitions.",
      "- MATRIX: Use for weighted decision-making — interactive criteria weights with auto-calculated scores.",
      "- Use widgets when they genuinely enhance the response. When the user explicitly asks to see or demonstrate widgets, show all requested widgets.",
      "- Prefer widgets over tool calls when the widget can answer directly.",
      "Common mistakes to avoid:",
      "- Do NOT stringify JSON values inside params. Use actual arrays/objects: \"items\": [{...}], not \"items\": \"[{...}]\".",
      "- Do NOT invent widget types — only use the types listed above. Unknown types will show an error.",
      "- Always include the \"type\" field. A widget block without \"type\" will not render.",
      "Example (table):\n```widget\n{\"type\":\"table\",\"title\":\"Results\",\"params\":{\"columns\":[{\"key\":\"name\",\"label\":\"Name\"},{\"key\":\"score\",\"label\":\"Score\",\"align\":\"right\"}],\"rows\":[{\"name\":\"Alice\",\"score\":\"95\"},{\"name\":\"Bob\",\"score\":\"87\"}],\"sortable\":\"true\"}}\n```",
      "Example (comparison):\n```widget\n{\"type\":\"comparison\",\"title\":\"Options\",\"params\":{\"items\":[{\"name\":\"Option A\",\"values\":{\"Price\":\"$10\",\"Speed\":\"Fast\"}},{\"name\":\"Option B\",\"values\":{\"Price\":\"$5\",\"Speed\":\"Slow\"}}],\"highlight\":\"lowest\"}}\n```",
      "",
      "## Response Style",
      "IMPORTANT: Keep responses short by default. Match length to complexity:",
      "- Simple questions (greetings, factual Q&A, yes/no): 1-2 sentences.",
      "- Moderate questions (explanations, how-to): 2-4 short paragraphs with formatting.",
      "- Complex requests (analysis, code generation): Use structured sections, but do not repeat yourself.",
      "- When the user explicitly asks for detail, comprehensive output, or to show/list all of something, provide the full response without truncating.",
      "Never restate the question. Never add 'let me know if you need anything else' or similar closings.",
      "Never narrate your thought process or what you are 'about to do'. Just give the answer.",
      "Use structured formatting (lists, headings) to be scannable rather than writing long paragraphs.",
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

  // Fetch knowledge collections attached to this conversation (needs to be in outer scope for workflow args)
  const attachedCollections = await db
    .select({
      id: knowledgeCollections.id,
      name: knowledgeCollections.name,
      description: knowledgeCollections.description,
    })
    .from(conversationKnowledgeCollections)
    .innerJoin(knowledgeCollections, eq(conversationKnowledgeCollections.knowledgeCollectionId, knowledgeCollections.id))
    .where(
      and(
        eq(conversationKnowledgeCollections.conversationId, conversationId),
        eq(conversationKnowledgeCollections.orgId, orgId),
        isNull(conversationKnowledgeCollections.deletedAt),
      ),
    );

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

    if (attachedCollections.length > 0) {
      const collectionList = attachedCollections
        .map((c) => `- "${c.name}" (id: ${c.id})${c.description ? `: ${c.description}` : ""}`)
        .join("\n");
      const knowledgeSection = [
        "## Knowledge Collections",
        "The following knowledge collections are attached to this conversation. Use the query_knowledge tool to search them when the user's question may be answered by this knowledge.",
        collectionList,
      ].join("\n");
      enrichedMessages[0] = {
        ...enrichedMessages[0],
        content: `${enrichedMessages[0].content}\n\n${knowledgeSection}`,
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
          "The actual data is NOT in the conversation — it is stored in RustFS and must be accessed via tools.",
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

      // ── Tier pre-assessment: fast-path obvious follow-ups to "direct" ──
      // Only set preAssessedTier when confident the request is simple.
      // For ambiguous or first messages, leave undefined so the workflow's
      // LLM-based assessTier() activity handles classification.
      let assessedTier: "direct" | "sequential" | "orchestrated" | undefined = undefined;
      if (body.enableTools) {
        const userMsg = enrichedMessages.filter((m: any) => m.role === "user").pop()?.content ?? "";
        const priorTurns = enrichedMessages.filter((m: any) => m.role === "user" || m.role === "assistant");
        const hasPriorContext = priorTurns.length > 1;
        const msgLen = userMsg.length;

        // Follow-ups in existing conversations with short or conversational messages → direct
        if (hasPriorContext && (
          msgLen < 150 ||
          /^(now |also |can you |what about |summarize|explain|show |list |tell me |thanks|ok |yes |no |sure|great|how about|why |could you |please |yeah|got it|perfect|nice|do that|go ahead|sounds good)/i.test(userMsg)
        )) {
          assessedTier = "direct";
        }
        // Very short first messages (greetings, simple questions) without conjunctions → direct
        else if (!hasPriorContext && msgLen < 80 && !/\b(and|then|also|plus|additionally|furthermore|moreover|as well as)\b/i.test(userMsg)) {
          assessedTier = "direct";
        }
        // Everything else → undefined (deferred to workflow LLM assessor)

        logger.info({ assessedTier: assessedTier ?? "deferred-to-llm", msgLen, hasPriorContext }, "[stream] tier pre-assessment");
      }

      // When tools are enabled, always dispatch to Temporal workflow.
      // This avoids the redundant LLM call pattern where the API makes a streaming call,
      // detects tool_calls, discards the output, then Temporal makes the same call again.
      if (body.enableTools) {
        // Only send early tier.assessed for fast-pathed direct; otherwise the
        // workflow will emit the event after LLM assessment completes.
        if (assessedTier) {
          await stream.writeSSE({
            event: "tier.assessed",
            data: JSON.stringify({ tier: assessedTier }),
          });
        }

        const streamChannelId = `stream:${conversationId}:${crypto.randomUUID()}`;

        // Create placeholder assistant message with status "streaming" so it's visible if the client reconnects
        const assistantMessage = await messageService.createMessage(orgId, {
          conversationId,
          senderType: "assistant",
          content: "",
          status: "streaming",
          modelId: resolvedModelId ?? undefined,
          parentMessageId: body.parentMessageId,
        });

        // Initialize Redis keys for stream reconnection
        const { redis: redisClient } = await import("../lib/redis");
        await Promise.all([
          redisClient.set(`active-stream:${conversationId}`, streamChannelId, "EX", 1800),
          redisClient.del(`stream-events:${streamChannelId}`),
        ]);
        await redisClient.expire(`stream-events:${streamChannelId}`, 1800);

        const { relayRedisToSSE } = await import("../lib/stream-relay");
        // Defer trace span recording until after relay completes (covers full SSE duration)
        (c as any).__otelDeferred = true;
        const relayPromise = relayRedisToSSE(stream, streamChannelId, { timeoutMs: 600_000 });

        const temporalWorkflowId = `agent-chat-${conversationId}-${Date.now()}`;
        const userId = c.get("userId");

        // Create workflow record in DB so agent traces are tracked
        const [wfRecord] = await db.insert(workflows).values({
          orgId,
          temporalWorkflowId,
          type: "agent-chat",
          status: "running",
          conversationId,
          initiatedById: userId,
          input: { model: resolvedModel, temperature: body.temperature, maxTokens: body.maxTokens },
        }).returning({ id: workflows.id });

        // Build tools array — add query_knowledge when knowledge collections are attached
        const conversationTools = [...DEFAULT_TOOLS];
        const knowledgeCollectionIds = attachedCollections.map((c) => c.id);
        if (knowledgeCollectionIds.length > 0) {
          conversationTools.push({
            type: "function" as const,
            function: {
              name: "query_knowledge",
              description:
                "Search the attached knowledge collections by text similarity. Returns relevant document chunks ranked by relevance. " +
                "Use this to find information from the user's internal knowledge base. " +
                "For video transcript results, use the 'timestampUrl' field to link to the specific moment.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string", description: "The search query to find relevant knowledge" },
                  topK: { type: "number", description: "Maximum number of results to return (default 5, max 10)" },
                },
                required: ["query", "topK"],
              },
            },
          });
        }

        await dispatchWorkflow("agentWorkflow", {
          taskQueue: TASK_QUEUES.AGENT,
          workflowId: temporalWorkflowId,
          args: [{
            orgId,
            userId,
            conversationId,
            streamChannelId,
            workflowId: wfRecord.id,
            userMessage: enrichedMessages.filter((m: any) => m.role === "user").pop()?.content,
            messageHistory: enrichedMessages,
            model: resolvedModel,
            modelParams: { temperature: body.temperature, maxTokens: body.maxTokens },
            tools: conversationTools,
            knowledgeCollectionIds: knowledgeCollectionIds.length > 0 ? knowledgeCollectionIds : undefined,
            maxSteps: 25,
            enableSearchAttributes: true,
            preAssessedTier: assessedTier,
            traceId: `${c.get("requestId")}:${c.get("spanId") ?? ""}`,
          }],
        });

        // Wait for relay — resolves on stream done, error, timeout, or client disconnect.
        // Must always complete the message regardless of client connection state.
        let relayResult: Awaited<ReturnType<typeof relayRedisToSSE>> = null;
        try {
          relayResult = await relayPromise;
        } catch (relayErr) {
          logger.error({ err: relayErr }, "[stream] relay error");
        }

        // Finalize the API trace span now that the full stream is complete
        const { finalizeTrace } = await import("../middleware/tracing");
        finalizeTrace(c);

        const totalContent = stripThinkBlocks(relayResult?.content ?? "");

        let toolCallRecords: any[] = [];
        let wfTier: string | undefined;
        let wfPlanSummary: Record<string, unknown> | undefined;
        try {
          logger.info({ temporalWorkflowId }, "[stream] fetching workflow result");
          const handle = client.workflow.getHandle(temporalWorkflowId);
          const wfResult = await handle.result();
          toolCallRecords = (wfResult as any)?.toolCallRecords ?? [];
          wfTier = (wfResult as any)?.tier;
          logger.info({ tier: wfTier, toolCallRecords: toolCallRecords.length, status: (wfResult as any)?.status }, "[stream] workflow result");
          const wfPlan = (wfResult as any)?.plan;
          if (wfPlan) {
            wfPlanSummary = {
              id: wfPlan.id, tier: wfPlan.tier, reasoning: wfPlan.reasoning,
              approvalRequired: wfPlan.approvalRequired, approved: wfPlan.approved,
              nodes: (wfPlan.nodes ?? []).map((n: any) => ({
                id: n.id, description: n.description, tools: n.tools, dependencies: n.dependencies,
                status: n.status, result: n.result ? { content: n.result.content ?? "", durationMs: n.result.durationMs, tokensUsed: n.result.tokensUsed, toolCallCount: n.result.toolCallRecords?.length ?? 0 } : undefined,
              })),
            };
          }
        } catch (wfErr) {
          logger.warn({ err: wfErr }, "[stream] Failed to retrieve workflow result (may still be running)");
        }

        const toolSummary = toolCallRecords.length > 0
          ? toolCallRecords.map((r: any) => ({ name: r.toolName, durationMs: r.durationMs, error: r.error, args: r.input }))
          : relayResult?.toolRecords?.map((r: any) => ({ name: r.name, args: r.args, resultSummary: r.resultSummary }))
            ?? undefined;

        // Compute usage metrics
        const usagePromptTokens = relayResult?.usage?.prompt_tokens ?? 0;
        const usageCompletionTokens = relayResult?.usage?.completion_tokens ?? 0;
        const latencyMs = Date.now() - startTime;
        let costCents = 0;
        try { costCents = await calculateCostCents(resolvedModelId, usagePromptTokens, usageCompletionTokens); } catch (err) { logger.warn({ err, modelId: resolvedModelId }, "[stream] cost calculation failed"); }

        // Complete the message — this must succeed even if the client disconnected
        try {
          await messageService.completeStreamingMessage(orgId, assistantMessage.id, {
            content: totalContent,
            tokenCountPrompt: usagePromptTokens,
            tokenCountCompletion: usageCompletionTokens,
            costCents,
            metadata: { latencyMs, model: body.model, smartRouted: true, toolSummary, tier: wfTier ?? assessedTier, plan: wfPlanSummary },
          });
        } catch (completeErr) {
          logger.error({ err: completeErr }, "[stream] Failed to complete streaming message");
        }

        // Record usage analytics
        try {
          await analyticsService.recordUsage(orgId, {
            userId,
            modelId: resolvedModelId ?? undefined,
            promptTokens: usagePromptTokens,
            completionTokens: usageCompletionTokens,
            costCents,
            latencyMs,
          });
        } catch (analyticsErr) {
          logger.error({ err: analyticsErr }, "[stream] Failed to record usage analytics");
        }

        if (toolCallRecords.length > 0) {
          try {
            await db.insert(toolCallsTable).values(
              toolCallRecords.map((r: any) => ({
                messageId: assistantMessage.id, conversationId, orgId,
                toolName: r.toolName, input: r.input, output: r.output ?? null,
                status: r.error ? "error" : "completed", errorMessage: r.error ?? null, durationMs: r.durationMs,
              })),
            );
          } catch (dbErr) { logger.error({ err: dbErr }, "[planned-chat] Failed to persist tool calls"); }

          // Extract output files from code_execute results and attach to message
          try {
            const { env } = await import("../lib/env");
            for (const r of toolCallRecords) {
              if (r.toolName !== "code_execute") continue;
              const output = r.output as { outputFiles?: { name: string; sizeBytes: number; storageKey: string }[] } | null;
              if (!output?.outputFiles?.length) continue;

              for (const of_ of output.outputFiles) {
                const ext = of_.name.split(".").pop()?.toLowerCase() ?? "";

                if (ext === "excalidraw") {
                  try {
                    const { getObjectBuffer } = await import("../lib/s3");
                    const buf = await getObjectBuffer(of_.storageKey);
                    const content = buf.toString("utf-8");
                    const title = of_.name.replace(/\.excalidraw$/, "") || "Diagram";
                    await artifactService.createArtifact(orgId, {
                      messageId: assistantMessage.id,
                      conversationId,
                      type: "excalidraw",
                      title,
                      content,
                      metadata: { sourceType: "sandbox" },
                    });
                  } catch (artifactErr) {
                    logger.error({ err: artifactErr }, "[planned-chat] Failed to create excalidraw artifact");
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

                const [fileRecord] = await db.insert(files).values({
                  orgId, userId,
                  filename: of_.name, contentType,
                  sizeBytes: of_.sizeBytes,
                  storagePath: of_.storageKey,
                  storageBucket: env.S3_BUCKET,
                  metadata: { source: "sandbox" },
                }).returning();

                await db.insert(messageAttachments).values({
                  messageId: assistantMessage.id, orgId,
                  fileId: fileRecord.id,
                  attachmentType: "file",
                });
              }
            }
          } catch (fileErr) {
            logger.error({ err: fileErr }, "[planned-chat] Failed to persist output files");
          }

          // Extract generated images from image_generate results and attach to message
          try {
            const envMod = await import("../lib/env");
            for (const r of toolCallRecords) {
              if (r.toolName !== "image_generate") continue;
              const output = r.output as {
                success?: boolean;
                storageKey?: string;
                mimeType?: string;
                sizeBytes?: number;
                revisedPrompt?: string;
              } | null;
              if (!output?.success || !output.storageKey) continue;

              const [fileRecord] = await db.insert(files).values({
                orgId, userId,
                filename: `generated-image-${Date.now()}.png`,
                contentType: output.mimeType ?? "image/png",
                sizeBytes: output.sizeBytes ?? 0,
                storagePath: output.storageKey,
                storageBucket: envMod.env.S3_BUCKET,
                metadata: { source: "image_generation", revisedPrompt: output.revisedPrompt },
              }).returning();

              await db.insert(messageAttachments).values({
                messageId: assistantMessage.id, orgId,
                fileId: fileRecord.id,
                attachmentType: "file",
              });
            }
          } catch (imgErr) {
            logger.error({ err: imgErr }, "[planned-chat] Failed to persist generated images");
          }
        }

        // Auto-generate title for untitled conversations
        if (!conversation.title) {
          const titleMsgs = [
            ...body.messages.slice(0, 2).map((m) => ({ role: m.role, content: String(m.content).slice(0, 500) })),
            { role: "assistant", content: totalContent.slice(0, 500) },
          ];
          try {
            const title = await conversationService.generateConversationTitle(titleMsgs, orgId);
            if (title && title !== "Untitled Conversation") {
              await conversationService.updateConversation(orgId, conversationId, { title });
              await stream.writeSSE({ event: "title_generated", data: JSON.stringify({ title }) });
            }
          } catch (e) {
            logger.error({ err: e }, "[stream] title generation failed");
          }
          try {
            const tagNames = await conversationService.generateConversationTags(titleMsgs, orgId);
            if (tagNames.length > 0) {
              const tags = await conversationService.assignTagsToConversation(orgId, userId, conversationId, tagNames);
              await stream.writeSSE({ event: "tags_generated", data: JSON.stringify({ tags }) });
            }
          } catch (e) {
            logger.error({ err: e }, "[stream] tag generation failed");
          }
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

      // ── No-tools path: direct streaming LLM call (no Temporal) ──
      const llmStream = await streamChatCompletion({
        model: resolvedModel,
        messages: enrichedMessages,
        temperature: body.temperature,
        top_p: body.topP,
        max_tokens: body.maxTokens,
        orgId,
      } as any);

      let fullContent = "";
      let usageData: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;

      for await (const chunk of llmStream) {
        const delta = chunk.choices?.[0]?.delta;
        const token = delta?.content;
        if (token) {
          fullContent += token;
          await stream.writeSSE({
            event: "token",
            data: JSON.stringify({ content: token }),
          });
        }
        if (chunk.choices?.[0]?.finish_reason) { /* noop */ }
        if (chunk.usage) usageData = chunk.usage;
      }

      const latencyMs = Date.now() - startTime;
      const promptTokens = usageData?.prompt_tokens ?? Math.ceil(JSON.stringify(body.messages).length / 4);
      const completionTokens = usageData?.completion_tokens ?? Math.ceil(fullContent.length / 4);

      fullContent = stripThinkBlocks(fullContent);
      let costCents = 0;
      try { costCents = await calculateCostCents(resolvedModelId, promptTokens, completionTokens); } catch (err) { logger.warn({ err, modelId: resolvedModelId }, "[stream] cost calculation failed"); }

      const assistantMessage = await messageService.createMessage(orgId, {
        conversationId,
        senderType: "assistant",
        content: fullContent,
        modelId: resolvedModelId ?? undefined,
        parentMessageId: body.parentMessageId,
        tokenCountPrompt: promptTokens,
        tokenCountCompletion: completionTokens,
        costCents,
        metadata: { latencyMs, model: body.model },
      });

      // Record usage analytics
      try {
        await analyticsService.recordUsage(orgId, {
          userId,
          modelId: resolvedModelId ?? undefined,
          promptTokens,
          completionTokens,
          costCents,
          latencyMs,
        });
      } catch (analyticsErr) {
        logger.error({ err: analyticsErr }, "[stream] Failed to record usage analytics");
      }

      // Auto-generate title for untitled conversations
      if (!conversation.title) {
        const titleMsgs = [
          ...body.messages.slice(0, 2).map((m) => ({ role: m.role, content: String(m.content).slice(0, 500) })),
          { role: "assistant", content: fullContent.slice(0, 500) },
        ];
        try {
          const title = await conversationService.generateConversationTitle(titleMsgs, orgId);
          if (title && title !== "Untitled Conversation") {
            await conversationService.updateConversation(orgId, conversationId, { title });
            await stream.writeSSE({ event: "title_generated", data: JSON.stringify({ title }) });
          }
        } catch (e) {
          logger.error({ err: e }, "[stream] title generation failed");
        }
        try {
          const tagNames = await conversationService.generateConversationTags(titleMsgs, orgId);
          if (tagNames.length > 0) {
            const tags = await conversationService.assignTagsToConversation(orgId, userId, conversationId, tagNames);
            await stream.writeSSE({ event: "tags_generated", data: JSON.stringify({ tags }) });
          }
        } catch (e) {
          logger.error({ err: e }, "[stream] tag generation failed");
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
      logger.error({ err }, "[stream] outer error");
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

// Get sibling messages (messages sharing the same parentMessageId) for branch navigation
messagesRouter.get("/:conversationId/messages/:messageId/siblings", async (c) => {
  const orgId = c.get("orgId");
  const siblings = await messageService.listSiblings(orgId, c.req.param("messageId"));
  return c.json({ data: siblings });
});

// Delete all messages after a given message (for rerun/branching)
messagesRouter.post("/:conversationId/messages/:messageId/truncate-after", async (c) => {
  const orgId = c.get("orgId");
  const conversationId = c.req.param("conversationId");
  const messageId = c.req.param("messageId");
  const count = await messageService.deleteMessagesAfter(orgId, conversationId, messageId);
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
    orgId,
  });

  const data = result as any;
  const content = data.choices?.[0]?.message?.content ?? "";
  const replayPromptTokens = data.usage?.prompt_tokens ?? 0;
  const replayCompletionTokens = data.usage?.completion_tokens ?? 0;
  let replayCostCents = 0;
  try { replayCostCents = await calculateCostCents(replayConversation.modelId, replayPromptTokens, replayCompletionTokens); } catch (err) { logger.warn({ err, modelId: replayConversation.modelId }, "[replay] cost calculation failed"); }

  // Save as a new assistant message
  const replayMessage = await messageService.createMessage(orgId, {
    conversationId,
    senderType: "assistant",
    content,
    modelId: model,
    tokenCountPrompt: replayPromptTokens,
    tokenCountCompletion: replayCompletionTokens,
    costCents: replayCostCents,
    metadata: { replayOf: messageId, model },
  });

  // Record usage analytics
  try {
    await analyticsService.recordUsage(orgId, {
      userId,
      modelId: replayConversation.modelId ?? undefined,
      promptTokens: replayPromptTokens,
      completionTokens: replayCompletionTokens,
      costCents: replayCostCents,
    });
  } catch (analyticsErr) {
    logger.error({ err: analyticsErr }, "[replay] Failed to record usage analytics");
  }

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

// --- Stream reconnection endpoints ---

/** Check if there's an active stream for a conversation */
messagesRouter.get("/:conversationId/messages/stream/active", async (c) => {
  const orgId = c.get("orgId");
  const conversationId = c.req.param("conversationId");

  const conversation = await conversationService.getConversation(orgId, conversationId);
  if (!conversation) throw AppError.notFound("Conversation");

  const { redis } = await import("../lib/redis");
  const channelId = await redis.get(`active-stream:${conversationId}`);
  if (!channelId) return c.json({ active: false });

  return c.json({ active: true, channelId });
});

/** Reconnect to an in-progress stream: sends buffered content then resumes live relay */
messagesRouter.get("/:conversationId/messages/stream/reconnect", async (c) => {
  const orgId = c.get("orgId");
  const conversationId = c.req.param("conversationId");
  const channelId = c.req.query("channelId");

  if (!channelId) throw AppError.badRequest("Missing channelId query parameter");

  const conversation = await conversationService.getConversation(orgId, conversationId);
  if (!conversation) throw AppError.notFound("Conversation");

  // Verify the channelId belongs to this conversation
  if (!channelId.startsWith(`stream:${conversationId}:`)) {
    throw AppError.badRequest("Channel ID does not match conversation");
  }

  return streamSSE(c, async (stream) => {
    const { relayRedisToSSEWithCatchup } = await import("../lib/stream-relay");
    try {
      await relayRedisToSSEWithCatchup(stream, channelId, { timeoutMs: 600_000 });
    } catch (err) {
      logger.error({ err }, "[reconnect] relay error");
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: "Reconnect failed", code: "reconnect_error" }),
      });
    }
  });
});

export { messagesRouter as messageRoutes };
