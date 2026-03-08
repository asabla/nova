import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { LITELLM_URL, litellmHeaders } from "../lib/litellm";
import { getDefaultChatModel } from "../lib/models";
import { researchReports } from "@nova/shared/schemas";

export async function searchWeb(query: string, iteration: number): Promise<{ url: string; title: string }[]> {
  const searxngUrl = process.env.SEARXNG_URL;

  // Try SearxNG first (self-hosted search)
  if (searxngUrl) {
    try {
      const url = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general&pageno=${iteration + 1}`;
      console.log(`[RESEARCH] SearxNG search: ${url}`);
      const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (resp.ok) {
        const data = await resp.json() as { results: { url: string; title: string }[] };
        const results = (data.results ?? []).slice(0, 10).map((r) => ({ url: r.url, title: r.title }));
        console.log(`[RESEARCH] SearxNG returned ${results.length} results`);
        return results;
      }
      console.warn(`[RESEARCH] SearxNG returned ${resp.status}`);
    } catch (err) {
      console.warn(`[RESEARCH] SearxNG failed, falling back to DuckDuckGo:`, (err as Error).message);
    }
  } else {
    console.warn("[RESEARCH] SEARXNG_URL not set, using DuckDuckGo fallback");
  }

  // Fallback: DuckDuckGo Lite (plain HTML, more bot-friendly than html.duckduckgo.com)
  try {
    const resp = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NovaResearch/1.0)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resp.ok) return [];
    const html = await resp.text();

    // DDG Lite uses simple <a> tags with class="result-link"
    const results: { url: string; title: string }[] = [];
    const linkRegex = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null && results.length < 10) {
      const url = match[1].trim();
      const title = match[2].trim();
      if (url.startsWith("http")) {
        results.push({ url, title: title || url });
      }
    }

    // If result-link class didn't match, try broader extraction of external links
    if (results.length === 0) {
      const broadRegex = /<a[^>]+href="(https?:\/\/(?!duckduckgo\.com)[^"]+)"[^>]*>([^<]+)<\/a>/gi;
      while ((match = broadRegex.exec(html)) !== null && results.length < 10) {
        const url = match[1].trim();
        const title = match[2].trim();
        if (title.length > 3) {
          results.push({ url, title });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "NovaBot/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    // Strip HTML tags for basic extraction
    return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50_000);
  } catch {
    return "";
  }
}

export async function analyzeSource(query: string, content: string): Promise<{ summary: string; relevance: number }> {
  const model = process.env.RESEARCH_MODEL ?? await getDefaultChatModel();

  const resp = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: litellmHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Analyze this source for relevance to the research query. Return a JSON with 'summary' (200 words max) and 'relevance' (0-100 score)." },
        { role: "user", content: `Query: ${query}\n\nSource content:\n${content.slice(0, 10_000)}` },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  });

  try {
    const data = await resp.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return { summary: result.summary ?? "", relevance: result.relevance ?? 50 };
  } catch {
    return { summary: content.slice(0, 500), relevance: 50 };
  }
}

export async function generateResearchReport(
  reportId: string,
  query: string,
  sources: { url: string; title: string; content: string; relevance: number }[],
): Promise<void> {
  const model = process.env.RESEARCH_MODEL ?? await getDefaultChatModel();

  const sourceSummaries = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.content}`).join("\n\n");

  const resp = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: litellmHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Generate a comprehensive research report in standard markdown format. Use ## headings for sections (Executive Summary, Key Findings, Detailed Analysis, Conclusion, References). Use paragraphs, bullet points, and numbered lists for content — do NOT use markdown tables. Use [n] format for inline citations that reference the numbered sources." },
        { role: "user", content: `Research query: ${query}\n\nSources:\n${sourceSummaries}` },
      ],
      max_tokens: 4096,
      temperature: 0.5,
    }),
  });

  const data = await resp.json();
  const report = data.choices?.[0]?.message?.content ?? "Report generation failed.";

  await db.update(researchReports).set({
    reportContent: report,
    sources: sources.map((s) => ({ url: s.url, title: s.title })),
    updatedAt: new Date(),
  }).where(eq(researchReports.id, reportId));
}

export async function updateResearchStatus(
  reportId: string,
  status: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.update(researchReports).set({
    status,
    config: metadata ?? {},
    updatedAt: new Date(),
  }).where(eq(researchReports.id, reportId));
}
