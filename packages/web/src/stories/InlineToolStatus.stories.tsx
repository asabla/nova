import type { Meta, StoryObj } from "@storybook/react-vite";
import { InlineToolStatus, InlineToolStatusList, ToolSummaryCompact } from "@/components/chat/InlineToolStatus";
import type { ActiveTool } from "@/hooks/useSSE";

const meta: Meta<typeof InlineToolStatus> = {
  title: "Chat/InlineToolStatus",
  component: InlineToolStatus,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof InlineToolStatus>;

// --- Individual tool stories ---

export const WebSearchRunning: Story = {
  args: {
    tool: { name: "web_search", status: "running", args: { query: "latest React 19 features" } },
  },
};

export const WebSearchCompleted: Story = {
  args: {
    tool: { name: "web_search", status: "completed", args: { query: "latest React 19 features" }, resultSummary: "Found 8 results" },
  },
};

export const FetchUrlRunning: Story = {
  args: {
    tool: { name: "fetch_url", status: "running", args: { url: "https://react.dev/blog" } },
  },
};

export const CodeExecuteRunning: Story = {
  args: {
    tool: { name: "code_execute", status: "running", args: { language: "python", code: "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.describe())" } },
  },
};

export const CodeExecuteCompleted: Story = {
  args: {
    tool: { name: "code_execute", status: "completed", args: { language: "python" }, resultSummary: "Executed python code" },
  },
};

export const InvokeAgentRunning: Story = {
  args: {
    tool: { name: "invoke_agent", status: "running", args: { agent_name: "Research Assistant", task: "Find relevant papers on transformer architectures" } },
  },
};

export const InvokeAgentCompleted: Story = {
  args: {
    tool: { name: "invoke_agent", status: "completed", args: { agent_name: "Research Assistant" }, resultSummary: "Delegated to Research Assistant" },
  },
};

export const ReadFileRunning: Story = {
  args: {
    tool: { name: "read_file", status: "running", args: { filename: "quarterly-report.pdf" } },
  },
};

export const SearchWorkspaceRunning: Story = {
  args: {
    tool: { name: "search_workspace", status: "running", args: { query: "authentication middleware", mode: "semantic" } },
  },
};

export const ToolFailed: Story = {
  args: {
    tool: { name: "fetch_url", status: "failed", args: { url: "https://example.com/broken" } },
  },
};

export const CustomToolRunning: Story = {
  args: {
    tool: { name: "generate_summary", status: "running", args: { input: "Long document text..." } },
  },
};

// --- List stories ---

const multipleTools: ActiveTool[] = [
  { name: "web_search", status: "completed", args: { query: "AI safety research" }, resultSummary: "Found 12 results" },
  { name: "fetch_url", status: "completed", args: { url: "https://arxiv.org/paper/123" }, resultSummary: "Read 15,432 chars" },
  { name: "code_execute", status: "running", args: { language: "python" } },
  { name: "invoke_agent", status: "running", args: { agent_name: "Data Analyst", task: "Analyze the dataset" } },
];

export const ToolList: StoryObj = {
  render: () => <InlineToolStatusList tools={multipleTools} />,
};

// --- ToolSummaryCompact stories ---

const completedTools: ActiveTool[] = [
  { name: "web_search", status: "completed", resultSummary: "Found 5 results" },
  { name: "web_search", status: "completed", resultSummary: "Found 3 results" },
  { name: "fetch_url", status: "completed", resultSummary: "Read 8,200 chars" },
];

export const SummaryFewTools: StoryObj = {
  name: "Summary (auto-expanded, ≤3 tools)",
  render: () => <ToolSummaryCompact tools={completedTools} />,
};

const manyTools: ActiveTool[] = [
  { name: "web_search", status: "completed", resultSummary: "Found 5 results" },
  { name: "web_search", status: "completed", resultSummary: "Found 3 results" },
  { name: "fetch_url", status: "completed", resultSummary: "Read 8,200 chars" },
  { name: "code_execute", status: "completed", resultSummary: "Executed python code" },
  { name: "read_file", status: "completed", args: { filename: "data.csv" }, resultSummary: "Read 2,100 chars" },
];

export const SummaryManyTools: StoryObj = {
  name: "Summary (collapsed, >3 tools)",
  render: () => <ToolSummaryCompact tools={manyTools} />,
};

const toolsWithError: ActiveTool[] = [
  { name: "web_search", status: "completed", resultSummary: "Found 3 results" },
  { name: "fetch_url", status: "failed", args: { url: "https://example.com" } },
  { name: "invoke_agent", status: "completed", resultSummary: "Delegated to Code Reviewer" },
];

export const SummaryWithError: StoryObj = {
  name: "Summary (with error)",
  render: () => <ToolSummaryCompact tools={toolsWithError} />,
};
