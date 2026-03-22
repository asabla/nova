import { tool } from "@openai/agents";
import type { FunctionTool } from "@openai/agents";
import { extractFromHtml } from "@nova/shared/content";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";
import { openai } from "../litellm";
import { getDefaultChatModel, getDefaultEmbeddingModel } from "../models";
import { COLLECTIONS, searchVector, scrollFullText, scrollFiltered } from "../qdrant";

/**
 * Built-in tools extracted from agent-execution.activities.ts,
 * re-defined as OpenAI Agent SDK tool() definitions with JSON Schema parameters.
 * (Using JSON Schema instead of Zod to avoid Zod 3/4 version conflicts.)
 */

interface SearxResult {
  url: string;
  title: string;
  content: string;
}

/**
 * Filter out homepage/generic URLs that aren't actual articles.
 */
function isArticleUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Homepage URLs (path is "/" or empty) are usually not articles
    if (u.pathname === "/" || u.pathname === "") return false;
    // Very short paths are likely section pages, not articles
    if (u.pathname.split("/").filter(Boolean).length < 2) return false;
    return true;
  } catch {
    return true;
  }
}

async function searchSearxNG(
  searxngUrl: string,
  query: string,
  maxResults: number,
): Promise<{ title: string; url: string; snippet: string }[] | null> {
  const url = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=news,general&language=en`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return null;

    const data = (await resp.json()) as { results: SearxResult[] };
    const raw = data.results ?? [];
    if (raw.length === 0) return null;

    // Deduplicate by URL hostname+pathname and filter out homepages
    const seen = new Set<string>();
    const deduped: SearxResult[] = [];
    for (const r of raw) {
      if (!isArticleUrl(r.url)) continue;
      try {
        const key = new URL(r.url).hostname + new URL(r.url).pathname;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(r);
        }
      } catch {
        deduped.push(r);
      }
    }

    if (deduped.length === 0) return null;

    return deduped.slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content ?? "").slice(0, 300),
    }));
  } catch {
    return null;
  }
}

export const webSearchTool = tool({
  name: "web_search",
  description: "Search the web for information on a given query. Returns a list of results with titles, URLs, and snippets. Searches both web and news sources.",
  parameters: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "The search query" },
      maxResults: { type: "number", description: "Maximum number of results to return (default 5)" },
    },
    required: ["query", "maxResults"],
    additionalProperties: false,
  },
  execute: async (args: unknown) => {
    const { query, maxResults = 5 } = args as { query: string; maxResults?: number };
    const searxngUrl = process.env.SEARXNG_URL;

    // Use SearxNG (self-hosted) if available, fall back to DuckDuckGo
    if (searxngUrl) {
      const results = await searchSearxNG(searxngUrl, query, maxResults);
      if (results && results.length > 0) return results;
    }

    // Fallback: DuckDuckGo instant answer API
    const resp = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const data = (await resp.json()) as Record<string, unknown>;
    return {
      abstract: ((data.Abstract as string) ?? "").slice(0, 500),
      abstractSource: data.AbstractSource,
      abstractURL: data.AbstractURL,
      relatedTopics: ((data.RelatedTopics as any[]) ?? [])
        .slice(0, maxResults)
        .map((t: any) => ({
          text: (t.Text ?? "").slice(0, 200),
          url: t.FirstURL,
        })),
    };
  },
});

export const fetchUrlTool = tool({
  name: "fetch_url",
  description: "Fetch and extract the readable content of a web page at the given URL. Returns the article text in markdown format, not raw HTML.",
  parameters: {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "The URL to fetch" },
    },
    required: ["url"],
    additionalProperties: false,
  },
  execute: async (args: unknown) => {
    const { url } = args as { url: string };
    const resp = await fetch(url, {
      headers: { "User-Agent": "NOVA-Agent/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await resp.text();

    // Extract readable content using Readability + markdown conversion
    const extracted = extractFromHtml(html, url);
    const title = extracted.title ?? "";
    const content = extracted.markdown || extracted.textContent || "";

    if (!content || content.length < 50) {
      // Readability couldn't extract — return truncated raw text as fallback
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
    }

    const result = title ? `# ${title}\n\n${content}` : content;
    return result.slice(0, 6000);
  },
});

