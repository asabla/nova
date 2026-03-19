import { Agent, run } from "@openai/agents";
import type { RunStreamEvent, FunctionTool } from "@openai/agents";
import { heartbeat } from "@temporalio/activity";
import { createLiteLLMModel } from "../lib/agent-sdk-model";
import { toAgentInput } from "../lib/message-convert";
import {
  publishToken,
  publishToolStatus,
  publishDone,
  publishError,
} from "../lib/stream-publisher";
import { builtinTools } from "../tools/builtin";
import { loadCustomTools } from "../tools/custom";

export interface AgentRunInput {
  streamChannelId: string;
  model: string;
  systemPrompt?: string;
  messageHistory: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  maxTurns?: number;
  /** Agent ID for loading custom tools from DB. If empty, only built-in tools are used. */
  agentId?: string;
}

export interface AgentRunResult {
  content: string;
  totalTokens: number;
  steps: number;
  toolCallRecords: {
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    error?: string;
    durationMs: number;
  }[];
}

/**
 * Temporal activity that runs the OpenAI Agent SDK loop.
 * Streams tokens to Redis and tracks tool calls.
 *
 * This replaces the manual tool-call loop in smartChatWorkflow
 * (call LLM -> detect tool_calls -> execute -> repeat).
 */
export async function runAgentLoop(input: AgentRunInput): Promise<AgentRunResult> {
  // Build tools list: built-in + any custom tools from DB
  const tools: FunctionTool<any, any>[] = [...builtinTools];
  if (input.agentId) {
    const custom = await loadCustomTools(input.agentId);
    tools.push(...custom);
  }

  const agent = new Agent({
    name: "nova-chat",
    instructions: input.systemPrompt ?? "You are a helpful assistant.",
    model: createLiteLLMModel(input.model),
    tools,
    modelSettings: {
      temperature: input.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? 16384,
    },
  });

  // Convert message history to SDK protocol format
  const sdkInput = toAgentInput(input.messageHistory);

  let fullContent = "";
  let totalTokens = 0;
  let steps = 0;
  const toolCallRecords: AgentRunResult["toolCallRecords"] = [];

  // Track active tool calls for timing
  const toolStartTimes = new Map<string, { name: string; startMs: number }>();

  let eventCount = 0;

  try {
    const stream = await run(agent, sdkInput, {
      stream: true,
      maxTurns: input.maxTurns ?? 5,
    });
    for await (const event of stream as AsyncIterable<RunStreamEvent>) {
      // Heartbeat to Temporal so the activity doesn't time out during long streams
      heartbeat();
      eventCount++;

      if (event.type === "raw_model_stream_event") {
        const data = event.data as any;
        // Log first few events for debugging
        if (eventCount <= 3) {
          console.log(`[agent-run] event #${eventCount}: raw_model type=${data?.type} keys=${data ? Object.keys(data).join(",") : "null"}`);
        }
        // output_text_delta events contain streaming text tokens
        if (data?.type === "output_text_delta" && data.delta) {
          fullContent += data.delta;
          await publishToken(input.streamChannelId, data.delta);
        }
      } else if (event.type === "run_item_stream_event") {
        const item = event.item as any;

        if (item?.type === "tool_call_item") {
          const rawItem = item.rawItem;
          if (eventCount <= 200) {
            console.log(`[agent-run] tool_call_item: event=${event.name} rawType=${rawItem?.type} rawName=${rawItem?.name} rawCallId=${rawItem?.callId} itemKeys=${Object.keys(item).join(",")}`);
          }
          const toolName = rawItem?.name ?? "unknown";

          if (event.name === "tool_called") {
            // Tool call started
            toolStartTimes.set(rawItem?.id ?? item.id ?? "", {
              name: toolName,
              startMs: Date.now(),
            });

            let parsedArgs: Record<string, unknown> = {};
            try {
              const argsStr = rawItem?.arguments;
              if (typeof argsStr === "string") parsedArgs = JSON.parse(argsStr);
            } catch {
              /* ignore parse errors */
            }

            await publishToolStatus(input.streamChannelId, toolName, "running", {
              args: parsedArgs,
            });
          }
        }

        if (event.name === "tool_output") {
          const outputItem = item as any;
          const callId = outputItem.rawItem?.callId ?? "";
          const tracked = toolStartTimes.get(callId);
          const toolName = tracked?.name ?? "unknown";
          const durationMs = tracked ? Date.now() - tracked.startMs : 0;
          toolStartTimes.delete(callId);

          const output = outputItem.rawItem?.output;
          toolCallRecords.push({
            toolName,
            input: {},
            output: output ?? null,
            durationMs,
          });

          const summary = buildResultSummary(toolName, output);
          await publishToolStatus(input.streamChannelId, toolName, "completed", {
            resultSummary: summary,
          });
          steps++;
        }
      }
    }

    // Extract usage from the completed run.
    // stream.completed may reject with MaxTurnsExceededError — that's OK,
    // we already accumulated content from the stream.
    try {
      await stream.completed;
    } catch (completedErr) {
      console.warn(`[agent-run] stream.completed rejected: ${completedErr instanceof Error ? completedErr.message : completedErr}`);
    }

    const usage = (stream as any).state?.usage;
    if (usage) {
      totalTokens = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    }

    // Use finalOutput if we didn't accumulate content from streaming
    if (!fullContent) {
      try {
        if (stream.finalOutput) {
          fullContent =
            typeof stream.finalOutput === "string"
              ? stream.finalOutput
              : JSON.stringify(stream.finalOutput);
        }
      } catch {
        // finalOutput may not be available if max turns exceeded
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit");
    console.error(`[agent-run] CATCH: ${errMsg}, rateLimit=${isRateLimit}, channel=${input.streamChannelId}`);

    // Publish rate-limit specific error so frontend can show appropriate state
    if (isRateLimit) {
      await publishError(input.streamChannelId, `Rate limited: ${errMsg}`);
    }
    // Otherwise don't publish error — Temporal may retry the activity on the same channel.
    throw err;
  }

  // Signal completion to the relay
  console.log(`[agent-run] done: ${eventCount} events, ${fullContent.length} chars content, channel=${input.streamChannelId}`);
  await publishDone(input.streamChannelId, {
    content: fullContent,
    usage: { prompt_tokens: 0, completion_tokens: 0 },
  });

  return {
    content: fullContent,
    totalTokens,
    steps,
    toolCallRecords,
  };
}

function buildResultSummary(toolName: string, result: unknown): string {
  try {
    if (toolName === "web_search") {
      if (Array.isArray(result))
        return `Found ${result.length} result${result.length === 1 ? "" : "s"}`;
      if (typeof result === "object" && result !== null && "results" in result) {
        const arr = (result as any).results;
        if (Array.isArray(arr))
          return `Found ${arr.length} result${arr.length === 1 ? "" : "s"}`;
      }
      const str = typeof result === "string" ? result : JSON.stringify(result);
      return `Fetched ${str.length.toLocaleString()} chars`;
    }
    if (toolName === "fetch_url") {
      const str = typeof result === "string" ? result : JSON.stringify(result);
      return `Read ${str.length.toLocaleString()} chars`;
    }
    return "Done";
  } catch {
    return "Done";
  }
}
