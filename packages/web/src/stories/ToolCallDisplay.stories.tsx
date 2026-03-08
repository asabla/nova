import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ToolCallDisplay } from "@/components/chat/ToolCallDisplay";
import { ToolCallPanel } from "@/components/chat/ToolCallPanel";

// ── Mock tool calls ──────────────────────────────────────────────────────

const searchTool = {
  id: "tc-1",
  name: "web_search",
  arguments: { query: "React 19 new features", max_results: 5 },
  status: "success" as const,
  result: JSON.stringify([
    { title: "React 19 Release Notes", url: "https://react.dev/blog/react-19" },
    { title: "What's New in React 19", url: "https://example.com/react-19" },
  ], null, 2),
};

const runningTool = {
  id: "tc-2",
  name: "code_interpreter",
  arguments: { code: "import pandas as pd\ndf = pd.read_csv('data.csv')\ndf.describe()" },
  status: "running" as const,
};

const pendingTool = {
  id: "tc-3",
  name: "file_write",
  arguments: { path: "/app/config.json", content: '{"debug": true}' },
  status: "pending" as const,
};

const failedTool = {
  id: "tc-4",
  name: "database_query",
  arguments: { sql: "SELECT * FROM users WHERE active = true" },
  status: "failed" as const,
  result: "Error: Connection timeout after 30s",
};

const approvalTool = {
  id: "tc-5",
  name: "send_email",
  arguments: { to: "team@example.com", subject: "Deploy notification", body: "v2.1 deployed" },
  status: "approval_required" as const,
};

// ── ToolCallDisplay stories ──────────────────────────────────────────────

const displayMeta: Meta<typeof ToolCallDisplay> = {
  title: "Chat/ToolCallDisplay",
  component: ToolCallDisplay,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    onApprove: fn(),
    onReject: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default displayMeta;
type DisplayStory = StoryObj<typeof ToolCallDisplay>;

/** Single successful tool call */
export const Success: DisplayStory = {
  args: {
    toolCalls: [searchTool],
  },
};

/** Tool call currently running */
export const Running: DisplayStory = {
  args: {
    toolCalls: [runningTool],
  },
};

/** Tool call pending execution */
export const Pending: DisplayStory = {
  args: {
    toolCalls: [pendingTool],
  },
};

/** Failed tool call with error result */
export const Failed: DisplayStory = {
  args: {
    toolCalls: [failedTool],
  },
};

/** Tool requiring user approval before execution */
export const ApprovalRequired: DisplayStory = {
  args: {
    toolCalls: [approvalTool],
  },
};

/** Multiple tool calls in various states */
export const MixedStates: DisplayStory = {
  args: {
    toolCalls: [searchTool, runningTool, failedTool, approvalTool],
  },
};

/** Empty state — no tool calls */
export const Empty: DisplayStory = {
  args: {
    toolCalls: [],
  },
};

// ── ToolCallPanel stories (rendered as separate section) ─────────────────

const panelToolCalls = [
  {
    id: "ptc-1",
    name: "web_search",
    arguments: { query: "TypeScript 5.5 features" },
    status: "completed" as const,
    result: '{"results": [{"title": "TS 5.5 Release"}]}',
    durationMs: 342,
  },
  {
    id: "ptc-2",
    name: "code_interpreter",
    arguments: { code: "console.log('hello')" },
    status: "running" as const,
    startedAt: new Date().toISOString(),
  },
  {
    id: "ptc-3",
    name: "file_write",
    arguments: { path: "/tmp/out.txt", content: "data" },
    status: "pending" as const,
  },
  {
    id: "ptc-4",
    name: "api_call",
    arguments: { url: "https://api.example.com/data", method: "GET" },
    status: "failed" as const,
    error: "Connection refused: ECONNREFUSED 127.0.0.1:8080",
    durationMs: 5023,
  },
];

/** ToolCallPanel — expanded view showing all tool call states */
export const Panel: DisplayStory = {
  render: () => (
    <ToolCallPanel
      toolCalls={panelToolCalls}
      approvalMode="always-ask"
      onApprove={fn()}
      onReject={fn()}
      onRetry={fn()}
      isExpanded
    />
  ),
};

/** ToolCallPanel — collapsed header view */
export const PanelCollapsed: DisplayStory = {
  render: () => (
    <ToolCallPanel
      toolCalls={panelToolCalls}
      approvalMode="auto"
      isExpanded={false}
    />
  ),
};
