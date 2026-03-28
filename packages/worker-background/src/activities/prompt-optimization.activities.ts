import { eq, and, desc, asc, isNull } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { resolveModelClient, getDefaultChatModel, buildChatParams } from "@nova/worker-shared/models";
import { invalidatePromptCache } from "@nova/worker-shared/prompt-resolver";
import {
  evalRuns,
  systemPrompts,
  systemPromptVersions,
  promptOptimizationRuns,
  messages,
} from "@nova/shared/schemas";

// ---------------------------------------------------------------------------
// Analyze Low-Scoring Outputs
// ---------------------------------------------------------------------------

export interface AnalyzeInput {
  orgId: string;
  systemPromptId: string;
  slug: string;
}

export interface AnalysisResult {
  patterns: string[];
  rootCauses: string[];
  suggestedChanges: string[];
  reasoning: string;
  lowScoringMessageIds: string[];
}

/**
 * Load the 20 lowest-scoring eval runs and analyze what went wrong.
 */
export async function analyzeLowScoringOutputs(input: AnalyzeInput): Promise<AnalysisResult> {
  // Get active prompt version
  const [sp] = await db
    .select({ activeVersionId: systemPrompts.activeVersionId })
    .from(systemPrompts)
    .where(eq(systemPrompts.id, input.systemPromptId))
    .limit(1);

  let currentPromptContent = "";
  if (sp?.activeVersionId) {
    const [version] = await db
      .select({ content: systemPromptVersions.content })
      .from(systemPromptVersions)
      .where(eq(systemPromptVersions.id, sp.activeVersionId))
      .limit(1);
    currentPromptContent = version?.content ?? "";
  }

  // Load 20 lowest-scoring eval runs from the last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const lowRuns = await db
    .select({
      id: evalRuns.id,
      messageId: evalRuns.messageId,
      overallScore: evalRuns.overallScore,
      scores: evalRuns.scores,
      reasoning: evalRuns.reasoning,
    })
    .from(evalRuns)
    .where(
      and(
        eq(evalRuns.orgId, input.orgId),
        eq(evalRuns.status, "completed"),
      ),
    )
    .orderBy(asc(evalRuns.overallScore))
    .limit(20);

  if (lowRuns.length === 0) {
    return {
      patterns: [],
      rootCauses: ["No eval data available"],
      suggestedChanges: [],
      reasoning: "Insufficient data for analysis",
      lowScoringMessageIds: [],
    };
  }

  // Load the corresponding messages
  const messageIds = lowRuns.map((r) => r.messageId);
  const msgs = await db
    .select({ id: messages.id, content: messages.content, senderType: messages.senderType })
    .from(messages)
    .where(
      and(
        eq(messages.orgId, input.orgId),
        isNull(messages.deletedAt),
      ),
    )
    .limit(50); // Get more to match

  const msgMap = new Map(msgs.map((m) => [m.id, m]));

  // Build examples for analysis
  const examples = lowRuns.map((run, i) => {
    const msg = msgMap.get(run.messageId);
    return `### Example ${i + 1} (Score: ${run.overallScore})
Response: ${(msg?.content ?? "").slice(0, 500)}
Eval reasoning: ${run.reasoning ?? "N/A"}
Dimension scores: ${JSON.stringify(run.scores)}`;
  }).join("\n\n");

  // Call the org's default model for analysis
  const { client, modelId } = await resolveModelClient(input.orgId);
  const params = await buildChatParams(modelId, {
    model: modelId,
    messages: [
      {
        role: "system",
        content: "You are an expert prompt engineer analyzing why an AI system prompt is producing low-quality outputs. Your job is to identify patterns and root causes.",
      },
      {
        role: "user",
        content: `Here is the current system prompt:

\`\`\`
${currentPromptContent.slice(0, 4000)}
\`\`\`

Below are 20 examples of low-scoring outputs produced by this prompt, along with their evaluation scores and reasoning:

${examples}

Analyze the patterns. What's going wrong? Respond with ONLY valid JSON:
{
  "patterns": ["pattern 1", "pattern 2", ...],
  "rootCauses": ["root cause 1", "root cause 2", ...],
  "suggestedChanges": ["change 1", "change 2", ...],
  "reasoning": "Overall analysis summary"
}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const response = await client.chat.completions.create(params as any);
  const content = (response as any).choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content);
    return {
      patterns: parsed.patterns ?? [],
      rootCauses: parsed.rootCauses ?? [],
      suggestedChanges: parsed.suggestedChanges ?? [],
      reasoning: parsed.reasoning ?? "",
      lowScoringMessageIds: messageIds,
    };
  } catch {
    return {
      patterns: [],
      rootCauses: ["Analysis parse failure"],
      suggestedChanges: [],
      reasoning: content.slice(0, 500),
      lowScoringMessageIds: messageIds,
    };
  }
}

// ---------------------------------------------------------------------------
// Generate Improved Prompt
// ---------------------------------------------------------------------------

export interface GeneratePromptInput {
  orgId: string;
  systemPromptId: string;
  slug: string;
  analysis: AnalysisResult;
}

/**
 * Generate an improved version of the system prompt based on analysis.
 */
export async function generateImprovedPrompt(input: GeneratePromptInput): Promise<{
  versionId: string;
  content: string;
}> {
  // Get current active prompt content
  const [sp] = await db
    .select({ activeVersionId: systemPrompts.activeVersionId })
    .from(systemPrompts)
    .where(eq(systemPrompts.id, input.systemPromptId))
    .limit(1);

  let currentContent = "";
  let currentVersion = 0;
  if (sp?.activeVersionId) {
    const [version] = await db
      .select({ content: systemPromptVersions.content, version: systemPromptVersions.version })
      .from(systemPromptVersions)
      .where(eq(systemPromptVersions.id, sp.activeVersionId))
      .limit(1);
    currentContent = version?.content ?? "";
    currentVersion = version?.version ?? 0;
  }

  const { client, modelId } = await resolveModelClient(input.orgId);
  const params = await buildChatParams(modelId, {
    model: modelId,
    messages: [
      {
        role: "system",
        content: "You are an expert prompt engineer. Your task is to improve a system prompt based on analysis of its failures. Output ONLY the improved prompt text, nothing else.",
      },
      {
        role: "user",
        content: `Current system prompt:

\`\`\`
${currentContent}
\`\`\`

Analysis of failures:
- Patterns: ${input.analysis.patterns.join("; ")}
- Root causes: ${input.analysis.rootCauses.join("; ")}
- Suggested changes: ${input.analysis.suggestedChanges.join("; ")}
- Reasoning: ${input.analysis.reasoning}

Generate an improved version of this system prompt that addresses the identified issues. Preserve the core intent and structure while making targeted improvements. Output ONLY the improved prompt text.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const response = await client.chat.completions.create(params as any);
  const newContent = (response as any).choices?.[0]?.message?.content ?? "";

  // Create new version
  const [newVersion] = await db
    .insert(systemPromptVersions)
    .values({
      systemPromptId: input.systemPromptId,
      orgId: input.orgId,
      version: currentVersion + 1,
      content: newContent,
      generatedBy: "auto_optimization",
      generationContext: {
        patterns: input.analysis.patterns,
        rootCauses: input.analysis.rootCauses,
        suggestedChanges: input.analysis.suggestedChanges,
        reasoning: input.analysis.reasoning,
      },
      status: "draft",
      trafficPct: 0,
    })
    .returning({ id: systemPromptVersions.id });

  return { versionId: newVersion.id, content: newContent };
}

// ---------------------------------------------------------------------------
// Create Optimization Run Record
// ---------------------------------------------------------------------------

export interface CreateOptimizationRunInput {
  orgId: string;
  systemPromptId: string;
  slug: string;
  triggerReason: string;
  triggerData: Record<string, unknown>;
  analysis: AnalysisResult;
  proposedVersionId: string;
  model: string;
}

export async function createOptimizationRun(input: CreateOptimizationRunInput): Promise<string> {
  const [run] = await db
    .insert(promptOptimizationRuns)
    .values({
      orgId: input.orgId,
      systemPromptId: input.systemPromptId,
      triggerReason: input.triggerReason,
      triggerData: input.triggerData,
      lowScoringMessageIds: input.analysis.lowScoringMessageIds,
      analysisReasoning: input.analysis.reasoning,
      proposedVersionId: input.proposedVersionId,
      status: "awaiting_approval",
      model: input.model,
    })
    .returning({ id: promptOptimizationRuns.id });

  return run.id;
}

// ---------------------------------------------------------------------------
// Resolve System Prompt ID
// ---------------------------------------------------------------------------

export async function resolveSystemPromptId(orgId: string, slug: string): Promise<string | null> {
  const [sp] = await db
    .select({ id: systemPrompts.id })
    .from(systemPrompts)
    .where(and(eq(systemPrompts.orgId, orgId), eq(systemPrompts.slug, slug), isNull(systemPrompts.deletedAt)))
    .limit(1);
  return sp?.id ?? null;
}
