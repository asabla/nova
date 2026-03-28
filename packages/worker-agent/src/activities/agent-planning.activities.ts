import { openai } from "@nova/worker-shared/litellm";
import { buildChatParams } from "@nova/worker-shared/models";
import { resolveSystemPrompt } from "@nova/worker-shared/prompt-resolver";
import type {
  ExecutionTier,
  EffortLevel,
  TierAssessment,
  Plan,
  PlanNode,
} from "@nova/shared/types";

// Planning tasks (tier assessment, DAG generation) use the conversation's own model
// with lightweight overrides (low temperature, small token budget).
// An explicit env var or LiteLLM "planning-model" alias can still override this
// for deployments that want a dedicated cheaper/faster model.
const PLANNING_MODEL_OVERRIDE = process.env.NOVA_PLANNING_MODEL;

const TIER_ASSESSMENT_FALLBACK = `You are a task complexity router. Classify the user's request into one of three execution tiers and suggest an appropriate effort level.

Tiers:
- "direct": Single-turn response. Greetings, factual Q&A, casual conversation, simple follow-ups to a prior answer, requests to reformat/summarize/visualize data that is already in the conversation. No tools needed — the LLM can answer from its context.
- "sequential": Needs 2-4 steps executed in order. Document lookup, single web search, one tool call with follow-up reasoning. A flat step-by-step plan suffices.
- "orchestrated": Needs 4+ steps, multiple tools, parallel work, or multi-source synthesis. Research across sources, code execution + artifact creation, tasks with independent sub-problems that can run in parallel.

IMPORTANT: If conversation context is provided, consider whether the user's message is a follow-up to prior messages. Follow-ups that build on existing conversation content (e.g. "now create a diagram of that", "summarize the above", "can you also...") are almost always "direct" — the information is already in context.

Effort levels:
- "low": Quick, concise response. Minimal reasoning.
- "medium": Thoughtful response with moderate reasoning.
- "high": Deep analysis, extended reasoning, thorough exploration.

Respond with ONLY valid JSON:
{"tier": "direct"|"sequential"|"orchestrated", "confidence": 0.0-1.0, "reasoning": "one sentence why", "suggestedEffort": "low"|"medium"|"high"}`;

const DAG_PLANNING_FALLBACK = `You are a task planner. Given a user request and available tools, create an execution plan as a directed acyclic graph (DAG).

Respond with ONLY valid JSON:
{
  "reasoning": "Brief explanation of your approach",
  "nodes": [
    {
      "id": "step-1",
      "description": "What to do in this step",
      "tools": ["tool_name"],
      "dependencies": []
    },
    {
      "id": "step-2",
      "description": "Next step",
      "tools": ["tool_name"],
      "dependencies": ["step-1"]
    }
  ]
}

Rules:
- Use IDs like "step-1", "step-2", etc.
- "dependencies" is an array of step IDs that must complete before this step can start.
- The first step(s) always have "dependencies": [].
- Keep plans concise: 2-8 nodes maximum.
- Only reference tools from the available list.
- Every node must be reachable from a root node (no cycles).
- If prior conversation context is provided, do NOT plan steps for work already completed. Only plan NEW work needed.`;

// ---------------------------------------------------------------------------
// Tier Assessment
// ---------------------------------------------------------------------------

export interface AssessTierInput {
  userMessage: string;
  model: string;
  /** Optional context (e.g. conversation history summary) for better classification. */
  context?: string;
  /** Org ID — used to resolve org-specific system prompts from DB. */
  orgId?: string;
}

/**
 * Classify a user message into an execution tier.
 * Single lightweight LLM call with temperature 0 for deterministic output.
 */
