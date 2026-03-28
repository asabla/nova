import { proxyActivities, startChild } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  enqueueEval,
  runEval,
  checkOptimizationTrigger,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: { maximumAttempts: 2 },
});

export interface EvalWorkflowInput {
  orgId: string;
  messageId: string;
  conversationId: string;
  evalType: "chat" | "planning" | "research";
  executionTier?: string;
  promptVersionId?: string;
}

/**
 * Evaluate a single assistant message asynchronously.
 * Triggered after message completion or on thumbs-down rating.
 */
export async function evalWorkflow(input: EvalWorkflowInput): Promise<{
  evalRunId: string | null;
  optimizationSlug: string | null;
}> {
  // Step 1: Create the eval run
  const evalRunId = await enqueueEval({
    orgId: input.orgId,
    messageId: input.messageId,
    conversationId: input.conversationId,
    evalType: input.evalType,
    executionTier: input.executionTier,
    promptVersionId: input.promptVersionId,
  });

  if (!evalRunId) {
    return { evalRunId: null, optimizationSlug: null };
  }

  // Step 2: Run the LLM-as-judge evaluation
  await runEval({ orgId: input.orgId, evalRunId });

  // Step 3: Check if optimization should be triggered
  const optimizationSlug = await checkOptimizationTrigger({
    orgId: input.orgId,
    evalType: input.evalType,
  });

  // Step 4: If optimization needed, dispatch it (fire-and-forget)
  if (optimizationSlug) {
    try {
      await startChild("promptOptimizationWorkflow", {
        workflowId: `prompt-opt-${input.orgId}-${optimizationSlug}-${Date.now()}`,
        args: [{
          orgId: input.orgId,
          slug: optimizationSlug,
          triggerReason: "score_below_threshold",
          triggerData: { evalType: input.evalType, evalRunId },
        }],
      });
    } catch {
      // Non-critical
    }
  }

  return { evalRunId, optimizationSlug };
}
