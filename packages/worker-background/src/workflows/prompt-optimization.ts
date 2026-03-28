import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

const {
  analyzeLowScoringOutputs,
  generateImprovedPrompt,
  createOptimizationRun,
  resolveSystemPromptId,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 2 },
});

export interface PromptOptimizationInput {
  orgId: string;
  slug: string;
  triggerReason: "score_below_threshold" | "negative_feedback_spike" | "manual";
  triggerData: Record<string, unknown>;
}

/**
 * Self-improving prompt optimization workflow.
 *
 * 1. Analyze: Load low-scoring eval runs and identify patterns
 * 2. Generate: Create an improved version of the system prompt
 * 3. Notify: Create an optimization run record for admin review
 *
 * The generated prompt version starts as "draft" and requires admin approval
 * before going to A/B testing or deployment.
 */
export async function promptOptimizationWorkflow(input: PromptOptimizationInput): Promise<{
  optimizationRunId: string | null;
  proposedVersionId: string | null;
}> {
  // Resolve the system prompt ID
  const systemPromptId = await resolveSystemPromptId(input.orgId, input.slug);
  if (!systemPromptId) {
    return { optimizationRunId: null, proposedVersionId: null };
  }

  // Step 1: Analyze
  const analysis = await analyzeLowScoringOutputs({
    orgId: input.orgId,
    systemPromptId,
    slug: input.slug,
  });

  if (analysis.patterns.length === 0 && analysis.rootCauses.length <= 1) {
    return { optimizationRunId: null, proposedVersionId: null };
  }

  // Step 2: Generate improved prompt
  const { versionId, content } = await generateImprovedPrompt({
    orgId: input.orgId,
    systemPromptId,
    slug: input.slug,
    analysis,
  });

  // Step 3: Create optimization run record for admin review
  const optimizationRunId = await createOptimizationRun({
    orgId: input.orgId,
    systemPromptId,
    slug: input.slug,
    triggerReason: input.triggerReason,
    triggerData: input.triggerData,
    analysis,
    proposedVersionId: versionId,
    model: "default",
  });

  return { optimizationRunId, proposedVersionId: versionId };
}
