import { eq, and, desc, sql, gte, isNull, count, avg } from "drizzle-orm";
import { db } from "@nova/worker-shared/db";
import { resolveModelClient, getDefaultChatModel, buildChatParams } from "@nova/worker-shared/models";
import { resolveSystemPrompt } from "@nova/worker-shared/prompt-resolver";
import {
  evalRuns,
  evalDimensions,
  evalAggregates,
  systemPromptVersions,
  promptOptimizationRuns,
  systemPrompts,
  messages,
  messageRatings,
  conversations,
  orgSettings,
  organisations,
} from "@nova/shared/schemas";

// ---------------------------------------------------------------------------
// Eval settings helpers
// ---------------------------------------------------------------------------

async function getOrgEvalSetting(orgId: string, key: string, defaultValue: string): Promise<string> {
  const rows = await db
    .select({ value: orgSettings.value })
    .from(orgSettings)
    .where(and(eq(orgSettings.orgId, orgId), eq(orgSettings.key, key)))
    .limit(1);
  return rows[0]?.value ?? defaultValue;
}

// ---------------------------------------------------------------------------
// Enqueue Eval
// ---------------------------------------------------------------------------

export interface EnqueueEvalInput {
  orgId: string;
  messageId: string;
  conversationId: string;
  evalType: "chat" | "planning" | "research";
  executionTier?: string;
  promptVersionId?: string;
}

/**
 * Create an eval run entry with status="pending".
 * Returns the eval run ID, or null if eval is disabled or skipped by sampling.
 */
export async function enqueueEval(input: EnqueueEvalInput): Promise<string | null> {
  const enabled = await getOrgEvalSetting(input.orgId, "eval_enabled", "true");
  if (enabled !== "true") return null;

  const [row] = await db
    .insert(evalRuns)
    .values({
      orgId: input.orgId,
      messageId: input.messageId,
      conversationId: input.conversationId,
      evalType: input.evalType,
      executionTier: input.executionTier,
      promptVersionId: input.promptVersionId,
      status: "pending",
    })
    .returning({ id: evalRuns.id });

  return row?.id ?? null;
}

// ---------------------------------------------------------------------------
// Run Eval (LLM-as-judge)
// ---------------------------------------------------------------------------

export interface RunEvalInput {
  orgId: string;
  evalRunId: string;
}

/**
 * Execute the LLM-as-judge evaluation for a single eval run.
 */
