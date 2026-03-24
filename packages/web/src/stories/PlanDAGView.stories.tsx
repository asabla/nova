import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlanDAGView } from "@/components/chat/PlanDAGView";
import type { Plan } from "@nova/shared/types";

const meta: Meta<typeof PlanDAGView> = {
  title: "Chat/PlanDAGView",
  component: PlanDAGView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof PlanDAGView>;

const runningPlan: Plan = {
  reasoning: "Breaking this research task into parallel search and analysis steps for efficiency.",
  approvalRequired: false,
  approved: true,
  nodes: [
    {
      id: "step-1",
      description: "Search for recent papers on transformer architectures",
      tools: ["web_search"],
      dependencies: [],
      status: "completed",
      result: {
        content: "Found 12 relevant papers including 'Attention Is All You Need' and recent survey papers on efficient transformers...",
        toolCallRecords: [{ toolName: "web_search", input: { query: "transformer architectures 2024" }, output: null, durationMs: 1200 }],
        tokensUsed: 450,
        durationMs: 2100,
      },
    },
    {
      id: "step-2",
      description: "Search for benchmarks and performance comparisons",
      tools: ["web_search", "fetch_url"],
      dependencies: [],
      status: "completed",
      result: {
        content: "Collected benchmark data from Papers With Code and HuggingFace leaderboards...",
        toolCallRecords: [
          { toolName: "web_search", input: { query: "transformer benchmarks 2024" }, output: null, durationMs: 900 },
          { toolName: "fetch_url", input: { url: "https://paperswithcode.com" }, output: null, durationMs: 1500 },
        ],
        tokensUsed: 680,
        durationMs: 3200,
      },
    },
    {
      id: "step-3",
      description: "Analyze and compare the findings from both searches",
      tools: ["code_execute"],
      dependencies: ["step-1", "step-2"],
      status: "running",
    },
    {
      id: "step-4",
      description: "Generate summary report with visualizations",
      tools: ["code_execute"],
      dependencies: ["step-3"],
      status: "pending",
    },
  ],
};

export const Running: Story = {
  args: {
    plan: runningPlan,
    isRunning: true,
  },
};

const completedPlan: Plan = {
  reasoning: "Sequential steps to fetch and process data.",
  approvalRequired: false,
  approved: true,
  nodes: [
    {
      id: "step-1",
      description: "Fetch the dataset from the API",
      tools: ["fetch_url"],
      dependencies: [],
      status: "completed",
      result: { content: "Retrieved 5,200 records", toolCallRecords: [], tokensUsed: 200, durationMs: 1800 },
    },
    {
      id: "step-2",
      description: "Parse and clean the data",
      tools: ["code_execute"],
      dependencies: ["step-1"],
      status: "completed",
      result: { content: "Cleaned dataset: 4,980 valid records", toolCallRecords: [], tokensUsed: 350, durationMs: 2200 },
    },
    {
      id: "step-3",
      description: "Generate analysis charts",
      tools: ["code_execute"],
      dependencies: ["step-2"],
      status: "completed",
      result: { content: "Created 3 charts: distribution, trends, correlations", toolCallRecords: [], tokensUsed: 500, durationMs: 3100 },
    },
  ],
};

export const Completed: Story = {
  args: {
    plan: completedPlan,
    isRunning: false,
  },
};

export const CollapsedByDefault: Story = {
  args: {
    plan: completedPlan,
    isRunning: false,
    defaultCollapsed: true,
  },
};

const failedPlan: Plan = {
  reasoning: "Multi-step research with a failing node.",
  approvalRequired: false,
  approved: true,
  nodes: [
    {
      id: "step-1",
      description: "Search for data sources",
      tools: ["web_search"],
      dependencies: [],
      status: "completed",
      result: { content: "Found 3 sources", toolCallRecords: [], tokensUsed: 200, durationMs: 1500 },
    },
    {
      id: "step-2",
      description: "Fetch restricted database endpoint",
      tools: ["fetch_url"],
      dependencies: ["step-1"],
      status: "failed",
    },
    {
      id: "step-3",
      description: "Analyze combined data",
      tools: ["code_execute"],
      dependencies: ["step-2"],
      status: "skipped",
    },
  ],
};

export const WithFailure: Story = {
  args: {
    plan: failedPlan,
    isRunning: false,
  },
};

const approvalPlan: Plan = {
  reasoning: "This plan requires user approval before executing expensive operations.",
  approvalRequired: true,
  approved: false,
  nodes: [
    {
      id: "step-1",
      description: "Search for relevant APIs",
      tools: ["web_search"],
      dependencies: [],
      status: "pending",
    },
    {
      id: "step-2",
      description: "Execute integration script",
      tools: ["code_execute"],
      dependencies: ["step-1"],
      status: "pending",
    },
  ],
};

export const AwaitingApproval: Story = {
  args: {
    plan: approvalPlan,
    isRunning: false,
  },
};
