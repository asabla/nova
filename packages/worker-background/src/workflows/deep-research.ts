import {
  proxyActivities,
  CancellationScope,
  defineSignal,
  setHandler,
  condition,
} from "@temporalio/workflow";
import type * as activities from "../activities";
import type { UserInteractionResponse } from "@nova/shared/types";

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

const {
  publishInteractionRequestActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 2 },
});

// --- Signals ---

export const cancelResearchSignal = defineSignal("cancel");
export const interactionResponseSignal = defineSignal<[UserInteractionResponse]>("userInteractionResponse");

// --- Types ---

export interface DeepResearchInput {
  orgId: string;
  conversationId: string;
  reportId: string;
  query: string;
  maxSources: number;
  maxIterations: number;
  streamChannelId?: string;
  /** Enable interactive checkpoints (user can guide the research). */
  interactive?: boolean;
  sources?: {
    webSearch: boolean;
    knowledgeCollectionIds: string[];
    fileIds: string[];
  };
}

export async function deepResearchWorkflow(input: DeepResearchInput): Promise<void> {
  await CancellationScope.withTimeout("30 minutes", async () => {
    await deepResearchWorkflowInner(input);
  });
}

async function deepResearchWorkflowInner(input: DeepResearchInput): Promise<void> {
  let cancelled = false;
  const interactionResponses = new Map<string, UserInteractionResponse>();

  setHandler(cancelResearchSignal, () => { cancelled = true; });
  setHandler(interactionResponseSignal, (response) => {
    interactionResponses.set(response.requestId, response);
  });

  const srcConfig = input.sources ?? { webSearch: true, knowledgeCollectionIds: [], fileIds: [] };
  const ch = input.streamChannelId;
  const interactive = input.interactive ?? false;

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
      if (cancelled) break;

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

  if (cancelled) return;

  if (sources.length === 0) {
    const errMsg = "No sources found. Enable web search or select internal sources with relevant content.";
    await updateResearchStatus(input.reportId, "failed", { error: errMsg });
    if (ch) await publishResearchErrorActivity(ch, errMsg);
    return;
  }

  // ---- CHECKPOINT 1: After source discovery ----
  // Ask user which angles/sources to focus on
  if (interactive && ch && sources.length > 3) {
    const topAngles = sources
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5)
      .map((s, i) => ({
        id: `source-${i}`,
        label: s.title,
        description: `Relevance: ${s.relevance.toFixed(0)}%`,
      }));

    const checkpointId = `checkpoint-sources-${input.reportId}`;
    await publishInteractionRequestActivity(ch, {
      id: checkpointId,
      type: "option_selection",
      prompt: `Found ${sources.length} sources. Which areas should the report focus on? (Select one, or wait for auto-continue)`,
      options: [
        { id: "all", label: "All sources", description: "Use all discovered sources" },
        ...topAngles,
      ],
      timeoutMs: 120_000, // 2 minutes
    });

    // Wait for response or timeout (auto-continue with all sources)
    const gotResponse = await condition(
      () => interactionResponses.has(checkpointId) || cancelled,
      "2 minutes",
    );

    if (cancelled) return;

    if (gotResponse && interactionResponses.has(checkpointId)) {
      const response = interactionResponses.get(checkpointId)!;
      if (response.selectedOptionId && response.selectedOptionId !== "all") {
        // Filter to selected source's topic
        const selectedIdx = parseInt(response.selectedOptionId.replace("source-", ""), 10);
        if (!isNaN(selectedIdx) && selectedIdx < sources.length) {
          if (ch) await publishResearchProgressActivity(ch, "info", `Focusing on: ${sources[selectedIdx].title}`);
        }
      }
    }
  }

  // ---- CHECKPOINT 2: Before report generation ----
  // Ask user to approve or adjust before generating
  if (interactive && ch) {
    const checkpointId = `checkpoint-generate-${input.reportId}`;
    await publishInteractionRequestActivity(ch, {
      id: checkpointId,
      type: "approval_gate",
      prompt: `Ready to generate report from ${sources.length} sources. Proceed?`,
      timeoutMs: 60_000, // 1 minute
    });

    const gotApproval = await condition(
      () => interactionResponses.has(checkpointId) || cancelled,
      "1 minute",
    );

    if (cancelled) return;

    if (gotApproval && interactionResponses.has(checkpointId)) {
      const response = interactionResponses.get(checkpointId)!;
      if (response.approved === false) {
        await updateResearchStatus(input.reportId, "cancelled", { reason: "User rejected report generation" });
        if (ch) await publishResearchErrorActivity(ch, "Report generation cancelled by user");
        return;
      }
    }
    // If no response within timeout, auto-proceed
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
