import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  searchWeb,
  fetchPageContent,
  analyzeSource,
  generateResearchReport,
  updateResearchStatus,
  queryKnowledgeCollections,
  fetchFileContents,
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
  sources?: {
    webSearch: boolean;
    knowledgeCollectionIds: string[];
    fileIds: string[];
  };
}

export async function deepResearchWorkflow(input: DeepResearchInput): Promise<void> {
  const srcConfig = input.sources ?? { webSearch: true, knowledgeCollectionIds: [], fileIds: [] };

  await updateResearchStatus(input.reportId, "searching", { query: input.query });

  const sources: { url: string; title: string; content: string; relevance: number }[] = [];

  // ---- Internal sources: Knowledge collections ----
  if (srcConfig.knowledgeCollectionIds.length > 0) {
    await updateResearchStatus(input.reportId, "searching", {
      phase: "knowledge",
      message: `Querying ${srcConfig.knowledgeCollectionIds.length} knowledge collection(s)...`,
    });

    const knowledgeResults = await queryKnowledgeCollections(
      input.orgId,
      srcConfig.knowledgeCollectionIds,
      input.query,
      Math.min(10, input.maxSources),
    );

    for (const chunk of knowledgeResults) {
      sources.push({
        url: `knowledge://${chunk.collectionId}/${chunk.documentId}`,
        title: chunk.documentName || "Knowledge document",
        content: chunk.content,
        relevance: chunk.score * 100,
      });
    }

    await updateResearchStatus(input.reportId, "analyzing", {
      phase: "knowledge",
      sourcesFromKnowledge: knowledgeResults.length,
    });
  }

  // ---- Internal sources: Files ----
  if (srcConfig.fileIds.length > 0) {
    await updateResearchStatus(input.reportId, "searching", {
      phase: "files",
      message: `Fetching ${srcConfig.fileIds.length} file(s)...`,
    });

    const fileResults = await fetchFileContents(input.orgId, srcConfig.fileIds);

    for (const file of fileResults) {
      const analysis = await analyzeSource(input.query, file.content);
      sources.push({
        url: `file://${file.fileId}`,
        title: file.filename,
        content: analysis.summary,
        relevance: analysis.relevance,
      });
    }

    await updateResearchStatus(input.reportId, "analyzing", {
      phase: "files",
      sourcesFromFiles: fileResults.length,
    });
  }

  // ---- Web search ----
  if (srcConfig.webSearch) {
    for (let iteration = 0; iteration < input.maxIterations; iteration++) {
      await updateResearchStatus(input.reportId, "searching", {
        phase: "web",
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
  }

  if (sources.length === 0) {
    await updateResearchStatus(input.reportId, "failed", {
      error: "No sources found. Enable web search or select internal sources with relevant content.",
    });
    return;
  }

  await updateResearchStatus(input.reportId, "generating", {
    totalSources: sources.length,
  });

  const topSources = sources.sort((a, b) => b.relevance - a.relevance).slice(0, input.maxSources);
  await generateResearchReport(input.reportId, input.query, topSources);
  await updateResearchStatus(input.reportId, "completed", { totalSources: topSources.length });
}
