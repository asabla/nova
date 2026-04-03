import { useEffect, useRef, useState } from "react";
import type { ActiveTool, AgentFlowState } from "../../hooks/useSSE";

type Phase = "waiting" | "assessing" | "tooling";

const PHASE_TEXTS: Record<Phase, string[]> = {
  waiting: [
    "Thinking\u2026",
    "Analyzing your request\u2026",
    "Preparing response\u2026",
    "Working on it\u2026",
    "Processing your input\u2026",
    "Considering the best angle\u2026",
    "Reviewing context\u2026",
    "Formulating thoughts\u2026",
    "Connecting the dots\u2026",
    "Exploring possibilities\u2026",
    "Weighing different approaches\u2026",
    "Piecing things together\u2026",
    "Looking at this from all sides\u2026",
    "Gathering my thoughts\u2026",
    "Almost there\u2026",
    "Digging into the details\u2026",
    "Putting it all together\u2026",
    "Crafting a response\u2026",
    "Building on what I know\u2026",
    "Reasoning through this\u2026",
    "Taking a closer look\u2026",
    "Working through the nuances\u2026",
    "Making sense of the context\u2026",
    "Evaluating options\u2026",
    "Organizing my thoughts\u2026",
    "Drawing from relevant knowledge\u2026",
    "Thinking this through carefully\u2026",
    "Structuring the response\u2026",
    "Refining my answer\u2026",
    "Pulling everything together\u2026",
    "Synthesizing information\u2026",
    "Cross-referencing details\u2026",
    "Mapping out the answer\u2026",
    "Checking my reasoning\u2026",
    "Finalizing my thoughts\u2026",
  ],
  assessing: [
    "Assessing complexity\u2026",
    "Choosing the best approach\u2026",
    "Planning response\u2026",
    "Evaluating the scope\u2026",
    "Determining the right strategy\u2026",
    "Figuring out the best path forward\u2026",
    "Breaking down the problem\u2026",
    "Deciding how to tackle this\u2026",
  ],
  tooling: [], // derived dynamically
};

const TOOL_STATUS_TEXT: Record<string, string> = {
  web_search: "Searching the web\u2026",
  fetch_url: "Fetching page\u2026",
  code_execute: "Running code\u2026",
  invoke_agent: "Delegating to agent\u2026",
  read_file: "Reading file\u2026",
  search_workspace: "Searching workspace\u2026",
  write_file: "Writing file\u2026",
  create_file: "Creating file\u2026",
  query_knowledge: "Searching knowledge base\u2026",
  generate_image: "Generating image\u2026",
  analyze_image: "Analyzing image\u2026",
  calculate: "Calculating\u2026",
  summarize: "Summarizing content\u2026",
  translate: "Translating\u2026",
  extract_data: "Extracting data\u2026",
  parse_document: "Parsing document\u2026",
  send_email: "Sending email\u2026",
  create_chart: "Creating chart\u2026",
  run_sql: "Running query\u2026",
  api_call: "Calling API\u2026",
};

function derivePhase(activeTools?: ActiveTool[], agentFlow?: AgentFlowState): Phase {
  if (activeTools?.some((t) => t.status === "running")) return "tooling";
  if (agentFlow?.tier) return "assessing";
  return "waiting";
}

function getToolText(activeTools?: ActiveTool[]): string {
  const running = activeTools?.find((t) => t.status === "running");
  if (!running) return "Using tools\u2026";
  return TOOL_STATUS_TEXT[running.name] ?? "Using tools\u2026";
}

interface Props {
  activeTools?: ActiveTool[];
  agentFlow?: AgentFlowState;
}

export function AnimatedOrb() {
  return (
    <div className="h-7 w-7 relative flex items-center justify-center">
      {/* Expanding ring — radiates outward and fades */}
      <div
        className="absolute inset-0 rounded-full bg-primary/10"
        style={{ animation: "orb-ring 3s ease-out infinite" }}
        aria-hidden="true"
      />
      {/* Outer breathing layer */}
      <div
        className="absolute inset-0 rounded-full bg-primary/15"
        style={{ animation: "orb-breathe 2.4s ease-in-out infinite" }}
        aria-hidden="true"
      />
      {/* Inner core — counter-phase for depth */}
      <div
        className="absolute inset-1.5 rounded-full bg-primary/30"
        style={{ animation: "orb-core 2.4s ease-in-out infinite 1.2s" }}
        aria-hidden="true"
      />
      {/* Center dot — solid anchor */}
      <div
        className="relative h-2 w-2 rounded-full bg-primary/70"
        aria-hidden="true"
      />
    </div>
  );
}

export function StreamingStatusIndicator({ activeTools, agentFlow }: Props) {
  const phase = derivePhase(activeTools, agentFlow);
  const [textIndex, setTextIndex] = useState(0);
  const prevPhaseRef = useRef(phase);

  // Reset text index on phase change
  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      setTextIndex(0);
      prevPhaseRef.current = phase;
    }
  }, [phase]);

  // Cycle text every 3s
  useEffect(() => {
    if (phase === "tooling") return; // tooling text is derived, not cycled
    const texts = PHASE_TEXTS[phase];
    if (texts.length <= 1) return;

    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % texts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phase]);

  const displayText =
    phase === "tooling"
      ? getToolText(activeTools)
      : PHASE_TEXTS[phase][textIndex % PHASE_TEXTS[phase].length];

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="relative h-5 overflow-hidden">
        <span
          key={displayText}
          className="block text-[13px] text-text-secondary"
          style={{
            animation: "status-text-enter 400ms cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          {displayText}
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {displayText}
      </span>
    </div>
  );
}