export const invokeAgentTool = tool({
  name: "invoke_agent",
  description:
    "Delegate a task to a specialized agent. Use when users @mention an agent or when the task matches an agent's expertise.",
  parameters: {
    type: "object" as const,
    properties: {
      agent_id: { type: "string", description: "The agent's ID" },
      task: {
        type: "string",
        description: "Clear description of what the agent should do",
      },
    },
    required: ["agent_id", "task"],
    additionalProperties: false,
  },
  execute: async (args: unknown) => {
    const { agent_id, task } = args as { agent_id: string; task: string };

    // Look up the agent config
    const { agents } = await import("@nova/shared/schemas");
    const [agent] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, agent_id),
          eq(agents.isEnabled, true),
          isNull(agents.deletedAt),
        ),
      );

    if (!agent) {
      return { error: `Agent ${agent_id} not found or is disabled` };
    }

    const model = agent.modelId ?? (await getDefaultChatModel());
    const temperature =
      (agent.modelParams as any)?.temperature ?? 0.7;
    const maxTokens =
      (agent.modelParams as any)?.maxTokens ?? 16384;

    const messages = [
      ...(agent.systemPrompt
        ? [{ role: "system" as const, content: agent.systemPrompt }]
        : []),
      { role: "user" as const, content: task },
    ];

    const result = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const content = result.choices?.[0]?.message?.content ?? "";
    return {
      agent_name: agent.name,
      response: content,
    };
  },
});

export const codeExecuteTool = tool({
  name: "code_execute",
  description:
    "Execute code in a secure sandboxed environment. Returns stdout, stderr, and exit code. Network access is disabled. Supports Python, JavaScript, TypeScript, Bash, and more. To process uploaded files, pass their IDs (from the conversation file list) via input_file_ids — they will be available at /sandbox/input/<filename>. Write output files to /sandbox/output/ to return them. Never ask the user for file IDs. Skill scripts and docs are baked into the image at /sandbox/skills/{name}/.",
  parameters: {
    type: "object" as const,
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
        description: "Skill for specialized processing: 'xlsx' (spreadsheets), 'pdf' (PDFs), 'docx' (Word), 'pptx' (PowerPoint), 'algorithmic-art' (generative art), 'brand-guidelines' (Anthropic brand), 'canvas-design' (visual art/posters), 'claude-api' (Claude SDK), 'doc-coauthoring' (collaborative writing), 'frontend-design' (UI design), 'internal-comms' (org communications), 'mcp-builder' (MCP servers), 'theme-factory' (styling themes), 'web-artifacts-builder' (React artifacts), 'webapp-testing' (Playwright testing). Scripts at /sandbox/skills/{name}/.",
      },
    },
    required: ["language", "code", "stdin", "timeout", "input_file_ids", "skill"],
    additionalProperties: false,
  },
  execute: async (args: unknown) => {
    const { language, code, stdin, timeout, input_file_ids } = args as {
      language: string;
      code: string;
      stdin: string | null;
      timeout: number | null;
      input_file_ids: string[] | null;
    };

    const sandboxEnabled =
      process.env.SANDBOX_ENABLED === "true" || process.env.SANDBOX_ENABLED === "1";
    if (!sandboxEnabled) {
      return { error: "Code execution is disabled (SANDBOX_ENABLED is not set)" };
    }

    // Resolve file IDs to storage keys + names
    let inputFiles: { name: string; data: Buffer }[] | undefined;
    if (input_file_ids && input_file_ids.length > 0 && Array.isArray(input_file_ids)) {
      const { files: filesTable } = await import("@nova/shared/schema");
      const { inArray } = await import("drizzle-orm");
      const fileRecords = await db
        .select()
        .from(filesTable)
        .where(inArray(filesTable.id, input_file_ids));

      const { getObjectBuffer } = await import("../minio");
      inputFiles = await Promise.all(
        fileRecords.map(async (f: any) => ({
          name: f.filename ?? f.id,
          data: await getObjectBuffer(f.storagePath),
        })),
      );
    }

    const { sandboxExecute } = await import("../docker-sandbox");
    const result = await sandboxExecute({
      language,
      code,
      stdin: stdin ?? undefined,
      runTimeout: Math.min(timeout ?? 30_000, 300_000),
      inputFiles,
    });

    // Upload output files to MinIO
    let outputFileInfo: { name: string; sizeBytes: number }[] = [];
    if (result.outputFiles.length > 0) {
      const { putObjectBuffer } = await import("../minio");
      const { randomUUID } = await import("node:crypto");
      const execId = randomUUID();
      outputFileInfo = await Promise.all(
        result.outputFiles.map(async (f) => {
          const key = `sandbox/${execId}/${f.name}`;
          await putObjectBuffer(key, f.data);
          return { name: f.name, sizeBytes: f.data.length, storageKey: key };
        }),
      );
    }

    return {
      stdout: result.run.stdout.slice(0, 100_000),
      stderr: result.run.stderr.slice(0, 10_000),
      exitCode: result.run.code,
      language: result.language,
      version: result.version,
      ...(outputFileInfo.length > 0 ? { outputFiles: outputFileInfo } : {}),
    };
  },
});