export async function assessTier(input: AssessTierInput): Promise<TierAssessment & { promptVersionId?: string }> {
  const model = PLANNING_MODEL_OVERRIDE ?? input.model;

  // Resolve tier assessment prompt from DB (falls back to hardcoded default)
  const resolved = input.orgId
    ? await resolveSystemPrompt(input.orgId, "tier_assessment")
    : null;
  const tierPromptContent = resolved?.content || TIER_ASSESSMENT_FALLBACK;
  const promptVersionId = resolved?.versionId;

  const params = await buildChatParams(model, {
    model,
    messages: [
      {
        role: "system",
        content: tierPromptContent,
      },
      ...(input.context
        ? [{ role: "system" as const, content: `Conversation context: ${input.context}` }]
        : []),
      { role: "user" as const, content: input.userMessage },
    ],
    temperature: 0,
  });
  const response = await openai.chat.completions.create(params as any);

  const content = (response as any).choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content);
    return {
      tier: validateTier(parsed.tier),
      confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
      reasoning: parsed.reasoning ?? "",
      suggestedEffort: validateEffort(parsed.suggestedEffort),
      promptVersionId,
    };
  } catch {
    return { tier: "direct", confidence: 0.5, reasoning: "Parse failure, defaulting to direct", suggestedEffort: "low", promptVersionId };
  }
}

function validateTier(value: unknown): ExecutionTier {
  if (value === "direct" || value === "sequential" || value === "orchestrated") return value;
  return "direct";
}

function validateEffort(value: unknown): EffortLevel {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

// ---------------------------------------------------------------------------
// DAG Plan Generation
// ---------------------------------------------------------------------------

export interface GenerateDAGPlanInput {
  systemPrompt: string;
  userMessage: string;
  availableTools: { name: string; description: string }[];
  model: string;
  tier: ExecutionTier;
  /** Summary of prior conversation turns so the planner knows what was already done. */
  conversationContext?: string;
  /** Org ID — used to resolve org-specific DAG planning prompt from DB. */
  orgId?: string;
}

/**
 * Generate a DAG-based execution plan.
 *
 * For "sequential" tier: produces a linear chain (each node depends on the previous).
 * For "orchestrated" tier: produces a DAG with parallel branches where appropriate.
 */
export async function generateDAGPlan(input: GenerateDAGPlanInput): Promise<Plan> {
  const toolList = input.availableTools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const parallelInstructions =
    input.tier === "orchestrated"
      ? `\n- Identify steps that can run in parallel (no data dependency between them) and give them NO dependency on each other.
- Steps that need results from earlier steps must list those step IDs in "dependencies".
- Aim for maximum parallelism while respecting true data dependencies.`
      : `\n- This is a sequential plan. Each step should depend on the previous one (e.g. step-2 depends on step-1).`;

  // Resolve DAG planning prompt from DB (falls back to hardcoded default)
  const resolvedDag = input.orgId
    ? await resolveSystemPrompt(input.orgId, "dag_planning")
    : null;
  const dagBasePrompt = resolvedDag?.content || DAG_PLANNING_FALLBACK;

  const planModel = PLANNING_MODEL_OVERRIDE ?? input.model;
  const planParams = await buildChatParams(planModel, {
    model: planModel,
    messages: [
      {
        role: "system",
        content: `${dagBasePrompt}

Available tools:
${toolList}

${input.systemPrompt ? `Agent context: ${input.systemPrompt}` : ""}
${parallelInstructions}`,
      },
      ...(input.conversationContext
        ? [{
            role: "system" as const,
            content: `Prior conversation context (already completed — do NOT re-do these):\n${input.conversationContext}`,
          }]
        : []),
      { role: "user", content: input.userMessage },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });
  const response = await openai.chat.completions.create(planParams as any);

  const content = (response as any).choices?.[0]?.message?.content ?? "";
  const planId = `plan-${Date.now()}`;

  try {
    const parsed = JSON.parse(content);
    const nodes: PlanNode[] = (parsed.nodes ?? []).map((n: any, i: number) => ({
      id: n.id ?? `step-${i + 1}`,
      description: n.description ?? "",
      tools: Array.isArray(n.tools) ? n.tools : undefined,
      dependencies: Array.isArray(n.dependencies) ? n.dependencies : [],
      status: "pending" as const,
    }));

    return {
      id: planId,
      tier: input.tier,
      reasoning: parsed.reasoning ?? "",
      nodes,
      approvalRequired: false,
    };
  } catch {
    // Single-node fallback
    return {
      id: planId,
      tier: input.tier,
      reasoning: "Failed to generate structured plan, using single-step fallback",
      nodes: [
        {
          id: "step-1",
          description: input.userMessage,
          dependencies: [],
          status: "pending",
        },
      ],
      approvalRequired: false,
    };
  }
}
