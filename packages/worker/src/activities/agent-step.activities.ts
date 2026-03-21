import { Agent, run } from "@openai/agents";
import type { FunctionTool } from "@openai/agents";
import { heartbeat } from "@temporalio/activity";
import { createLiteLLMModel } from "../lib/agent-sdk-model";
import { toAgentInput } from "../lib/message-convert";
import { getBuiltinTools } from "../tools/builtin";
import { loadCustomTools } from "../tools/custom";

export interface AgentStepInput {
  systemPrompt: string | null;
  modelId: string;
  modelParams: unknown;
  messageHistory: { role: string; content: string }[];
  agentId?: string;
  orgId?: string;
  /** Run a single turn (no tool loop) -- useful when the workflow needs to intercept between turns */
  singleTurn?: boolean;
}

export interface AgentStepResult {
  content: string;
  toolCalls: {
    id: string;
    name: string;
    arguments: string;
  }[];
  finishReason: string;
  usage: { prompt_tokens?: number; completion_tokens?: number };
  /** Tool call records from the SDK's automatic tool execution (only when singleTurn is false) */
  toolCallRecords: {
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    error?: string;
  }[];
}

/**
 * Agent step activity using the OpenAI Agent SDK.
 *
 * When `singleTurn` is true (default for agentExecutionWorkflow), runs exactly one LLM turn
 * and returns any tool calls for the workflow to handle (approval flow, etc.).
 *
 * When `singleTurn` is false, lets the SDK run its full tool-call loop.
 */
export async function executeAgentStepWithSDK(
  input: AgentStepInput,
): Promise<AgentStepResult> {
  const tools: FunctionTool<any, any>[] = getBuiltinTools(input.orgId);
  if (input.agentId && !input.singleTurn) {
    const custom = await loadCustomTools(input.agentId);
    tools.push(...custom);
  }

  const agent = new Agent({
    name: "nova-agent",
    instructions: input.systemPrompt ?? "You are a helpful assistant.",
    model: createLiteLLMModel(input.modelId),
    // In single-turn mode, don't pass tools so the model can still request them
    // but the SDK won't auto-execute -- the workflow handles tool execution with approval flow
    tools: input.singleTurn ? [] : tools,
    modelSettings: {
      temperature: (input.modelParams as any)?.temperature ?? 0.7,
      maxTokens: (input.modelParams as any)?.maxTokens ?? 16384,
    },
  });

  const sdkInput = toAgentInput(input.messageHistory);

  let fullContent = "";
  const toolCallRecords: AgentStepResult["toolCallRecords"] = [];

  try {
    const result = await run(agent, sdkInput, {
      maxTurns: input.singleTurn ? 1 : 10,
    });

    heartbeat();

    fullContent =
      typeof result.finalOutput === "string"
        ? result.finalOutput
        : JSON.stringify(result.finalOutput ?? "");

    // Extract usage from raw responses
    let inputTokens = 0;
    let outputTokens = 0;
    for (const resp of result.rawResponses ?? []) {
      const u = resp.usage as any;
      if (u) {
        inputTokens += u.inputTokens ?? 0;
        outputTokens += u.outputTokens ?? 0;
      }
    }

    const usage = {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
    };

    // Extract tool calls from the run's new items
    const pendingToolCalls: AgentStepResult["toolCalls"] = [];

    for (const item of result.newItems ?? []) {
      const raw = item as any;
      if (raw.type === "tool_call_item") {
        const rawItem = raw.rawItem;
        pendingToolCalls.push({
          id: rawItem?.id ?? "",
          name: rawItem?.name ?? "",
          arguments: typeof rawItem?.arguments === "string"
            ? rawItem.arguments
            : JSON.stringify(rawItem?.arguments ?? {}),
        });
      }
    }

    return {
      content: fullContent,
      toolCalls: pendingToolCalls,
      finishReason: pendingToolCalls.length > 0 ? "tool_calls" : "stop",
      usage,
      toolCallRecords,
    };
  } catch (err) {
    throw err;
  }
}