/**
 * Factory: creates a search_workspace tool scoped to a specific org.
 * Searches across conversations, messages, knowledge docs, knowledge chunks, and files.
 */
export function createSearchWorkspaceTool(orgId: string) {
  return tool({
    name: "search_workspace",
    description:
      "Search the workspace for information across past conversations, messages, knowledge base documents, and files. " +
      "Supports keyword (full-text) and semantic (embedding-based) search, plus date range filtering. " +
      "Use this when the user wants to find something from earlier conversations, stored knowledge, or uploaded files. " +
      "IMPORTANT: Always use type 'all' unless the user specifically asks to search only one type. " +
      "For temporal queries like 'yesterday' or 'last week', use dateFrom/dateTo to filter by time range. " +
      "You can combine date filters with a broad query (e.g. query='' with dateFrom to list recent activity).",
    parameters: {
      type: "object" as const,
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
      additionalProperties: false,
    },
    execute: async (args: unknown) => {
      const raw = args as {
        query: string;
        type?: string | null;
        mode?: string | null;
        limit?: number | null;
        dateFrom?: string | null;
        dateTo?: string | null;
      };

      const query = raw.query;
      const type = raw.type ?? "all";
      const mode = raw.mode ?? "semantic";
      const limit = Math.min(raw.limit ?? 10, 20);
      const dateFrom = raw.dateFrom ?? null;
      const dateTo = raw.dateTo ?? null;

      // Build base filters
      const mustFilters: Record<string, unknown>[] = [
        { key: "orgId", match: { value: orgId } },
      ];
      if (dateFrom) {
        mustFilters.push({ key: "createdAt", range: { gte: dateFrom } });
      }
      if (dateTo) {
        mustFilters.push({ key: "createdAt", range: { lt: dateTo } });
      }
      const baseFilter = { must: mustFilters };

      const shouldSearch = (t: string) => type === "all" || type === t;

      console.log(`[search_workspace] query="${query}" type=${type} mode=${mode} limit=${limit} dateFrom=${dateFrom} dateTo=${dateTo} orgId=${orgId}`);

      // Use date-only browsing when query is empty
      const hasQuery = query.trim().length > 0;

      // Generate embedding for semantic search (only if there's a query)
      let queryEmbedding: number[] | null = null;
      if (mode === "semantic" && hasQuery) {
        try {
          const embeddingModel = process.env.EMBEDDING_MODEL ?? await getDefaultEmbeddingModel();
          console.log(`[search_workspace] generating embedding with model=${embeddingModel}`);
          const resp = await openai.embeddings.create({
            model: embeddingModel,
            input: query.slice(0, 8000),
          });
          queryEmbedding = resp.data[0]?.embedding ?? null;
          console.log(`[search_workspace] embedding generated: ${queryEmbedding ? queryEmbedding.length + ' dims' : 'null'}`);
        } catch (err) {
          console.error(`[search_workspace] embedding failed:`, err instanceof Error ? err.message : err);
          // Fall back to keyword if embedding fails
        }
      }

      const results: Record<string, unknown[]> = {};

      // Conversations — full-text on title or date-filtered browse
      if (shouldSearch("conversations")) {
        try {
          const convs = hasQuery
            ? await scrollFullText(COLLECTIONS.CONVERSATIONS, "title", query, { filter: baseFilter, limit })
            : await scrollFiltered(COLLECTIONS.CONVERSATIONS, { filter: baseFilter, limit });
          results.conversations = convs.map((p) => ({
            id: p.id,
            title: p.payload.title,
            createdAt: p.payload.createdAt,
          }));
        } catch (err) {
          console.error(`[search_workspace] conversations search failed:`, err instanceof Error ? err.message : err);
          results.conversations = [];
        }
      }

      // Messages — semantic (vector), keyword (full-text), or date-filtered browse
      if (shouldSearch("messages")) {
        try {
          if (queryEmbedding) {
            const msgs = await searchVector(COLLECTIONS.MESSAGES, queryEmbedding, {
              filter: baseFilter,
              limit,
            });
            results.messages = msgs.map((r) => ({
              id: r.id,
              conversationId: r.payload.conversationId,
              senderType: r.payload.senderType,
              content: truncate(r.payload.content as string, 300),
              createdAt: r.payload.createdAt,
              score: r.score,
            }));
          } else if (hasQuery) {
            const msgs = await scrollFullText(COLLECTIONS.MESSAGES, "content", query, {
              filter: baseFilter,
              limit,
            });
            results.messages = msgs.map((p) => ({
              id: p.id,
              conversationId: p.payload.conversationId,
              senderType: p.payload.senderType,
              content: truncate(p.payload.content as string, 300),
              createdAt: p.payload.createdAt,
            }));
          } else {
            // Date-only browse — no query text, just filter
            const msgs = await scrollFiltered(COLLECTIONS.MESSAGES, { filter: baseFilter, limit });
            results.messages = msgs.map((p) => ({
              id: p.id,
              conversationId: p.payload.conversationId,
              senderType: p.payload.senderType,
              content: truncate(p.payload.content as string, 300),
              createdAt: p.payload.createdAt,
            }));
          }
        } catch (err) {
          console.error(`[search_workspace] messages search failed:`, err instanceof Error ? err.message : err);
          results.messages = [];
        }
      }

      // Knowledge docs — full-text on title + summary, or date-filtered browse
      if (shouldSearch("knowledge")) {
        try {
          let docs: unknown[];
          if (hasQuery) {
            const byTitle = await scrollFullText(COLLECTIONS.KNOWLEDGE_DOCS, "title", query, { filter: baseFilter, limit });
            const bySummary = await scrollFullText(COLLECTIONS.KNOWLEDGE_DOCS, "summary", query, { filter: baseFilter, limit });
            const seen = new Set<string>();
            docs = [];
            for (const p of [...byTitle, ...bySummary]) {
              if (!seen.has(p.id)) {
                seen.add(p.id);
                docs.push({ id: p.id, title: p.payload.title, summary: truncate(p.payload.summary as string, 200) });
              }
            }
          } else {
            const all = await scrollFiltered(COLLECTIONS.KNOWLEDGE_DOCS, { filter: baseFilter, limit });
            docs = all.map((p) => ({ id: p.id, title: p.payload.title, summary: truncate(p.payload.summary as string, 200) }));
          }
          results.knowledge = docs.slice(0, limit);
        } catch (err) {
          console.error(`[search_workspace] knowledge search failed:`, err instanceof Error ? err.message : err);
          results.knowledge = [];
        }

        // Knowledge chunks — semantic only
        if (queryEmbedding) {
          try {
            const chunks = await searchVector(COLLECTIONS.KNOWLEDGE_CHUNKS, queryEmbedding, {
              filter: baseFilter,
              limit,
            });
            results.knowledgeChunks = chunks.map((r) => ({
              id: r.id,
              documentId: r.payload.documentId,
              content: truncate(r.payload.content as string, 500),
              score: r.score,
            }));
          } catch (err) {
            console.error(`[search_workspace] knowledge chunks search failed:`, err instanceof Error ? err.message : err);
            results.knowledgeChunks = [];
          }
        }
      }

      // Files — full-text on filename or date-filtered browse + semantic on file chunks
      if (shouldSearch("files")) {
        try {
          const fileResults = hasQuery
            ? await scrollFullText(COLLECTIONS.FILES, "filename", query, { filter: baseFilter, limit })
            : await scrollFiltered(COLLECTIONS.FILES, { filter: baseFilter, limit });
          results.files = fileResults.map((p) => ({
            id: p.id,
            filename: p.payload.filename,
          }));
        } catch (err) {
          console.error(`[search_workspace] files search failed:`, err instanceof Error ? err.message : err);
          results.files = [];
        }

        if (queryEmbedding) {
          try {
            const chunks = await searchVector(COLLECTIONS.FILE_CHUNKS, queryEmbedding, {
              filter: baseFilter,
              limit,
            });
            results.fileChunks = chunks.map((r) => ({
              id: r.id,
              fileId: r.payload.fileId,
              content: truncate(r.payload.content as string, 500),
              score: r.score,
            }));
          } catch (err) {
            console.error(`[search_workspace] file chunks search failed:`, err instanceof Error ? err.message : err);
            results.fileChunks = [];
          }
        }
      }

      const total = Object.values(results).reduce((sum, arr) => sum + (arr as unknown[]).length, 0);
      const breakdown = Object.entries(results).map(([k, v]) => `${k}:${(v as unknown[]).length}`).join(" ");
      console.log(`[search_workspace] done: total=${total} ${breakdown}`);
      return { query, mode: queryEmbedding ? "semantic" : "keyword", total, results };
    },
  });
}

