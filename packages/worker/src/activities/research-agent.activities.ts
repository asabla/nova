import { Agent, run } from "@openai/agents";
import type { RunStreamEvent, FunctionTool } from "@openai/agents";
import { heartbeat } from "@temporalio/activity";
import { eq } from "drizzle-orm";
import { createLiteLLMModel } from "../lib/agent-sdk-model";
import { db } from "../lib/db";
import { researchReports } from "@nova/shared/schemas";
import {
  publishToken,
  publishToolStatus,
  publishResearchStatus,
  publishResearchProgress,
  publishResearchDone,
  publishResearchError,
} from "../lib/stream-publisher";
import { builtinTools } from "../tools/builtin";
import { createResearchTools, type ResearchSource, type ReportSection } from "../tools/research";
import { getDefaultChatModel } from "../lib/models";
import type { ResearchProgressType, ResearchStatus } from "@nova/shared/constants";

export interface ResearchAgentInput {
  orgId: string;
  reportId: string;
  query: string;
  streamChannelId: string;
  model: string;
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  sources: {
    webSearch: boolean;
    knowledgeCollectionIds: string[];
    fileIds: string[];
  };
}

export interface ResearchAgentResult {
  reportContent: string;
  sources: ResearchSource[];
  sections: ReportSection[];
  totalTokens: number;
  steps: number;
}

const RESEARCH_SYSTEM_PROMPT = `You are a Deep Research Agent. Your goal is to produce a comprehensive, well-sourced research report on the given topic.

## Workflow
1. **Plan**: Identify key aspects of the query to research
2. **Gather**: Use web_search and fetch_url to find relevant sources. Use query_knowledge and fetch_files if internal sources are available.
3. **Record**: Call save_source for every valuable source you find
4. **Analyze**: Use code_execute if you need to process data, create charts, or perform calculations
5. **Write**: Use write_report_section to build the report incrementally, section by section

## Report Structure
Write sections in this order:
0. Executive Summary — 2-3 paragraph overview
1. Key Findings — bullet points of the most important discoveries
2-N. Detailed Analysis sections — deep dives into specific aspects
N+1. Conclusion — synthesis and implications

## Formatting
- Use standard markdown with ## headings, bullet points, numbered lists
- Use [N] inline citations referencing your saved sources
- For data visualizations, use widget code blocks:
  \`\`\`widget
  {"type": "chart", "config": {"type": "bar", "data": {...}, "options": {...}}}
  \`\`\`
- For Mermaid diagrams, use \`\`\`mermaid code blocks
- Include relevant quotes with > blockquotes

## Important
- Be thorough: search multiple queries, cross-reference sources
- Be factual: cite sources for every major claim
- Be analytical: don't just summarize — synthesize and identify patterns
- Save all sources before writing the report
- Write the report section-by-section using write_report_section`;

/**
 * Temporal activity that runs the research agent loop.
 * Creates research-specific tools, runs the OpenAI Agent SDK loop,
 * and intercepts events to publish research-specific SSE updates.
 */
