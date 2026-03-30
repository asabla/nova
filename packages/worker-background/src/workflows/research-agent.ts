import { proxyActivities, CancellationScope } from "@temporalio/workflow";
import type * as researchAgentActivities from "../activities/research-agent.activities";
import type * as deepResearchActivities from "../activities/deep-research.activities";
import { RETRY_POLICIES } from "@nova/shared/constants";

const { runResearchAgentLoop } =
  proxyActivities<typeof researchAgentActivities>({
    startToCloseTimeout: "30 minutes",
    heartbeatTimeout: "60 seconds",
    retry: RETRY_POLICIES.LONG_RUNNING,
  });

const { persistResearchResult } =
  proxyActivities<typeof researchAgentActivities>({
    startToCloseTimeout: "30 minutes",
    heartbeatTimeout: "60 seconds",
    retry: RETRY_POLICIES.DATABASE,
  });

const {
  updateResearchStatus,
} = proxyActivities<typeof deepResearchActivities>({
  startToCloseTimeout: "30 seconds",
  retry: RETRY_POLICIES.DATABASE,
});

const {
  publishResearchStatusActivity,
  publishResearchProgressActivity,
  publishResearchDoneActivity,
  publishResearchErrorActivity,
} = proxyActivities<typeof deepResearchActivities>({
  startToCloseTimeout: "30 seconds",
  retry: RETRY_POLICIES.PUBLISH,
});

export interface ResearchAgentWorkflowInput {
  orgId: string;
  conversationId: string;
  reportId: string;
  query: string;
  model?: string;
  maxSources: number;
  maxTurns?: number;
  streamChannelId?: string;
  sources?: {
    webSearch: boolean;
    knowledgeCollectionIds: string[];
    fileIds: string[];
  };
}

export async function researchAgentWorkflow(input: ResearchAgentWorkflowInput): Promise<void> {
  await CancellationScope.withTimeout("30 minutes", async () => {
    await researchAgentWorkflowInner(input);
  });
}

async function researchAgentWorkflowInner(input: ResearchAgentWorkflowInput): Promise<void> {
  const ch = input.streamChannelId;
  const srcConfig = input.sources ?? {
    webSearch: true,
    knowledgeCollectionIds: [],
    fileIds: [],
  };

  // Mark as searching
  await updateResearchStatus(input.reportId, "searching", { query: input.query });
  if (ch) {
    await publishResearchStatusActivity(ch, "searching");
    await publishResearchProgressActivity(ch, "query", `Researching: "${input.query}"`);
  }

  try {
    // Run the agentic research loop
    const result = await runResearchAgentLoop({
      orgId: input.orgId,
      reportId: input.reportId,
      query: input.query,
      streamChannelId: ch ?? `research:${input.reportId}`,
      model: input.model ?? "",
      maxTurns: input.maxTurns ?? 25,
      sources: srcConfig,
    });

    // Persist the assembled report to database
    await persistResearchResult(
      input.reportId,
      input.query,
      result.reportContent,
      result.sources,
      result.sections,
    );

    if (ch) {
      await publishResearchDoneActivity(ch, {
        reportId: input.reportId,
        sourcesCount: result.sources.length,
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    await updateResearchStatus(input.reportId, "failed", { error: errMsg });
    if (ch) {
      await publishResearchErrorActivity(ch, errMsg);
    }
  }
}
