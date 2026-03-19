import { proxyActivities, sleep, CancellationScope } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  searchWeb,
  fetchPageContent,
  analyzeSource,
  generateResearchReport,
  updateResearchStatus,
  queryKnowledgeCollections,
  fetchFileContents,
  publishResearchStatusActivity,
  publishResearchSourceActivity,
  publishResearchProgressActivity,
  publishResearchDoneActivity,
  publishResearchErrorActivity,
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
  streamChannelId?: string;
  sources?: {
    webSearch: boolean;
    knowledgeCollectionIds: string[];
    fileIds: string[];
  };
}

export async function deepResearchWorkflow(input: DeepResearchInput): Promise<void> {
  // Overall workflow timeout: 30 minutes to prevent indefinite execution
  await CancellationScope.withTimeout("30 minutes", async () => {
    await deepResearchWorkflowInner(input);
  });
}

async function deepResearchWorkflowInner(input: DeepResearchInput): Promise<void> {
  const srcConfig = input.sources ?? { webSearch: true, knowledgeCollectionIds: [], fileIds: [] };
  const ch = input.streamChannelId;

  await updateResearchStatus(input.reportId, "searching", { query: input.query });
  if (ch) {
    await publishResearchStatusActivity(ch, "searching");
    await publishResearchProgressActivity(ch, "query", `Researching: "${input.query}"`);
  }

  const sources: { url: string; title: string; content: string; relevance: number }[] = [];

  // ---- Internal sources: Knowledge collections ----
  if (srcConfig.knowledgeCollectionIds.length > 0) {
    const msg = `Querying ${srcConfig.knowledgeCollectionIds.length} knowledge collection(s)...`;
    await updateResearchStatus(input.reportId, "searching", { phase: "knowledge", message: msg });
    if (ch) await publishResearchProgressActivity(ch, "info", msg);

    const knowledgeResults = await queryKnowledgeCollections(
      input.orgId,
      srcConfig.knowledgeCollectionIds,
      input.query,
      Math.min(10, input.maxSources),
    );

    for (const chunk of knowledgeResults) {
      const src = {
        url: `knowledge://${chunk.collectionId}/${chunk.documentId}`,
        title: chunk.documentName || "Knowledge document",
        content: chunk.content,
        relevance: chunk.score * 100,
      };
      sources.push(src);
      if (ch) await publishResearchSourceActivity(ch, { title: src.title, url: src.url, relevance: src.relevance });
    }

    await updateResearchStatus(input.reportId, "analyzing", {
      phase: "knowledge",
      sourcesFromKnowledge: knowledgeResults.length,
    });
    if (ch) await publishResearchStatusActivity(ch, "analyzing", "knowledge");
  }

  // ---- Internal sources: Files ----
  if (srcConfig.fileIds.length > 0) {
    const msg = `Fetching ${srcConfig.fileIds.length} file(s)...`;
    await updateResearchStatus(input.reportId, "searching", { phase: "files", message: msg });
    if (ch) await publishResearchProgressActivity(ch, "info", msg);

    const fileResults = await fetchFileContents(input.orgId, srcConfig.fileIds);

    for (const file of fileResults) {
      const analysis = await analyzeSource(input.query, file.content);
      const src = {
        url: `file://${file.fileId}`,
        title: file.filename,
        content: analysis.summary,
        relevance: analysis.relevance,
      };
      sources.push(src);
      if (ch) {
        await publishResearchSourceActivity(ch, { title: src.title, url: src.url, relevance: src.relevance });
        await publishResearchProgressActivity(ch, "analysis", `Analyzed: ${file.filename}`);
      }
    }

    await updateResearchStatus(input.reportId, "analyzing", {
      phase: "files",
      sourcesFromFiles: fileResults.length,
    });
    if (ch) await publishResearchStatusActivity(ch, "analyzing", "files");
  }

  // ---- Web search ----
  if (srcConfig.webSearch) {
    for (let iteration = 0; iteration < input.maxIterations; iteration++) {
      await updateResearchStatus(input.reportId, "searching", {
        phase: "web",
        iteration: iteration + 1,
        sourcesFound: sources.length,
      });
      if (ch) {
        await publishResearchStatusActivity(ch, "searching", "web");
        await publishResearchProgressActivity(ch, "query", `Web search iteration ${iteration + 1}...`);
      }

      let searchResults: { url: string; title: string }[];
      try {
        searchResults = await searchWeb(input.query, iteration);
      } catch {
        // Partial failure: web search failed but other sources may have succeeded
        if (ch) await publishResearchProgressActivity(ch, "error", `Web search iteration ${iteration + 1} failed`);
        continue;
      }

      for (const result of searchResults.slice(0, input.maxSources)) {
        let content: string;
        try {
          content = await fetchPageContent(result.url);
        } catch {
          if (ch) await publishResearchProgressActivity(ch, "error", `Failed to fetch: ${result.title}`);
          continue;
        }
        const analysis = await analyzeSource(input.query, content);

        sources.push({
          url: result.url,
          title: result.title,
          content: analysis.summary,
          relevance: analysis.relevance,
        });

        if (ch) {
          await publishResearchSourceActivity(ch, { title: result.title, url: result.url, relevance: analysis.relevance });
          await publishResearchProgressActivity(ch, "analysis", `Analyzed: ${result.title}`, { sourceUrl: result.url });
        }

        await updateResearchStatus(input.reportId, "analyzing", {
          currentSource: result.title,
          sourcesProcessed: sources.length,
        });
      }

      if (sources.length >= input.maxSources) break;
    }
  }

  if (sources.length === 0) {
    const errMsg = "No sources found. Enable web search or select internal sources with relevant content.";
    await updateResearchStatus(input.reportId, "failed", { error: errMsg });
    if (ch) await publishResearchErrorActivity(ch, errMsg);
    return;
  }

  await updateResearchStatus(input.reportId, "generating", { totalSources: sources.length });
  if (ch) {
    await publishResearchStatusActivity(ch, "generating");
    await publishResearchProgressActivity(ch, "synthesis", `Synthesizing report from ${sources.length} sources...`);
  }

  const topSources = sources.sort((a, b) => b.relevance - a.relevance).slice(0, input.maxSources);
  await generateResearchReport(input.reportId, input.query, topSources);
  await updateResearchStatus(input.reportId, "completed", { totalSources: topSources.length });
  if (ch) await publishResearchDoneActivity(ch, { reportId: input.reportId, sourcesCount: topSources.length });
}
