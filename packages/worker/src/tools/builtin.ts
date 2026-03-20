import { tool } from "@openai/agents";
import { extractFromHtml } from "@nova/shared/content";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { openai } from "../lib/litellm";
import { getDefaultChatModel } from "../lib/models";

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
 * Search SearxNG across multiple categories and deduplicate by URL.
 * Uses both "general" and "news" categories for broader coverage.
 */
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
  // Search news first (higher quality for current events), then general as fallback
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
    "Execute code in a secure sandboxed environment. Returns stdout, stderr, and exit code. Network access is disabled. Supports Python, JavaScript, TypeScript, Bash, and more. Input files are available at /sandbox/input/. Write output files to /sandbox/output/ to return them.",
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
    },
    required: ["language", "code", "stdin", "timeout", "input_file_ids"],
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

      const { getObjectBuffer } = await import("../lib/minio");
      inputFiles = await Promise.all(
        fileRecords.map(async (f: any) => ({
          name: f.filename ?? f.id,
          data: await getObjectBuffer(f.storagePath),
        })),
      );
    }

    const { sandboxExecute } = await import("../lib/docker-sandbox");
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
      const { putObjectBuffer } = await import("../lib/minio");
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

/** All built-in tools as an array, ready to attach to an Agent */
export const builtinTools = [webSearchTool, fetchUrlTool, invokeAgentTool, codeExecuteTool];
