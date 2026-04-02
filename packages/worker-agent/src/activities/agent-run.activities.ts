import { Agent, run } from "@openai/agents";
import type { RunStreamEvent, FunctionTool } from "@openai/agents";
import { heartbeat } from "@temporalio/activity";
import { createLiteLLMModel } from "@nova/worker-shared/agent-sdk-model";
import { openai } from "@nova/worker-shared/litellm";
import { toAgentInput } from "@nova/worker-shared/message-convert";
import {
  publishToken,
  publishToolStatus,
  publishContentClear,
  publishDone,
  publishError,
} from "@nova/worker-shared/stream";
import { getBuiltinTools, loadCustomTools, createResearchTools } from "@nova/worker-shared/tools";
import type { ResearchSource, ReportSection } from "@nova/worker-shared/tools";
import { getModelParams } from "@nova/worker-shared/models";
import { createReasoningModel } from "@nova/worker-shared/reasoning-model";
import type { ResearchConfig } from "@nova/shared/types";
import { logger } from "@nova/worker-shared/logger";
import { startChildSpan, deriveTraceContext, isOtelEnabled, SpanStatusCode } from "@nova/worker-shared/telemetry";


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
  /** Knowledge collection IDs attached to the conversation for RAG */
  knowledgeCollectionIds?: string[];
  /** When set, research-specific tools are injected and research results are tracked. */
  researchConfig?: ResearchConfig;
  /** OTel trace ID for distributed trace correlation */
  traceId?: string;
}

export interface AgentRunResult {
  content: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  steps: number;
  toolCallRecords: {
    toolName: string;
    input: Record<string, unknown>;
    output: unknown;
    error?: string;
    durationMs: number;
  }[];
  /** Present when researchConfig was provided — accumulated sources and sections. */
  researchResult?: {
    sources: ResearchSource[];
    sections: ReportSection[];
  };
}

/**
 * Temporal activity that runs the OpenAI Agent SDK loop.
 * Streams tokens to Redis and tracks tool calls.
 *
 * This replaces the manual tool-call loop in smartChatWorkflow
 * (call LLM -> detect tool_calls -> execute -> repeat).
 */
