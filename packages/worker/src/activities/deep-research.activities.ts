import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { researchReports } from "@nova/shared/schemas";

export async function searchWeb(query: string, iteration: number): Promise<{ url: string; title: string }[]> {
  // In production, call a search API (e.g., Bing, Google, SearxNG)
  // For now, return empty - this is the integration point
  return [];
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
  const litellmUrl = process.env.LITELLM_URL ?? "http://localhost:4000";
  const model = process.env.RESEARCH_MODEL ?? "gpt-4o-mini";

  const resp = await fetch(`${litellmUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const litellmUrl = process.env.LITELLM_URL ?? "http://localhost:4000";
  const model = process.env.RESEARCH_MODEL ?? "gpt-4o";

  const sourceSummaries = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.content}`).join("\n\n");

  const resp = await fetch(`${litellmUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Generate a comprehensive research report with citations. Use [n] format for citations. Include an executive summary, key findings, detailed analysis, and conclusion." },
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
