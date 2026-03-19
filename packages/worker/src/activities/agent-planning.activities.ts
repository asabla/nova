import { openai } from "../lib/litellm";

export interface PlanStep {
  number: number;
  description: string;
  tools?: string[];
  parallelGroup?: number;
}

export interface GeneratePlanInput {
  systemPrompt: string;
  userMessage: string;
  availableTools: { name: string; description: string }[];
  model: string;
}

export interface GeneratePlanResult {
  steps: PlanStep[];
  reasoning: string;
}

export interface AssessComplexityInput {
  userMessage: string;
  model: string;
}

export interface AssessComplexityResult {
  complexity: "simple" | "moderate" | "complex";
  shouldPlan: boolean;
}

/**
 * Assess whether a user message requires a multi-step plan.
 * Uses a lightweight LLM call to classify complexity.
 */
export async function assessComplexity(input: AssessComplexityInput): Promise<AssessComplexityResult> {
  const response = await openai.chat.completions.create({
    model: input.model,
    messages: [
      {
        role: "system",
        content: `You are a task complexity assessor. Classify the user's request as "simple", "moderate", or "complex".
- simple: single-step, direct answer, no tools needed
- moderate: 2-3 steps, may need 1-2 tool calls
- complex: 4+ steps, multiple tools, research, or multi-part reasoning

Respond with ONLY valid JSON: {"complexity": "simple"|"moderate"|"complex", "shouldPlan": true|false}`,
      },
      { role: "user", content: input.userMessage },
    ],
    temperature: 0,
    max_tokens: 100,
  } as any);

  const content = (response as any).choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content);
    return {
      complexity: parsed.complexity ?? "simple",
      shouldPlan: parsed.shouldPlan ?? false,
    };
  } catch {
    // Default to simple if parsing fails
    return { complexity: "simple", shouldPlan: false };
  }
}

/**
 * Generate a structured execution plan for a complex task.
 * Returns numbered steps with optional tool assignments and parallel grouping.
 */
export async function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  const toolList = input.availableTools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: input.model,
    messages: [
      {
        role: "system",
        content: `You are a task planner. Given a user request and available tools, create a step-by-step execution plan.

Available tools:
${toolList}

${input.systemPrompt ? `Agent context: ${input.systemPrompt}` : ""}

Respond with ONLY valid JSON:
{
  "reasoning": "Brief explanation of your approach",
  "steps": [
    {
      "number": 1,
      "description": "What to do in this step",
      "tools": ["tool_name"],
      "parallelGroup": 1
    }
  ]
}

Rules:
- Steps in the same parallelGroup can run in parallel
- Steps with different parallelGroups run sequentially (lower first)
- Keep plans concise: 2-8 steps maximum
- Only reference tools from the available list`,
      },
      { role: "user", content: input.userMessage },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  } as any);

  const content = (response as any).choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(content);
    return {
      steps: (parsed.steps ?? []).map((s: any, i: number) => ({
        number: s.number ?? i + 1,
        description: s.description ?? "",
        tools: s.tools,
        parallelGroup: s.parallelGroup,
      })),
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    // Return a single-step plan if parsing fails
    return {
      steps: [{ number: 1, description: input.userMessage }],
      reasoning: "Failed to generate structured plan, using single-step fallback",
    };
  }
}
