import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  searchWeb,
  fetchPageContent,
  analyzeSource,
  generateResearchReport,
  updateResearchStatus,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: { maximumAttempts: 3 },
});

export interface DeepResearchInput {
  orgId: string;
  conversationId: string;
  reportId: string;
  query: string;
  maxSources: number;
  maxIterations: number;
}

export async function deepResearchWorkflow(input: DeepResearchInput): Promise<void> {
  await updateResearchStatus(input.reportId, "searching", { query: input.query });

  const sources: { url: string; title: string; content: string; relevance: number }[] = [];

  for (let iteration = 0; iteration < input.maxIterations; iteration++) {
    await updateResearchStatus(input.reportId, "searching", {
      iteration: iteration + 1,
      sourcesFound: sources.length,
    });

    const searchResults = await searchWeb(input.query, iteration);

    for (const result of searchResults.slice(0, input.maxSources)) {
      const content = await fetchPageContent(result.url);
      const analysis = await analyzeSource(input.query, content);

      sources.push({
        url: result.url,
        title: result.title,
        content: analysis.summary,
        relevance: analysis.relevance,
      });

      await updateResearchStatus(input.reportId, "analyzing", {
        currentSource: result.title,
        sourcesProcessed: sources.length,
      });
    }

    if (sources.length >= input.maxSources) break;
  }

  await updateResearchStatus(input.reportId, "generating", {
    totalSources: sources.length,
  });

  const topSources = sources.sort((a, b) => b.relevance - a.relevance).slice(0, input.maxSources);
  await generateResearchReport(input.reportId, input.query, topSources);
  await updateResearchStatus(input.reportId, "completed", { totalSources: topSources.length });
}
