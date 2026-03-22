import { Agent, run } from "@openai/agents";
import type { RunStreamEvent, FunctionTool } from "@openai/agents";
import { heartbeat } from "@temporalio/activity";
import { createLiteLLMModel } from "@nova/worker-shared/agent-sdk-model";
import { toAgentInput } from "@nova/worker-shared/message-convert";
import {
  publishToken,
  publishToolStatus,
  publishDone,
  publishError,
} from "@nova/worker-shared/stream";
import { getBuiltinTools, loadCustomTools } from "@nova/worker-shared/tools";

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
  /** Org ID for org-scoped tools like search_workspace */
  orgId?: string;
  /** When set, only these builtin tools are available. Null/undefined = all tools. */
  allowedBuiltinTools?: string[] | null;
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
  // Build tools list: built-in (filtered by agent config) + any custom tools from DB
  const tools: FunctionTool<any, any>[] = getBuiltinTools(input.orgId, input.allowedBuiltinTools);
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
      maxTokens: input.maxTokens ?? 4096,
    },
  });

  // Convert message history to SDK protocol format
  const sdkInput = toAgentInput(input.messageHistory);

  let fullContent = "";
  let totalTokens = 0;
  let steps = 0;
  const toolCallRecords: AgentRunResult["toolCallRecords"] = [];

  // Track active tool calls for timing
  const toolStartTimes = new Map<string, { name: string; startMs: number; args: Record<string, unknown> }>();

  let eventCount = 0;

  // State machine for filtering <think> blocks from streamed tokens
  let insideThinkBlock = false;
  let thinkBuffer = "";

  async function streamWithThinkFilter(channelId: string, delta: string) {
    if (insideThinkBlock) {
      thinkBuffer += delta;
      const closeIdx = thinkBuffer.indexOf("</think>");
      if (closeIdx !== -1) {
        const afterClose = thinkBuffer.slice(closeIdx + 8);
        thinkBuffer = "";
        insideThinkBlock = false;
        if (afterClose) await publishToken(channelId, afterClose);
      }
    } else {
      const combined = thinkBuffer + delta;
      const openIdx = combined.indexOf("<think>");
      if (openIdx !== -1) {
        const before = combined.slice(0, openIdx);
        thinkBuffer = combined.slice(openIdx);
        insideThinkBlock = true;
        if (before) await publishToken(channelId, before);
        // Check if close tag is also in same chunk
        const closeIdx = thinkBuffer.indexOf("</think>");
        if (closeIdx !== -1) {
          const afterClose = thinkBuffer.slice(closeIdx + 8);
          thinkBuffer = "";
          insideThinkBlock = false;
          if (afterClose) await publishToken(channelId, afterClose);
        }
      } else if (combined.endsWith("<") || combined.endsWith("<t") || combined.endsWith("<th") || combined.endsWith("<thi") || combined.endsWith("<thin") || combined.endsWith("<think")) {
        // Partial tag — buffer it
        thinkBuffer = combined;
      } else {
        thinkBuffer = "";
        await publishToken(channelId, delta);
      }
    }
  }

  try {
    const stream = await run(agent, sdkInput, {
      stream: true,
      maxTurns: input.maxTurns ?? 12,
    });
    for await (const event of stream as AsyncIterable<RunStreamEvent>) {
      // Heartbeat to Temporal so the activity doesn't time out during long streams
      heartbeat({
        eventCount,
        contentLength: fullContent.length,
        toolCallsCompleted: toolCallRecords.length,
      });
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
          // Filter <think> blocks from streaming output
          await streamWithThinkFilter(input.streamChannelId, data.delta);
        }
      } else if (event.type === "run_item_stream_event") {
        const item = event.item as any;

        // Capture message output text that wasn't already streamed via output_text_delta
        if (event.name === "message_output_created") {
          const rawItem = item?.rawItem;
          const content = rawItem?.content;
          const textParts = Array.isArray(content)
            ? content.filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("")
            : typeof content === "string" ? content : "";
          if (textParts && !fullContent.includes(textParts.slice(-100))) {
            fullContent += textParts;
          }
        }

        if (item?.type === "tool_call_item") {
          const rawItem = item.rawItem;
          if (eventCount <= 200) {
            console.log(`[agent-run] tool_call_item: event=${event.name} rawType=${rawItem?.type} rawName=${rawItem?.name} rawCallId=${rawItem?.callId} rawId=${rawItem?.id} itemKeys=${Object.keys(item).join(",")}`);
          }
          const toolName = rawItem?.name ?? rawItem?.function?.name ?? "unknown";

          if (event.name === "tool_called") {
            let parsedArgs: Record<string, unknown> = {};
            try {
              const argsStr = rawItem?.arguments ?? rawItem?.function?.arguments;
              if (typeof argsStr === "string") parsedArgs = JSON.parse(argsStr);
              else if (typeof argsStr === "object" && argsStr) parsedArgs = argsStr;
            } catch {
              /* ignore parse errors */
            }

            // Use callId as key (matches what tool_output uses for lookup)
            toolStartTimes.set(rawItem?.callId ?? rawItem?.id ?? item.id ?? "", {
              name: toolName,
              startMs: Date.now(),
              args: parsedArgs,
            });

            await publishToolStatus(input.streamChannelId, toolName, "running", {
              args: parsedArgs,
            });
          }
        }

        if (event.name === "tool_output") {
          const outputItem = item as any;
          const callId = outputItem.rawItem?.callId ?? outputItem.rawItem?.id ?? "";
          const tracked = toolStartTimes.get(callId);
          const toolName = tracked?.name ?? outputItem.rawItem?.name ?? "unknown";
          const durationMs = tracked ? Date.now() - tracked.startMs : 0;
          toolStartTimes.delete(callId);

          const output = outputItem.output ?? outputItem.rawItem?.output;
          console.log(`[agent-run] tool_output: tool=${toolName} callId=${callId} outputType=${typeof output} outputLen=${typeof output === "string" ? output.length : JSON.stringify(output)?.length ?? 0} preview=${typeof output === "string" ? output.slice(0, 200) : JSON.stringify(output)?.slice(0, 200)}`);
          toolCallRecords.push({
            toolName,
            input: tracked?.args ?? {},
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
    const isMaxTurns = errMsg.includes("Max turns") || err?.constructor?.name === "MaxTurnsExceededError";
    const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit");

    if (isMaxTurns) {
      // MaxTurnsExceededError can be thrown during stream iteration (not just at stream.completed).
      // This is expected behavior — we already accumulated content from the stream, so just log and continue.
      console.warn(`[agent-run] max turns reached: ${errMsg}, accumulated ${fullContent.length} chars`);
    } else {
      console.error(`[agent-run] CATCH: ${errMsg}, rateLimit=${isRateLimit}, channel=${input.streamChannelId}`);

      // Publish rate-limit specific error so frontend can show appropriate state
      if (isRateLimit) {
        await publishError(input.streamChannelId, `Rate limited: ${errMsg}`);
      }
      // Otherwise don't publish error — Temporal may retry the activity on the same channel.
      throw err;
    }
  }

  // Strip <think> reasoning blocks before returning
  fullContent = stripThinkBlocks(fullContent);

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

/**
 * Strip <think>...</think> reasoning blocks from model output.
 * These are chain-of-thought traces that should not be shown to the user.
 */
function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/g, "").trim();
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