export async function runAgentLoop(input: AgentRunInput): Promise<AgentRunResult> {
  // Create a top-level "agent.run" span as child of the API request.
  // All publish calls inside this activity become children of this span,
  // creating the hierarchy: API → agent.run → stream.token/stream.done
  const runSpan = (input.traceId && isOtelEnabled())
    ? startChildSpan("agent.run", input.traceId, { "agent.model": input.model, "agent.max_turns": input.maxTurns ?? 0 })
    : null;
  // Derive a new traceContext so publish calls become children of agent.run (not the API span)
  const tid = runSpan ? deriveTraceContext(runSpan) : input.traceId;

  // Build tools list: built-in (filtered by agent config) + any custom tools from DB
  const tools: FunctionTool<any, any>[] = getBuiltinTools(input.orgId, input.allowedBuiltinTools, input.knowledgeCollectionIds);
  if (input.agentId) {
    const custom = await loadCustomTools(input.agentId);
    tools.push(...custom);
  }

  // Inject research-specific tools when running in research mode
  let getResearchSources: (() => ResearchSource[]) | undefined;
  let getResearchSections: (() => ReportSection[]) | undefined;
  if (input.researchConfig) {
    const rc = input.researchConfig;
    const { tools: researchTools, getSources, getSections } = createResearchTools({
      orgId: input.orgId ?? "",
      streamChannelId: input.streamChannelId,
      collectionIds: rc.sources.knowledgeCollectionIds,
      fileIds: rc.sources.fileIds,
    });
    tools.push(...researchTools);
    getResearchSources = getSources;
    getResearchSections = getSections;
    // Remove invoke_agent from research (not useful)
    const invokeIdx = tools.findIndex((t) => (t as any).name === "invoke_agent");
    if (invokeIdx >= 0) tools.splice(invokeIdx, 1);
  }

  // Check model-specific params (e.g. reasoning models that don't support temperature/max_tokens)
  const modelParams = await getModelParams(input.model);
  const dropParams = modelParams?.dropParams ?? [];
  const dropSet = new Set(dropParams);

  // For reasoning models, use a wrapper that intercepts the OpenAI client
  // and strips unsupported params from the actual HTTP request.
  // The Agent SDK always sends max_tokens/temperature even when undefined.
  const model = dropParams.length > 0
    ? await createReasoningModel(openai, input.model, dropParams)
    : createLiteLLMModel(input.model);

  const modelSettings: Record<string, unknown> = {};
  if (!dropSet.has("temperature")) modelSettings.temperature = input.temperature ?? 0.7;
  // Always set maxTokens — for reasoning models the wrapper converts it to max_completion_tokens
  modelSettings.maxTokens = input.maxTokens ?? 16384;

  const agent = new Agent({
    name: "nova-chat",
    instructions: input.systemPrompt ?? "You are a helpful assistant.",
    model,
    tools,
    modelSettings,
  });

  // Convert message history to SDK protocol format
  let sdkInput = toAgentInput(input.messageHistory);

  let fullContent = "";
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let steps = 0;
  const toolCallRecords: AgentRunResult["toolCallRecords"] = [];

  // Continuation: minimum output tokens before considering auto-continuation
  const CONTINUATION_THRESHOLD = 300;
  const MAX_CONTINUATIONS = 5;
  let continuationCount = 0;

  // Track active tool calls for timing
  const toolStartTimes = new Map<string, { name: string; startMs: number; args: Record<string, unknown> }>();

  let eventCount = 0;

  // Track whether the current turn has seen tool calls — if so, any pre-tool
  // reasoning text was already streamed and needs to be cleared.
  let currentTurnHasToolCall = false;
  let preToolContentLength = 0;
  // Track how many chars were actually streamed to the frontend (after think filtering)
  let streamedContentLength = 0;

  // State machine for filtering <think> blocks from streamed tokens
  let insideThinkBlock = false;
  let thinkBuffer = "";

  async function streamWithThinkFilter(channelId: string, delta: string) {
    const publish = async (text: string) => {
      streamedContentLength += text.length;
      await publishToken(channelId, text, tid);
    };
    if (insideThinkBlock) {
      thinkBuffer += delta;
      const closeIdx = thinkBuffer.indexOf("</think>");
      if (closeIdx !== -1) {
        const afterClose = thinkBuffer.slice(closeIdx + 8);
        thinkBuffer = "";
        insideThinkBlock = false;
        if (afterClose) await publish(afterClose);
      }
    } else {
      const combined = thinkBuffer + delta;
      const openIdx = combined.indexOf("<think>");
      if (openIdx !== -1) {
        const before = combined.slice(0, openIdx);
        thinkBuffer = combined.slice(openIdx);
        insideThinkBlock = true;
        if (before) await publish(before);
        // Check if close tag is also in same chunk
        const closeIdx = thinkBuffer.indexOf("</think>");
        if (closeIdx !== -1) {
          const afterClose = thinkBuffer.slice(closeIdx + 8);
          thinkBuffer = "";
          insideThinkBlock = false;
          if (afterClose) await publish(afterClose);
        }
      } else if (combined.endsWith("<") || combined.endsWith("<t") || combined.endsWith("<th") || combined.endsWith("<thi") || combined.endsWith("<thin") || combined.endsWith("<think")) {
        // Partial tag — buffer it
        thinkBuffer = combined;
      } else {
        thinkBuffer = "";
        await publish(combined);
      }
    }
  }

  // Outer continuation loop: after each run, check if the model stopped with
  // substantial output. If so, inject the output as context and ask to continue.
  // This ensures the model sees its own partial output and can decide to keep going.
  let runLoop = true;
  while (runLoop) {
  runLoop = false; // default: single run

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
        // New model response starting — reset pre-tool tracking for this turn
        if (data?.type === "response_started") {
          currentTurnHasToolCall = false;
          preToolContentLength = 0;
        }
        // Log first few events and response_done for debugging
        if (eventCount <= 3) {
          logger.info({ eventCount, rawType: data?.type, keys: data ? Object.keys(data).join(",") : null }, "[agent-run] raw_model event");
        }
        if (data?.type === "response_done") {
          const resp = data?.response;
          logger.info({ outputTokens: resp?.usage?.outputTokens, inputTokens: resp?.usage?.inputTokens, reasoningTokens: resp?.usage?.outputTokensDetails?.reasoning_tokens, outputItems: resp?.output?.length }, "[agent-run] response_done");
        }
        // output_text_delta events contain streaming text tokens
        if (data?.type === "output_text_delta" && data.delta) {
          fullContent += data.delta;

          // Only stream tokens if no tool call has been detected in this turn.
          // Pre-tool reasoning ("I need to search...") gets cleared when the
          // first tool_called event arrives.
          if (!currentTurnHasToolCall) {
            preToolContentLength += data.delta.length;
            await streamWithThinkFilter(input.streamChannelId, data.delta);
          }
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
            logger.info({ event: event.name, rawType: rawItem?.type, rawName: rawItem?.name, rawCallId: rawItem?.callId, rawId: rawItem?.id, itemKeys: Object.keys(item).join(",") }, "[agent-run] tool_call_item");
          }
          const toolName = rawItem?.name ?? rawItem?.function?.name ?? "unknown";

          if (event.name === "tool_called") {
            // continue_response is a continuation tool — the text before it IS
            // the actual content, not pre-tool reasoning. Don't clear or suppress.
            const isContinuation = toolName === "continue_response";

            // First tool call in this turn — discard any pre-tool reasoning
            // that was already streamed ("I need to search...", "Let me look up...")
            if (!isContinuation && !currentTurnHasToolCall && preToolContentLength > 0) {
              await publishContentClear(input.streamChannelId, "tool_calls_detected", tid);
            }
            if (!isContinuation) {
              currentTurnHasToolCall = true;
            }

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

            if (!isContinuation) {
              await publishToolStatus(input.streamChannelId, toolName, "running", {
                args: parsedArgs,
              }, tid);
            }
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
          logger.info({ tool: toolName, callId, outputType: typeof output, outputLen: typeof output === "string" ? output.length : JSON.stringify(output)?.length ?? 0, preview: typeof output === "string" ? output.slice(0, 200) : JSON.stringify(output)?.slice(0, 200) }, "[agent-run] tool_output");
          toolCallRecords.push({
            toolName,
            input: tracked?.args ?? {},
            output: output ?? null,
            durationMs,
          });

          if (toolName !== "continue_response") {
            const summary = buildResultSummary(toolName, output);
            await publishToolStatus(input.streamChannelId, toolName, "completed", {
              resultSummary: summary,
            }, tid);
            steps++;
          }
        }
      }
    }

    // Extract usage from the completed run.
    // stream.completed may reject with MaxTurnsExceededError — that's OK,
    // we already accumulated content from the stream.
    try {
      await stream.completed;
    } catch (completedErr) {
      logger.warn({ err: completedErr instanceof Error ? completedErr.message : completedErr }, "[agent-run] stream.completed rejected");
    }

    const usage = (stream as any).state?.usage;
    if (usage) {
      // Accumulate tokens across continuation runs
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
      totalTokens += usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    }

    // Prefer finalOutput from the SDK — it contains the clean final answer
    // without <think> blocks or pre-tool reasoning.
    const finalOutput = stream.finalOutput;
    if (finalOutput) {
      const finalText = typeof finalOutput === "string"
        ? finalOutput
        : JSON.stringify(finalOutput);
      if (finalText && (!fullContent || streamedContentLength === 0)) {
        fullContent = finalText;
      }
    }

    // ── Auto-continuation: if the model produced substantial output,
    // inject it as context and tell it to continue.
    // The model sees its own output and continues with the next section.
    // Stops when: continuation produces very little (< threshold), or max reached.
    const runOutputTokens = (usage?.outputTokens ?? 0);
    const isSubstantialOutput = runOutputTokens >= CONTINUATION_THRESHOLD;
    const shouldContinue = continuationCount === 0
      ? isSubstantialOutput // first run: continue if substantial output
      : isSubstantialOutput; // continuation run: continue if it produced substantial content (not just "ok" or "done")
    if (
      shouldContinue &&
      continuationCount < MAX_CONTINUATIONS &&
      steps === 0 // only auto-continue for pure text responses (no tool calls)
    ) {
      continuationCount++;
      logger.info({ continuationCount, runOutputTokens }, "[agent-run] auto-continuation, injecting context");

      // Save the content accumulated so far before resetting for the next run
      const previousContent = fullContent;

      // Inject the current output as assistant message + assertive continuation prompt
      sdkInput = toAgentInput([
        ...input.messageHistory,
        { role: "assistant", content: previousContent },
        { role: "user", content: "Continue. Show the next section of your response. Do not repeat any content already shown above." },
      ]);

      // Keep previous content; ensure newline separator so continuation
      // output doesn't merge with the last line (e.g. ``` + ## Heading)
      fullContent = previousContent;
      if (fullContent && !fullContent.endsWith("\n")) {
        fullContent += "\n\n";
        await publishToken(input.streamChannelId, "\n\n", tid);
      }

      // Reset per-run state for the next iteration
      currentTurnHasToolCall = false;
      preToolContentLength = 0;
      insideThinkBlock = false;
      thinkBuffer = "";

      runLoop = true; // trigger next iteration
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isMaxTurns = errMsg.includes("Max turns") || err?.constructor?.name === "MaxTurnsExceededError";
    const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit");

    if (isMaxTurns) {
      // MaxTurnsExceededError can be thrown during stream iteration (not just at stream.completed).
      // This is expected behavior — we already accumulated content from the stream, so just log and continue.
      logger.warn({ err: errMsg, contentLength: fullContent.length }, "[agent-run] max turns reached");
    } else {
      logger.error({ err: errMsg, rateLimit: isRateLimit, channel: input.streamChannelId }, "[agent-run] error caught");

      // Publish rate-limit specific error so frontend can show appropriate state
      if (isRateLimit) {
        await publishError(input.streamChannelId, `Rate limited: ${errMsg}`, tid);
      }
      // Otherwise don't publish error — Temporal may retry the activity on the same channel.
      if (runSpan) { runSpan.setStatus({ code: SpanStatusCode.ERROR, message: errMsg }); runSpan.end(); }
      throw err;
    }
  }

  } // end while (runLoop) continuation loop

  // Strip <think> reasoning blocks before returning
  fullContent = stripThinkBlocks(fullContent);

  // If the streamed tokens were all inside <think> blocks (filtered out) but we have
  // clean content from finalOutput, stream it now so the frontend receives it.
  if (fullContent && streamedContentLength === 0) {
    await publishToken(input.streamChannelId, fullContent, tid);
  }

  // Signal completion to the relay
  logger.info({ eventCount, contentLength: fullContent.length, channel: input.streamChannelId, traceId: tid }, "[agent-run] done");
  await publishDone(input.streamChannelId, {
    content: fullContent,
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
  }, tid);

  if (runSpan) {
    runSpan.setAttribute("agent.steps", steps);
    runSpan.setAttribute("agent.tokens.input", inputTokens);
    runSpan.setAttribute("agent.tokens.output", outputTokens);
    runSpan.setAttribute("agent.content_length", fullContent.length);
    runSpan.end();
  }

  return {
    content: fullContent,
    totalTokens,
    inputTokens,
    outputTokens,
    steps,
    toolCallRecords,
    ...(getResearchSources && getResearchSections ? {
      researchResult: {
        sources: getResearchSources(),
        sections: getResearchSections(),
      },
    } : {}),
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
    if (toolName === "invoke_agent") {
      const name = typeof result === "object" && result !== null && "agent_name" in result
        ? (result as any).agent_name : null;
      return name ? `Delegated to ${name}` : "Delegated to agent";
    }
    if (toolName === "code_execute") {
      const lang = typeof result === "object" && result !== null && "language" in result
        ? (result as any).language : null;
      return lang ? `Executed ${lang} code` : "Executed code";
    }
    if (toolName === "read_file") {
      const str = typeof result === "string" ? result : JSON.stringify(result);
      return `Read ${str.length.toLocaleString()} chars`;
    }
    if (toolName === "search_workspace") {
      if (typeof result === "object" && result !== null && "results" in result) {
        const arr = (result as any).results;
        if (Array.isArray(arr))
          return `Found ${arr.length} result${arr.length === 1 ? "" : "s"}`;
      }
      return "Search complete";
    }
    return "Done";
  } catch {
    return "Done";
  }
}