export async function runEval(input: RunEvalInput): Promise<void> {
  const startMs = Date.now();

  // Load the eval run
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.id, input.evalRunId))
    .limit(1);
  if (!run || run.status !== "pending") return;

  // Load the message being evaluated
  const [message] = await db
    .select({
      content: messages.content,
      conversationId: messages.conversationId,
      metadata: messages.metadata,
    })
    .from(messages)
    .where(eq(messages.id, run.messageId))
    .limit(1);
  if (!message?.content) {
    await db.update(evalRuns).set({ status: "failed", reasoning: "Message not found or empty" }).where(eq(evalRuns.id, input.evalRunId));
    return;
  }

  // Load last 3 conversation turns for context
  const contextMessages = await db
    .select({ role: messages.senderType, content: messages.content })
    .from(messages)
    .where(and(eq(messages.conversationId, run.conversationId), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(6);

  const conversationContext = contextMessages
    .reverse()
    .map((m) => `${m.role}: ${(m.content ?? "").slice(0, 500)}`)
    .join("\n");

  // Load any user rating
  const [rating] = await db
    .select({ rating: messageRatings.rating, feedback: messageRatings.feedback })
    .from(messageRatings)
    .where(eq(messageRatings.messageId, run.messageId))
    .limit(1);

  // Load active eval dimensions for this eval type
  const dimensions = await db
    .select()
    .from(evalDimensions)
    .where(
      and(
        eq(evalDimensions.orgId, run.orgId),
        eq(evalDimensions.evalType, run.evalType),
        eq(evalDimensions.isEnabled, true),
        isNull(evalDimensions.deletedAt),
      ),
    );

  if (dimensions.length === 0) {
    await db.update(evalRuns).set({ status: "failed", reasoning: "No eval dimensions configured" }).where(eq(evalRuns.id, input.evalRunId));
    return;
  }

  // Build the dimension rubric
  const dimensionRubric = dimensions
    .map((d) => `- ${d.name} (weight: ${d.weight}): ${d.description}`)
    .join("\n");

  // Resolve the judge prompt
  const judgeSlug = `eval_judge_${run.evalType}`;
  const resolved = await resolveSystemPrompt(run.orgId, judgeSlug);
  const judgeBasePrompt = resolved.content || buildDefaultJudgePrompt(run.evalType);

  // Build the full judge prompt
  const metadata = message.metadata as Record<string, any> | null;
  const judgePrompt = `${judgeBasePrompt}

## Scoring Dimensions
${dimensionRubric}

## Context
- Execution tier: ${run.executionTier ?? "unknown"}
- Effort level: ${metadata?.effortLevel ?? "unknown"}
${rating ? `- User rating: thumbs ${rating.rating === 1 ? "up" : "down"}${rating.feedback ? `, feedback: "${rating.feedback}"` : ""}` : ""}

## Conversation Context (last 3 turns)
${conversationContext}

## Assistant Response to Evaluate
${message.content.slice(0, 8000)}

Score each dimension from 0.0 to 1.0. Respond with ONLY valid JSON:
{
  "scores": { ${dimensions.map((d) => `"${d.name}": 0.0`).join(", ")} },
  "overall": 0.0,
  "reasoning": "Brief explanation of strengths and weaknesses"
}`;

  // Call the org's default model
  try {
    const { client, modelId } = await resolveModelClient(run.orgId);
    const params = await buildChatParams(modelId, {
      model: modelId,
      messages: [
        { role: "system", content: "You are an expert quality evaluator for an AI chat platform. Score responses objectively and consistently." },
        { role: "user", content: judgePrompt },
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const response = await client.chat.completions.create(params as any);
    const content = (response as any).choices?.[0]?.message?.content ?? "";
    const usage = (response as any).usage;

    // Parse the judge's response
    const parsed = JSON.parse(content);
    const scores = parsed.scores as Record<string, number>;

    // Compute weighted overall score
    let weightedSum = 0;
    let totalWeight = 0;
    for (const dim of dimensions) {
      const score = scores[dim.name];
      if (typeof score === "number") {
        const w = parseFloat(String(dim.weight));
        weightedSum += score * w;
        totalWeight += w;
      }
    }
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : parsed.overall ?? 0;

    const durationMs = Date.now() - startMs;

    await db
      .update(evalRuns)
      .set({
        scores,
        overallScore: String(Math.round(overallScore * 10000) / 10000),
        reasoning: parsed.reasoning ?? "",
        judgeModel: modelId,
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        costCents: 0, // Cost calculated separately based on model pricing
        durationMs,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(evalRuns.id, input.evalRunId));

    // Update the prompt version's rolling eval stats
    if (run.promptVersionId) {
      await db
        .update(systemPromptVersions)
        .set({
          evalCount: sql`${systemPromptVersions.evalCount} + 1`,
          avgScore: sql`CASE
            WHEN ${systemPromptVersions.evalCount} = 0 THEN ${String(overallScore)}::numeric
            ELSE (${systemPromptVersions.avgScore} * ${systemPromptVersions.evalCount} + ${String(overallScore)}::numeric) / (${systemPromptVersions.evalCount} + 1)
          END`,
          updatedAt: new Date(),
        })
        .where(eq(systemPromptVersions.id, run.promptVersionId));
    }
  } catch (err: any) {
    await db
      .update(evalRuns)
      .set({
        status: "failed",
        reasoning: `Judge call failed: ${err.message?.slice(0, 500)}`,
        durationMs: Date.now() - startMs,
        updatedAt: new Date(),
      })
      .where(eq(evalRuns.id, input.evalRunId));
  }
}

function buildDefaultJudgePrompt(evalType: string): string {
  switch (evalType) {
    case "chat":
      return "Evaluate the following AI assistant response for quality in a conversational context.";
    case "planning":
      return "Evaluate the following execution plan generated by an AI task planner. Consider whether the tier classification was correct and the plan is well-structured.";
    case "research":
      return "Evaluate the following research report generated by an AI research agent. Consider thoroughness, accuracy, analytical depth, and structure.";
    default:
      return "Evaluate the following AI-generated content for quality.";
  }
}

// ---------------------------------------------------------------------------
// Check Optimization Trigger
// ---------------------------------------------------------------------------

export interface CheckOptimizationInput {
  orgId: string;
  evalType: "chat" | "planning" | "research";
}

/**
 * Check if quality has degraded enough to trigger prompt optimization.
 * Returns the system prompt slug to optimize, or null if no action needed.
 */
export async function checkOptimizationTrigger(input: CheckOptimizationInput): Promise<string | null> {
  const autoOptimize = await getOrgEvalSetting(input.orgId, "eval_auto_optimize", "false");
  if (autoOptimize !== "true") return null;

  const thresholdKey = `eval_score_threshold_${input.evalType}`;
  const defaultThreshold = input.evalType === "chat" ? "0.65" : "0.70";
  const threshold = parseFloat(await getOrgEvalSetting(input.orgId, thresholdKey, defaultThreshold));

  const cooldownHours = parseInt(await getOrgEvalSetting(input.orgId, "eval_optimization_cooldown_hours", "168"), 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Check 7-day rolling average score
  const [avgResult] = await db
    .select({ avgScore: avg(evalRuns.overallScore) })
    .from(evalRuns)
    .where(
      and(
        eq(evalRuns.orgId, input.orgId),
        eq(evalRuns.evalType, input.evalType),
        eq(evalRuns.status, "completed"),
        gte(evalRuns.createdAt, sevenDaysAgo),
      ),
    );

  const currentAvg = parseFloat(String(avgResult?.avgScore ?? "1"));
  if (currentAvg >= threshold) return null;

  // Map eval type to the primary prompt slug
  const slugMap: Record<string, string> = {
    chat: "formatting",
    planning: "tier_assessment",
    research: "research",
  };
  const slug = slugMap[input.evalType] ?? input.evalType;

  // Check cooldown: was there a recent optimization for this prompt?
  const [sp] = await db
    .select({ id: systemPrompts.id })
    .from(systemPrompts)
    .where(and(eq(systemPrompts.orgId, input.orgId), eq(systemPrompts.slug, slug)))
    .limit(1);

  if (sp) {
    const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
    const [recent] = await db
      .select({ id: promptOptimizationRuns.id })
      .from(promptOptimizationRuns)
      .where(
        and(
          eq(promptOptimizationRuns.orgId, input.orgId),
          eq(promptOptimizationRuns.systemPromptId, sp.id),
          gte(promptOptimizationRuns.createdAt, cooldownCutoff),
        ),
      )
      .limit(1);

    if (recent) return null; // Still in cooldown
  }

  return slug;
}

// ---------------------------------------------------------------------------
// Compute Aggregates
// ---------------------------------------------------------------------------

export interface ComputeAggregatesInput {
  orgId: string;
}

/**
 * Compute daily eval aggregates for the given org.
 */
export async function computeAggregates(input: ComputeAggregatesInput): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const evalTypes = ["chat", "planning", "research"] as const;

  for (const evalType of evalTypes) {
    // Get completed evals for today
    const evals = await db
      .select({
        overallScore: evalRuns.overallScore,
        promptVersionId: evalRuns.promptVersionId,
      })
      .from(evalRuns)
      .where(
        and(
          eq(evalRuns.orgId, input.orgId),
          eq(evalRuns.evalType, evalType),
          eq(evalRuns.status, "completed"),
          gte(evalRuns.createdAt, today),
        ),
      );

    if (evals.length === 0) continue;

    // Compute aggregate
    const scores = evals.map((e) => parseFloat(String(e.overallScore ?? "0")));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    const medianScore = sorted[Math.floor(sorted.length / 2)];

    // Count thumbs up/down for the same period
    const [thumbs] = await db
      .select({
        up: sql<number>`count(*) filter (where ${messageRatings.rating} = 1)`,
        down: sql<number>`count(*) filter (where ${messageRatings.rating} = -1)`,
      })
      .from(messageRatings)
      .where(
        and(
          eq(messageRatings.orgId, input.orgId),
          gte(messageRatings.createdAt, today),
        ),
      );

    // Upsert the aggregate
    await db
      .insert(evalAggregates)
      .values({
        orgId: input.orgId,
        evalType,
        period: "day",
        periodStart: today,
        avgScore: String(Math.round(avgScore * 10000) / 10000),
        medianScore: String(Math.round(medianScore * 10000) / 10000),
        evalCount: evals.length,
        thumbsUpCount: thumbs?.up ?? 0,
        thumbsDownCount: thumbs?.down ?? 0,
      })
      .onConflictDoUpdate({
        target: [evalAggregates.orgId, evalAggregates.evalType, evalAggregates.period, evalAggregates.periodStart],
        set: {
          avgScore: String(Math.round(avgScore * 10000) / 10000),
          medianScore: String(Math.round(medianScore * 10000) / 10000),
          evalCount: evals.length,
          thumbsUpCount: thumbs?.up ?? 0,
          thumbsDownCount: thumbs?.down ?? 0,
        },
      });
  }
}

// ---------------------------------------------------------------------------
// Get Orgs With Evals Enabled
// ---------------------------------------------------------------------------

/**
 * Returns org IDs that have evals enabled (or all orgs if no setting exists).
 */
export async function getOrgsWithEvalsEnabled(): Promise<string[]> {
  // Find orgs that have explicitly enabled evals, or all orgs (default is enabled)
  const orgs = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(isNull(organisations.deletedAt));

  const result: string[] = [];
  for (const org of orgs) {
    const enabled = await getOrgEvalSetting(org.id, "eval_enabled", "true");
    if (enabled === "true") result.push(org.id);
  }
  return result;
}
