import { proxyActivities, CancellationScope } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import { RETRY_POLICIES } from "@nova/shared/constants";

const {
  searchWeb,
  fetchPageContent,
  analyzeSource,
  generateResearchReport,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: RETRY_POLICIES.EXTERNAL,
});

const {
  updateResearchStatus,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: RETRY_POLICIES.DATABASE,
});

const {
  publishResearchStatusActivity,
  publishResearchSourceActivity,
  publishResearchProgressActivity,
  publishResearchDoneActivity,
  publishResearchErrorActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: RETRY_POLICIES.PUBLISH,
});

export interface ResearchRefinementInput {
  orgId: string;
  conversationId: string;
  reportId: string;
  versionId: string;
  refinementPrompt: string;
  /** Previous version's report content for context. */
  previousContent: string;
  /** Previous version's sources. */
  previousSources: { url: string; title: string; content: string; relevance: number }[];
  maxSources: number;
  streamChannelId?: string;
}

/**
 * Targeted refinement workflow.
 * Analyzes the refinement prompt against existing content to identify gaps,
 * only re-searches for gaps, and rewrites affected sections.
 */
export async function researchRefinementWorkflow(input: ResearchRefinementInput): Promise<void> {
  await CancellationScope.withTimeout("15 minutes", async () => {
    await researchRefinementInner(input);
  });
}

async function researchRefinementInner(input: ResearchRefinementInput): Promise<void> {
  const ch = input.streamChannelId;

  await updateResearchStatus(input.reportId, "searching", {
    phase: "refinement",
    refinementPrompt: input.refinementPrompt,
  });

  if (ch) {
    await publishResearchStatusActivity(ch, "searching");
    await publishResearchProgressActivity(ch, "query", `Refining: "${input.refinementPrompt}"`);
  }

  // Identify gaps: use LLM to determine what new information is needed
  const gapAnalysis = await analyzeSource(
    `Given this refinement request: "${input.refinementPrompt}"

And this existing report:
${input.previousContent.slice(0, 3000)}

What new information needs to be found? What specific queries should be searched?
Respond with a focused search query.`,
    input.previousContent,
  );

  const newSources: { url: string; title: string; content: string; relevance: number }[] = [];

  // Search for gaps only
  if (gapAnalysis.summary) {
    if (ch) await publishResearchProgressActivity(ch, "query", "Searching for additional sources...");

    try {
      const searchResults = await searchWeb(input.refinementPrompt, 0);

      for (const result of searchResults.slice(0, Math.min(5, input.maxSources))) {
        let content: string;
        try {
          content = await fetchPageContent(result.url);
        } catch {
          continue;
        }

        const analysis = await analyzeSource(input.refinementPrompt, content);
        if (analysis.relevance > 30) {
          newSources.push({
            url: result.url,
            title: result.title,
            content: analysis.summary,
            relevance: analysis.relevance,
          });

          if (ch) {
            await publishResearchSourceActivity(ch, {
              title: result.title,
              url: result.url,
              relevance: analysis.relevance,
            });
          }
        }
      }
    } catch {
      if (ch) await publishResearchProgressActivity(ch, "error", "Gap search failed, using existing sources only");
    }
  }

  // Combine previous sources with new ones
  const allSources = [...input.previousSources, ...newSources];
  const topSources = allSources.sort((a, b) => b.relevance - a.relevance).slice(0, input.maxSources);

  if (ch) {
    await publishResearchStatusActivity(ch, "generating");
    await publishResearchProgressActivity(
      ch,
      "synthesis",
      `Refining report with ${newSources.length} new source(s) (${topSources.length} total)...`,
    );
  }

  // Generate refined report — the report generation activity receives the refinement
  // prompt as additional context alongside the previous content
  await generateResearchReport(
    input.reportId,
    `${input.refinementPrompt}\n\n[Previous report for reference]:\n${input.previousContent.slice(0, 5000)}`,
    topSources,
  );

  await updateResearchStatus(input.reportId, "completed", {
    totalSources: topSources.length,
    newSources: newSources.length,
    refinement: true,
  });

  if (ch) await publishResearchDoneActivity(ch, { reportId: input.reportId, sourcesCount: topSources.length });
}