export async function runResearchAgentLoop(
  input: ResearchAgentInput,
): Promise<ResearchAgentResult> {
  const ch = input.streamChannelId;

  // Create research tools with closure-bound state
  const { tools: researchTools, getSources, getSections } = createResearchTools({
    orgId: input.orgId,
    streamChannelId: ch,
    collectionIds: input.sources.knowledgeCollectionIds,
    fileIds: input.sources.fileIds,
  });

  // Build tools list: research tools + builtins (minus invoke_agent which isn't useful for research)
  const tools: FunctionTool<any, any>[] = [
    ...researchTools,
    ...builtinTools.filter((t) => (t as any).name !== "invoke_agent"),
  ];

  // Resolve model
  const modelId = input.model || process.env.RESEARCH_MODEL || (await getDefaultChatModel());

  // Build source context for the initial message
  const sourceContext: string[] = [];
  if (input.sources.webSearch) {
    sourceContext.push("- Web search is ENABLED. Use web_search and fetch_url to find sources.");
  } else {
    sourceContext.push("- Web search is DISABLED. Do NOT use web_search or fetch_url.");
  }
  if (input.sources.knowledgeCollectionIds.length > 0) {
    sourceContext.push(
      `- ${input.sources.knowledgeCollectionIds.length} knowledge collection(s) selected. Use query_knowledge to search them.`,
    );
  }
  if (input.sources.fileIds.length > 0) {
    sourceContext.push(
      `- ${input.sources.fileIds.length} file(s) attached. Use fetch_files to read them.`,
    );
  }

  const userMessage = `Research this topic thoroughly and produce a comprehensive report:

${input.query}

## Available Sources
${sourceContext.join("\n")}

Begin by planning your research approach, then gather sources, and finally write the report section by section.`;

  const agent = new Agent({
    name: "nova-research",
    instructions: RESEARCH_SYSTEM_PROMPT,
    model: createLiteLLMModel(modelId),
    tools,
    modelSettings: {
      temperature: input.temperature ?? 0.5,
      maxTokens: input.maxTokens ?? 16384,
    },
  });

  let fullContent = "";
  let rawContent = ""; // includes think tags, for debug
  let totalTokens = 0;
  let steps = 0;
  const toolStartTimes = new Map<string, { name: string; startMs: number }>();

  // State machine for stripping <think>...</think> from streaming tokens
  let inThinkBlock = false;
  let pendingBuffer = ""; // buffered text that might be start of a <think> tag

  /**
   * Process a streaming delta, stripping <think>...</think> blocks.
   * Returns the clean text to publish (may be empty if inside a think block).
   */
  function stripThinkTag(delta: string): string {
    let output = "";
    for (let i = 0; i < delta.length; i++) {
      const ch = delta[i];
      if (inThinkBlock) {
        pendingBuffer += ch;
        if (pendingBuffer.endsWith("</think>")) {
          inThinkBlock = false;
          pendingBuffer = "";
        }
      } else {
        pendingBuffer += ch;
        if (pendingBuffer === "<think>".slice(0, pendingBuffer.length)) {
          // Could be the start of <think>
          if (pendingBuffer === "<think>") {
            inThinkBlock = true;
            pendingBuffer = "";
          }
          // else keep buffering
        } else {
          // Not a <think> tag — flush buffer
          output += pendingBuffer;
          pendingBuffer = "";
        }
      }
    }
    return output;
  }

  // Map tool names to research progress types
  const toolProgressMap: Record<string, ResearchProgressType> = {
    web_search: "query",
    fetch_url: "source",
    query_knowledge: "info",
    fetch_files: "info",
    code_execute: "analysis",
    save_source: "source",
    write_report_section: "synthesis",
  };

  try {
    const stream = await run(agent, userMessage, {
      stream: true,
      maxTurns: input.maxTurns ?? 25,
    });

    let eventCount = 0;

    for await (const event of stream as AsyncIterable<RunStreamEvent>) {
      heartbeat();
      eventCount++;

      if (event.type === "raw_model_stream_event") {
        const data = event.data as any;
        if (data?.type === "output_text_delta" && data.delta) {
          rawContent += data.delta;
          const clean = stripThinkTag(data.delta);
          if (clean) {
            fullContent += clean;
            await publishToken(ch, clean);
          }
        }
      } else if (event.type === "run_item_stream_event") {
        const item = event.item as any;

        if (event.name === "message_output_created") {
          const rawItem = item?.rawItem;
          const content = rawItem?.content;
          let textParts = Array.isArray(content)
            ? content
                .filter((c: any) => c.type === "output_text")
                .map((c: any) => c.text)
                .join("")
            : typeof content === "string"
              ? content
              : "";
          // Strip think blocks from bulk content
          textParts = textParts.replace(/<think>[\s\S]*?<\/think>/g, "");
          if (textParts && !fullContent.includes(textParts.slice(-100))) {
            fullContent += textParts;
          }
        }

        if (item?.type === "tool_call_item") {
          const rawItem = item.rawItem;
          const toolName = rawItem?.name ?? rawItem?.function?.name ?? "unknown";

          if (event.name === "tool_called") {
            const callId = rawItem?.callId ?? rawItem?.id ?? item.id ?? "";
            toolStartTimes.set(callId, { name: toolName, startMs: Date.now() });

            let parsedArgs: Record<string, unknown> = {};
            try {
              const argsStr = rawItem?.arguments ?? rawItem?.function?.arguments;
              if (typeof argsStr === "string") parsedArgs = JSON.parse(argsStr);
              else if (typeof argsStr === "object" && argsStr) parsedArgs = argsStr;
            } catch {
              /* ignore */
            }

            await publishToolStatus(ch, toolName, "running", { args: parsedArgs });

            // Publish research progress for tool start — skip tools that publish
            // their own progress events from execute() to avoid duplicates
            const selfPublishing = new Set([
              "save_source", "write_report_section", "query_knowledge", "fetch_files",
            ]);
            if (!selfPublishing.has(toolName)) {
              const progressType = toolProgressMap[toolName];
              if (progressType) {
                const msg = buildToolProgressMessage(toolName, parsedArgs);
                await publishResearchProgress(ch, progressType, msg);
              }
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
          const summary = buildResultSummary(toolName, output);
          await publishToolStatus(ch, toolName, "completed", { resultSummary: summary });
          steps++;
        }
      }
    }

    try {
      await stream.completed;
    } catch (err) {
      console.warn(
        `[research-agent] stream.completed rejected: ${err instanceof Error ? err.message : err}`,
      );
    }

    const usage = (stream as any).state?.usage;
    if (usage) {
      totalTokens = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    }

    if (!fullContent) {
      try {
        if (stream.finalOutput) {
          let final =
            typeof stream.finalOutput === "string"
              ? stream.finalOutput
              : JSON.stringify(stream.finalOutput);
          fullContent = final.replace(/<think>[\s\S]*?<\/think>/g, "");
        }
      } catch {
        // finalOutput may not be available
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isMaxTurns =
      errMsg.includes("Max turns") || err?.constructor?.name === "MaxTurnsExceededError";

    if (isMaxTurns) {
      console.warn(
        `[research-agent] max turns reached: ${errMsg}, accumulated ${fullContent.length} chars`,
      );
    } else {
      console.error(`[research-agent] error: ${errMsg}`);
      await publishResearchError(ch, errMsg);
      throw err;
    }
  }

  return {
    reportContent: fullContent,
    sources: getSources(),
    sections: getSections(),
    totalTokens,
    steps,
  };
}

function buildToolProgressMessage(
  toolName: string,
  args: Record<string, unknown>,
): string {
  switch (toolName) {
    case "web_search":
      return `Searching: "${(args.query as string)?.slice(0, 80) ?? "..."}"`;
    case "fetch_url":
      return `Reading: ${(args.url as string)?.slice(0, 80) ?? "..."}`;
    case "query_knowledge":
      return `Querying knowledge: "${(args.query as string)?.slice(0, 80) ?? "..."}"`;
    case "fetch_files":
      return "Fetching attached files...";
    case "code_execute":
      return `Executing ${(args.language as string) ?? "code"}...`;
    case "save_source":
      return `Saving source: ${(args.title as string)?.slice(0, 60) ?? "..."}`;
    case "write_report_section":
      return `Writing: ${(args.heading as string) ?? "section"}`;
    default:
      return `Running ${toolName}...`;
  }
}

function buildResultSummary(toolName: string, result: unknown): string {
  try {
    if (toolName === "web_search") {
      if (Array.isArray(result)) return `Found ${result.length} results`;
      if (typeof result === "object" && result !== null && "results" in result) {
        const arr = (result as any).results;
        if (Array.isArray(arr)) return `Found ${arr.length} results`;
      }
      const str = typeof result === "string" ? result : JSON.stringify(result);
      return `Fetched ${str.length.toLocaleString()} chars`;
    }
    if (toolName === "fetch_url") {
      const str = typeof result === "string" ? result : JSON.stringify(result);
      return `Read ${str.length.toLocaleString()} chars`;
    }
    if (toolName === "query_knowledge") {
      if (Array.isArray(result)) return `Found ${result.length} chunks`;
      return "Done";
    }
    if (toolName === "save_source") return "Source saved";
    if (toolName === "write_report_section") return "Section written";
    if (toolName === "code_execute") {
      const r = result as any;
      if (r?.exitCode === 0) return "Execution succeeded";
      return `Exit code: ${r?.exitCode ?? "?"}`;
    }
    return "Done";
  } catch {
    return "Done";
  }
}

/**
 * Activity to persist the final research result to the database.
 * Called by the workflow after the agent loop completes.
 */
export async function persistResearchResult(
  reportId: string,
  reportContent: string,
  sources: ResearchSource[],
  sections: ReportSection[],
): Promise<void> {
  // Assemble report from sections if available, otherwise use streamed content
  let finalContent: string;
  if (sections.length > 0) {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    finalContent = sorted.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
  } else {
    finalContent = reportContent;
  }

  // Extract title from first heading if present
  let title: string | null = null;
  const titleMatch = finalContent.match(/^#\s+(.+)/m);
  if (titleMatch) {
    title = titleMatch[1].trim().slice(0, 80);
  }

  await db
    .update(researchReports)
    .set({
      reportContent: finalContent,
      title,
      sources: sources.map((s) => ({
        url: s.url,
        title: s.title,
        summary: s.summary,
        relevance: s.relevance,
      })),
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(researchReports.id, reportId));
}