function truncate(text: string | undefined | null, maxLen: number): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

// --- read_file tool ---

const READ_FILE_MAX_CHARS = 100_000; // ~25k tokens

const readFileTool = tool({
  name: "read_file",
  description:
    "Read the full content of an uploaded file by its file ID. Returns the raw text content. " +
    "For spreadsheets (xlsx/csv), returns the data as CSV text preserving all rows and columns. " +
    "For PDFs, returns extracted text. Use this when you need to access the complete content of a file " +
    "rather than semantic search snippets. File IDs are available from the conversation context " +
    "(look for file attachments or file references in the messages). " +
    "You can also pass a filename to search for matching files in the organization.",
  parameters: {
    type: "object" as const,
    properties: {
      file_id: {
        type: ["string", "null"],
        description: "The UUID of the file to read. Use this if you have the file ID from the conversation.",
      },
      filename: {
        type: ["string", "null"],
        description: "Search for a file by name if you don't have the file ID. Returns the best match.",
      },
    },
    required: ["file_id", "filename"],
    additionalProperties: false,
  },
  execute: async (args: unknown) => {
    const { file_id, filename } = args as { file_id: string | null; filename: string | null };

    if (!file_id && !filename) {
      return { error: "Provide either file_id or filename to read a file." };
    }

    try {
      const { files: filesTable } = await import("@nova/shared/schema");
      const { getObjectBuffer } = await import("../minio");

      let fileRecord: any;

      if (file_id) {
        const [record] = await db
          .select()
          .from(filesTable)
          .where(and(eq(filesTable.id, file_id), isNull(filesTable.deletedAt)))
          .limit(1);
        fileRecord = record;
      } else if (filename) {
        // Search by filename (case-insensitive partial match)
        const { ilike } = await import("drizzle-orm");
        const [record] = await db
          .select()
          .from(filesTable)
          .where(and(ilike(filesTable.filename, `%${filename}%`), isNull(filesTable.deletedAt)))
          .limit(1);
        fileRecord = record;
      }

      if (!fileRecord) {
        return { error: `File not found${file_id ? ` (id: ${file_id})` : ` (name: ${filename})`}. Check the file ID or name and try again.` };
      }

      const buffer = await getObjectBuffer(fileRecord.storagePath);
      const contentType: string = fileRecord.contentType ?? "";
      let text: string | null = null;

      // Extract content based on type
      const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if (contentType === XLSX_MIME || fileRecord.filename?.endsWith(".xlsx")) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const parts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          if (!ws) continue;
          if (workbook.SheetNames.length > 1) {
            parts.push(`## Sheet: ${sheetName}\n`);
          }
          parts.push(XLSX.utils.sheet_to_csv(ws));
        }
        text = parts.join("\n\n");
      } else if (contentType === "text/csv" || fileRecord.filename?.endsWith(".csv")) {
        text = buffer.toString("utf-8");
      } else if (contentType === "application/pdf") {
        try {
          const { createRequire } = await import("node:module");
          const req = createRequire(import.meta.url);
          const resolved = req("pdf-parse/lib/pdf-parse.js");
          const pdfParse = typeof resolved === "function" ? resolved : (resolved?.default ?? resolved);
          const result = await pdfParse(buffer);
          text = result.text;
        } catch {
          text = "[PDF text extraction failed]";
        }
      } else if (contentType?.startsWith("text/") || contentType === "application/json" || contentType === "application/xml") {
        text = buffer.toString("utf-8");
      } else {
        return {
          error: `Cannot read file content for type "${contentType}". Supported: xlsx, csv, pdf, text, json, xml, html, markdown.`,
          fileId: fileRecord.id,
          filename: fileRecord.filename,
          contentType,
          sizeBytes: fileRecord.sizeBytes,
        };
      }

      if (!text || text.trim().length === 0) {
        return { error: "File exists but content extraction returned empty.", fileId: fileRecord.id, filename: fileRecord.filename };
      }

      // Truncate very large files
      if (text.length > READ_FILE_MAX_CHARS) {
        text = text.slice(0, READ_FILE_MAX_CHARS) + `\n\n[... truncated at ${READ_FILE_MAX_CHARS} characters, total: ${text.length}]`;
      }

      return {
        fileId: fileRecord.id,
        filename: fileRecord.filename,
        contentType,
        sizeBytes: fileRecord.sizeBytes,
        content: text,
        characterCount: text.length,
      };
    } catch (err: any) {
      return { error: `Failed to read file: ${err.message ?? String(err)}` };
    }
  },
});

/** Static built-in tools (no org context needed) */
export const builtinTools = [webSearchTool, fetchUrlTool, invokeAgentTool, codeExecuteTool, readFileTool];

/**
 * All built-in tools for a given org context.
 * Includes org-scoped tools like search_workspace.
 * When allowedTools is provided, only returns tools whose names are in the list.
 * When allowedTools is null/undefined, returns all tools (backward compatible).
 */
export function getBuiltinTools(orgId?: string, allowedTools?: string[] | null): FunctionTool<any, any>[] {
  let tools: FunctionTool<any, any>[] = [...builtinTools];
  if (orgId) {
    tools.push(createSearchWorkspaceTool(orgId));
  }
  if (allowedTools && allowedTools.length > 0) {
    tools = tools.filter((t) => allowedTools.includes(t.name));
  }
  return tools;
}
