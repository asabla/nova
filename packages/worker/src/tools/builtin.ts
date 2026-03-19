import { tool } from "@openai/agents";
import { extractFromHtml } from "@nova/shared/content";

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

/** All built-in tools as an array, ready to attach to an Agent */
export const builtinTools = [webSearchTool, fetchUrlTool];
