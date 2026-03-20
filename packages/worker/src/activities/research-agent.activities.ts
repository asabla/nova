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

const RESEARCH_SYSTEM_PROMPT = `You are a Deep Research Agent. Your goal is to produce a comprehensive, data-driven research report with genuine analytical depth — not just a summary of sources.

## Workflow

Your research follows iterative gather → analyze → deepen cycles, not a single pass:

1. **Plan**: Break the query into key research questions
2. **Gather**: Collect data from available sources (knowledge collections first, then web)
3. **Analyze**: Use code_execute to process, compare, and quantify what you found
4. **Deepen**: Based on analysis, identify gaps and run follow-up queries
5. **Record**: Call save_source for every valuable source
6. **Write**: Build the report section by section with write_report_section

Repeat steps 2-4 multiple times. A single pass of searching and summarizing is not enough.

## Multi-Tool Integration Patterns

### Data Analysis Pattern
When you retrieve text data from query_knowledge, fetch_files, or web sources, pass it into code_execute for rigorous analysis. Embed the data as a Python string or JSON literal in your code:

Example flow:
1. query_knowledge → get results about topic X
2. code_execute → parse the text, count occurrences, extract dates/numbers, build a comparison table
3. Use the computed results in your report with specific numbers and statistics

### Chart Generation Pattern
Use code_execute with Python + matplotlib/json to create data visualizations:
- Bar/line charts comparing metrics across sources
- Timeline visualizations of events
- Distribution analysis of quantitative data
Output chart data as a JSON object, then embed it in a \`\`\`widget block in your report.

### Iterative Research Pattern
After initial queries, analyze what you have and what's missing:
1. First pass: broad queries to map the landscape
2. code_execute: analyze coverage gaps, contradictions, or patterns needing deeper investigation
3. Second pass: targeted queries to fill gaps
4. code_execute: cross-reference and validate findings across sources

### Structured Data Processing
When you receive text data from query_knowledge or fetch_files, you can pass it into code_execute by embedding it as a Python string or JSON literal. This lets you:
- Count and aggregate (frequency of terms, timeline of events)
- Compare and contrast (side-by-side feature/claim matrices)
- Extract patterns (regex extraction of dates, numbers, names)
- Build tables (structured comparison from unstructured text)
- Compute statistics (averages, distributions, trends)

## Using code_execute

Use code_execute freely and often — it's your analytical engine. Good uses include:
- Parsing and structuring data gathered from web_search, query_knowledge, or fetch_files
- Building comparison tables from multiple sources
- Counting occurrences, computing statistics, identifying trends
- Generating chart data (output as JSON for widget blocks)
- Cross-referencing findings to find contradictions or consensus
- Processing CSV/JSON data from attached files
- Timeline generation from extracted dates

Embed gathered data as string literals in your Python/JS code. Don't hesitate to run multiple code executions throughout your research — each one adds analytical rigor.

## Report Structure
Write sections in this order:
0. Executive Summary — 2-3 paragraph overview with key quantitative findings
1. Key Findings — bullet points with specific data points, not vague claims
2-N. Detailed Analysis sections — deep dives backed by data analysis
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
- Include specific numbers, percentages, and comparisons — not just qualitative statements

## Important
- Be thorough: search multiple queries, cross-reference sources
- Be factual: cite sources for every major claim
- Be analytical: don't just summarize — synthesize, quantify, and identify patterns
- Use code_execute to back up claims with data analysis
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
  const hasKnowledge = input.sources.knowledgeCollectionIds.length > 0;
  const hasFiles = input.sources.fileIds.length > 0;

  const sourceContext: string[] = [];
  if (hasKnowledge) {
    sourceContext.push(
      `- ${input.sources.knowledgeCollectionIds.length} knowledge collection(s) selected. **Start by querying them** with query_knowledge before searching the web — internal data should anchor your analysis.`,
    );
    sourceContext.push(
      `- After retrieving knowledge data, use code_execute to analyze patterns, extract statistics, or build comparison tables from the text.`,
    );
  }
  if (hasFiles) {
    sourceContext.push(
      `- ${input.sources.fileIds.length} file(s) attached. Use fetch_files to read them, then code_execute to process and analyze the data (parse CSV/JSON, compute statistics, extract patterns).`,
    );
  }
  if (input.sources.webSearch) {
    sourceContext.push("- Web search is ENABLED. Use web_search and fetch_url to find sources.");
  } else {
    sourceContext.push("- Web search is DISABLED. Do NOT use web_search or fetch_url.");
  }

  const analyticsGuidance = (hasKnowledge || hasFiles)
    ? `\n## Analysis Approach
- Query internal sources first, then supplement with web search
- After each batch of data retrieval, use code_execute to analyze what you've gathered
- Look for patterns, contradictions, and gaps that warrant follow-up queries
- Aim for at least 3-5 code_execute calls to ensure analytical rigor`
    : `\n## Analysis Approach
- After gathering sources, use code_execute to analyze and cross-reference findings
- Don't just summarize — compute comparisons, extract patterns, and quantify claims
- Aim for multiple code_execute calls throughout your research`;

  const userMessage = `Research this topic thoroughly and produce a comprehensive, data-driven report:

${input.query}

## Available Sources
${sourceContext.join("\n")}
${analyticsGuidance}

Begin by planning your research approach, then iterate through gather → analyze → deepen cycles before writing the report section by section.`;

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
  query: string,
  reportContent: string,
  sources: ResearchSource[],
  sections: ReportSection[],
): Promise<void> {
  // Assemble report from sections if available, otherwise use streamed content
  let finalContent: string;
  if (sections.length > 0) {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    finalContent = sorted.map((s) => {
      // Avoid duplicate headings if the content already starts with one
      const trimmed = s.content.trimStart();
      if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
        return s.content;
      }
      return `## ${s.heading}\n\n${s.content}`;
    }).join("\n\n");
  } else {
    finalContent = reportContent;
  }

  // Generate a title from the content or fall back to the query
  let title: string | null = null;
  const h1Match = finalContent.match(/^#\s+(.+)/m);
  if (h1Match) {
    title = h1Match[1].trim().slice(0, 80);
  } else {
    // Use the query — it's the most meaningful identifier
    title = query.slice(0, 80);
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
