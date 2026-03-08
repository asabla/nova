import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AgentReasoningTrace } from "@/components/chat/AgentReasoningTrace";
import { AgentTraceView } from "@/components/chat/AgentTraceView";

// ── Mock data ────────────────────────────────────────────────────────────

const mockReasoningSteps = [
  {
    id: "s1",
    type: "thought" as const,
    content: "The user wants to analyze sales data. I should first fetch the CSV file and then process it with the code interpreter.",
    timestamp: new Date(Date.now() - 5000).toISOString(),
    duration: 120,
  },
  {
    id: "s2",
    type: "tool_call" as const,
    name: "file_read",
    content: '{"path": "/data/sales_q4.csv"}',
    timestamp: new Date(Date.now() - 4500).toISOString(),
    duration: 340,
  },
  {
    id: "s3",
    type: "tool_result" as const,
    name: "file_read",
    content: "Successfully read 1,247 rows from sales_q4.csv",
    timestamp: new Date(Date.now() - 4000).toISOString(),
    duration: 50,
  },
  {
    id: "s4",
    type: "thought" as const,
    content: "The data contains quarterly sales. I'll compute growth rates and create a summary table.",
    timestamp: new Date(Date.now() - 3500).toISOString(),
    duration: 95,
  },
  {
    id: "s5",
    type: "sub_agent" as const,
    name: "Data Analysis Agent",
    content: "Delegating statistical analysis to specialized sub-agent",
    timestamp: new Date(Date.now() - 3000).toISOString(),
    duration: 2100,
  },
];

const mockTraceSteps = [
  {
    id: "ts1",
    type: "thinking" as const,
    label: "Analyzing user request",
    content: "User wants a summary of the project architecture. I need to examine the codebase structure.",
    status: "completed" as const,
    durationMs: 230,
    tokenCount: 145,
  },
  {
    id: "ts2",
    type: "tool_call" as const,
    label: "Reading project structure",
    toolName: "file_tree",
    content: '{"path": "/src", "depth": 3}',
    status: "completed" as const,
    durationMs: 420,
    tokenCount: 80,
  },
  {
    id: "ts3",
    type: "tool_result" as const,
    label: "File tree result",
    content: "src/\n  components/ (24 files)\n  hooks/ (8 files)\n  stores/ (3 files)\n  lib/ (12 files)",
    status: "completed" as const,
    durationMs: 15,
  },
  {
    id: "ts4",
    type: "sub_agent" as const,
    label: "Architecture Analysis",
    subAgentId: "sub-1",
    subAgentName: "Code Review Agent",
    status: "completed" as const,
    durationMs: 1200,
    tokenCount: 520,
    children: [
      {
        id: "ts4-1",
        type: "thinking" as const,
        label: "Examining patterns",
        content: "Identifying common patterns: component composition, custom hooks, Zustand stores.",
        status: "completed" as const,
        durationMs: 180,
      },
      {
        id: "ts4-2",
        type: "tool_call" as const,
        label: "Reading key files",
        status: "completed" as const,
        durationMs: 300,
      },
    ],
  },
  {
    id: "ts5",
    type: "output" as const,
    label: "Generating summary",
    status: "completed" as const,
    durationMs: 340,
    tokenCount: 280,
  },
];

const runningTraceSteps = [
  {
    id: "r1",
    type: "thinking" as const,
    label: "Planning approach",
    content: "I need to search for relevant documentation first.",
    status: "completed" as const,
    durationMs: 150,
  },
  {
    id: "r2",
    type: "tool_call" as const,
    label: "Searching documentation",
    toolName: "web_search",
    status: "running" as const,
  },
];

const failedTraceSteps = [
  {
    id: "f1",
    type: "thinking" as const,
    label: "Analyzing request",
    status: "completed" as const,
    durationMs: 100,
  },
  {
    id: "f2",
    type: "tool_call" as const,
    label: "Calling external API",
    toolName: "api_request",
    status: "failed" as const,
    error: "ConnectionError: Failed to connect to api.example.com:443 — ECONNREFUSED",
    durationMs: 5000,
  },
];

const waitingInputSteps = [
  {
    id: "w1",
    type: "thinking" as const,
    label: "Evaluating options",
    content: "There are two possible approaches. I need user input to decide.",
    status: "completed" as const,
    durationMs: 200,
  },
  {
    id: "w2",
    type: "user_input" as const,
    label: "Choose approach: A (faster) or B (more thorough)?",
    status: "waiting_input" as const,
  },
];

// ── AgentReasoningTrace Meta ─────────────────────────────────────────────

const meta: Meta<typeof AgentReasoningTrace> = {
  title: "Chat/AgentReasoningTrace",
  component: AgentReasoningTrace,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentReasoningTrace>;

/** Collapsible reasoning trace with multiple step types */
export const Default: Story = {
  args: { steps: mockReasoningSteps },
};

/** Empty steps (renders nothing) */
export const Empty: Story = {
  args: { steps: [] },
};

/** AgentTraceView — completed run */
export const TraceViewCompleted: Story = {
  render: () => (
    <AgentTraceView
      steps={mockTraceSteps}
      agentName="Research Agent"
      totalDurationMs={2205}
      totalTokens={1025}
      maxSteps={10}
    />
  ),
};

/** AgentTraceView — currently running */
export const TraceViewRunning: Story = {
  render: () => (
    <AgentTraceView
      steps={runningTraceSteps}
      agentName="Search Agent"
      isRunning
      onStop={fn()}
      maxSteps={5}
    />
  ),
};

/** AgentTraceView — with a failed step */
export const TraceViewFailed: Story = {
  render: () => (
    <AgentTraceView
      steps={failedTraceSteps}
      agentName="API Agent"
      totalDurationMs={5100}
      onRetryStep={fn()}
    />
  ),
};

/** AgentTraceView — waiting for user input */
export const TraceViewWaitingInput: Story = {
  render: () => (
    <AgentTraceView
      steps={waitingInputSteps}
      agentName="Decision Agent"
      isRunning
      onStop={fn()}
      onRespondToInput={fn()}
    />
  ),
};
