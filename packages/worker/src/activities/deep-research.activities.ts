import { eq, and, inArray, isNull, sql, desc } from "drizzle-orm";
import { Context } from "@temporalio/activity";
import { db } from "../lib/db";
import { openai } from "../lib/litellm";
import { getDefaultChatModel } from "../lib/models";
import { researchReports, knowledgeChunks, knowledgeDocuments, files, fileChunks } from "@nova/shared/schemas";
import { extractFromHtml } from "@nova/shared/content";

export async function searchWeb(query: string, iteration: number): Promise<{ url: string; title: string }[]> {
  Context.current().heartbeat(`Search iteration ${iteration + 1}`);
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
  Context.current().heartbeat(`Fetching ${url}`);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "NovaBot/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    // Use structured extraction for HTML content
    if (contentType.includes("text/html") || contentType.includes("xhtml") ||
        text.trimStart().slice(0, 200).toLowerCase().startsWith("<!doctype html") ||
        text.trimStart().slice(0, 200).toLowerCase().startsWith("<html")) {
      const extracted = extractFromHtml(text, url);
      return extracted.markdown.slice(0, 50_000);
    }

    return text.slice(0, 50_000);
  } catch {
    return "";
  }
}

export async function analyzeSource(query: string, content: string): Promise<{ summary: string; relevance: number }> {
  Context.current().heartbeat("Analyzing source");
  const model = process.env.RESEARCH_MODEL ?? await getDefaultChatModel();

  try {
    const result = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "Analyze this source for relevance to the research query. Return a JSON with 'summary' (200 words max) and 'relevance' (0-100 score)." },
        { role: "user", content: `Query: ${query}\n\nSource content:\n${content.slice(0, 10_000)}` },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const parsed = JSON.parse(result.choices?.[0]?.message?.content ?? "{}");
    return { summary: parsed.summary ?? "", relevance: parsed.relevance ?? 50 };
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

  Context.current().heartbeat(`Generating report from ${sources.length} sources`);
  const result = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Generate a comprehensive research report in standard markdown format. Use ## headings for sections (Executive Summary, Key Findings, Detailed Analysis, Conclusion, References). Use paragraphs, bullet points, and numbered lists for content — do NOT use markdown tables. Use [n] format for inline citations that reference the numbered sources.\n\nIMPORTANT: The very first line of your response MUST be a concise title (max 80 characters) for this report, prefixed with \"TITLE: \". Then leave a blank line before the report content." },
      { role: "user", content: `Research query: ${query}\n\nSources:\n${sourceSummaries}` },
    ],
    max_tokens: 4096,
    temperature: 0.5,
  });

  const rawOutput = result.choices?.[0]?.message?.content ?? "Report generation failed.";

  // Extract title from the first line if present
  let title: string | null = null;
  let report = rawOutput;
  const titleMatch = rawOutput.match(/^TITLE:\s*(.+)/);
  if (titleMatch) {
    title = titleMatch[1].trim().slice(0, 80);
    report = rawOutput.slice(titleMatch[0].length).replace(/^\n+/, "");
  }

  await db.update(researchReports).set({
    reportContent: report,
    title,
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

// --- Redis publishing activities for real-time research SSE ---

import type { ResearchProgressType, ResearchStatus } from "@nova/shared/constants";
import {
  publishResearchStatus,
  publishResearchSource,
  publishResearchProgress,
  publishResearchDone,
  publishResearchError,
} from "../lib/stream-publisher";

export async function publishResearchStatusActivity(
  channelId: string,
  status: ResearchStatus,
  phase?: string,
): Promise<void> {
  await publishResearchStatus(channelId, status, phase);
}

export async function publishResearchSourceActivity(
  channelId: string,
  source: { title: string; url: string; relevance?: number },
): Promise<void> {
  await publishResearchSource(channelId, source);
}

export async function publishResearchProgressActivity(
  channelId: string,
  progressType: ResearchProgressType,
  message: string,
  extra?: { sourceUrl?: string },
): Promise<void> {
  await publishResearchProgress(channelId, progressType, message, extra);
}

export async function publishResearchDoneActivity(
  channelId: string,
  data: { reportId: string; sourcesCount: number },
): Promise<void> {
  await publishResearchDone(channelId, data);
}

export async function publishResearchErrorActivity(
  channelId: string,
  message: string,
): Promise<void> {
  await publishResearchError(channelId, message);
}

export async function queryKnowledgeCollections(
  orgId: string,
  collectionIds: string[],
  query: string,
  topK: number,
): Promise<{ collectionId: string; documentId: string; documentName: string; content: string; score: number }[]> {
  if (collectionIds.length === 0) return [];

  // Use text similarity search (pg_trgm) since the worker may not have the embedding model.
  // This avoids needing to generate embeddings in the worker process.
  const results = await db
    .select({
      id: knowledgeChunks.id,
      collectionId: knowledgeChunks.knowledgeCollectionId,
      documentId: knowledgeChunks.knowledgeDocumentId,
      content: knowledgeChunks.content,
      score: sql<number>`similarity(${knowledgeChunks.content}, ${query})`.as("score"),
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.orgId, orgId),
        inArray(knowledgeChunks.knowledgeCollectionId, collectionIds),
        isNull(knowledgeChunks.deletedAt),
      ),
    )
    .orderBy(desc(sql`similarity(${knowledgeChunks.content}, ${query})`))
    .limit(topK);

  // Fetch document names for the matched chunks
  const docIds = [...new Set(results.map((r) => r.documentId))];
  const docs = docIds.length > 0
    ? await db
        .select({ id: knowledgeDocuments.id, title: knowledgeDocuments.title })
        .from(knowledgeDocuments)
        .where(inArray(knowledgeDocuments.id, docIds))
    : [];
  const docNameMap = new Map(docs.map((d) => [d.id, d.title ?? "Untitled"]));

  return results.map((r) => ({
    collectionId: r.collectionId,
    documentId: r.documentId,
    documentName: docNameMap.get(r.documentId) ?? "Untitled",
    content: r.content,
    score: r.score ?? 0,
  }));
}

export async function fetchFileContents(
  orgId: string,
  fileIds: string[],
): Promise<{ fileId: string; filename: string; content: string }[]> {
  if (fileIds.length === 0) return [];

  // Get file metadata
  const fileRecords = await db
    .select({ id: files.id, filename: files.filename })
    .from(files)
    .where(
      and(
        eq(files.orgId, orgId),
        inArray(files.id, fileIds),
        isNull(files.deletedAt),
      ),
    );

  const results: { fileId: string; filename: string; content: string }[] = [];

  for (const file of fileRecords) {
    // Retrieve pre-chunked content from file_chunks table
    const chunks = await db
      .select({ content: fileChunks.content, chunkIndex: fileChunks.chunkIndex })
      .from(fileChunks)
      .where(
        and(
          eq(fileChunks.fileId, file.id),
          eq(fileChunks.orgId, orgId),
          isNull(fileChunks.deletedAt),
        ),
      )
      .orderBy(fileChunks.chunkIndex);

    const content = chunks.map((c) => c.content).join("\n\n");
    if (content.length > 0) {
      results.push({ fileId: file.id, filename: file.filename, content: content.slice(0, 50_000) });
    }
  }

  return results;
}
