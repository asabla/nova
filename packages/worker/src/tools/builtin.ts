import { tool } from "@openai/agents";

/**
 * Built-in tools extracted from agent-execution.activities.ts,
 * re-defined as OpenAI Agent SDK tool() definitions with JSON Schema parameters.
 * (Using JSON Schema instead of Zod to avoid Zod 3/4 version conflicts.)
 */

export const webSearchTool = tool({
  name: "web_search",
  description: "Search the web for information on a given query. Returns a list of results with titles, URLs, and snippets.",
  parameters: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "The search query" },
      maxResults: { type: "number", description: "Maximum number of results to return" },
    },
    required: ["query", "maxResults"],
    additionalProperties: false,
  },
  execute: async (args: unknown) => {
    const { query, maxResults = 5 } = args as { query: string; maxResults?: number };
    const searxngUrl = process.env.SEARXNG_URL;

    // Use SearxNG (self-hosted) if available, fall back to DuckDuckGo
    if (searxngUrl) {
      try {
        const resp = await fetch(
          `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (resp.ok) {
          const data = (await resp.json()) as {
            results: { url: string; title: string; content: string }[];
          };
          return (data.results ?? []).slice(0, maxResults).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: (r.content ?? "").slice(0, 300),
          }));
        }
      } catch {
        // Fall through to DuckDuckGo
      }
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
  description: "Fetch the content of a web page at the given URL. Returns the text content, truncated to fit context limits.",
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
    const text = await resp.text();
    return text.slice(0, 4000);
  },
});

/** All built-in tools as an array, ready to attach to an Agent */
export const builtinTools = [webSearchTool, fetchUrlTool];
