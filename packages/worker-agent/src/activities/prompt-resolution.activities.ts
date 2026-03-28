import { resolveSystemPrompt, registerFallbackPrompt } from "@nova/worker-shared/prompt-resolver";

// ---------------------------------------------------------------------------
// Fallback prompts — registered at import time so the resolver can fall back
// to these if the DB has no entry for a given slug.
// ---------------------------------------------------------------------------

registerFallbackPrompt("effort_low", [
  "Keep your response brief and to the point. Aim for 1-3 short paragraphs maximum.",
  "Do not elaborate beyond what is directly asked.",
  "No preamble, no summaries of what you did, no 'let me know if you need anything else' closings.",
  "If the answer is one sentence, give one sentence.",
].join(" "));

registerFallbackPrompt("effort_medium", "Be concise but thorough. Cover key points without unnecessary elaboration.");

registerFallbackPrompt("effort_high", "Provide a thorough, detailed response. It is appropriate to be comprehensive here.");

registerFallbackPrompt("formatting", [
  "Write in natural prose paragraphs, like a knowledgeable colleague explaining something.",
  "Do NOT structure your response as bullet-point lists or numbered lists. Lists feel robotic and are hard to read.",
  "Instead of a bulleted list of points, weave those points into flowing paragraphs with clear topic sentences.",
  "You may use a short list (3-5 items max, never nested) ONLY when the user explicitly asks for a list, or for truly atomic items like terminal commands or file names.",
  "Use markdown headings (##) to organize longer responses into sections, but the content within each section should be prose.",
  "Never use bold text on every other phrase — reserve bold for one or two genuinely key terms per section at most.",
  "",
  "## YouTube & Video Content",
  "When referencing YouTube video content (from fetch_url transcripts or knowledge base results):",
  "- Always make timestamps clickable by formatting them as markdown links: [MM:SS](https://www.youtube.com/watch?v=VIDEO_ID&t=SECONDS). The UI renders these as special video timestamp chips.",
  "- When summarizing a video with multiple topics or sections, use a timeline widget to give an overview:",
  "  ```widget",
  '  {"type": "timeline", "title": "Video Overview", "params": {"events": [{"date": "0:00", "title": "Section Title", "description": "Brief description", "url": "https://www.youtube.com/watch?v=VIDEO_ID&t=0"}, {"date": "5:30", "title": "Next Section", "url": "https://www.youtube.com/watch?v=VIDEO_ID&t=330"}]}}',
  "  ```",
  "  Use the timestamp (MM:SS) in the date field, include the YouTube timestamp URL in the url field for clickable links, and keep descriptions concise.",
].join("\n"));

registerFallbackPrompt("tier_assessment", `You are a task complexity router. Classify the user's request into one of three execution tiers and suggest an appropriate effort level.

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
{"tier": "direct"|"sequential"|"orchestrated", "confidence": 0.0-1.0, "reasoning": "one sentence why", "suggestedEffort": "low"|"medium"|"high"}`);

registerFallbackPrompt("dag_planning", `You are a task planner. Given a user request and available tools, create an execution plan as a directed acyclic graph (DAG).

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
- Every node must be reachable from a root node (no cycles).
- If prior conversation context is provided, do NOT plan steps for work already completed. Only plan NEW work needed.`);

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface ResolvedPrompts {
  effortLow: { content: string; versionId: string };
  effortMedium: { content: string; versionId: string };
  effortHigh: { content: string; versionId: string };
  formatting: { content: string; versionId: string };
  research?: { content: string; versionId: string };
  researchRefinement?: { content: string; versionId: string };
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

/**
 * Resolve all system prompts needed by the agent workflow.
 * Called once at the start of the workflow to fetch DB-backed prompts.
 */
export async function resolveWorkflowPrompts(orgId: string): Promise<ResolvedPrompts> {
  const [effortLow, effortMedium, effortHigh, formatting, research, researchRefinement] =
    await Promise.all([
      resolveSystemPrompt(orgId, "effort_low"),
      resolveSystemPrompt(orgId, "effort_medium"),
      resolveSystemPrompt(orgId, "effort_high"),
      resolveSystemPrompt(orgId, "formatting"),
      resolveSystemPrompt(orgId, "research"),
      resolveSystemPrompt(orgId, "research_refinement"),
    ]);

  return {
    effortLow: { content: effortLow.content, versionId: effortLow.versionId },
    effortMedium: { content: effortMedium.content, versionId: effortMedium.versionId },
    effortHigh: { content: effortHigh.content, versionId: effortHigh.versionId },
    formatting: { content: formatting.content, versionId: formatting.versionId },
    research: research.content ? { content: research.content, versionId: research.versionId } : undefined,
    researchRefinement: researchRefinement.content ? { content: researchRefinement.content, versionId: researchRefinement.versionId } : undefined,
  };
}

/**
 * Resolve a single system prompt by slug for an org.
 * Used by planning activities for tier assessment and DAG generation.
 */
export async function resolvePromptBySlug(
  orgId: string,
  slug: string,
): Promise<{ content: string; versionId: string }> {
  const result = await resolveSystemPrompt(orgId, slug);
  return { content: result.content, versionId: result.versionId };
}
