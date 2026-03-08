import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolStatusChip, ToolStatusBar } from "@/components/chat/ToolStatusChip";

const meta: Meta<typeof ToolStatusChip> = {
  title: "Chat/ToolStatusChip",
  component: ToolStatusChip,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof ToolStatusChip>;

export const Running: Story = {
  args: {
    tool: { name: "web_search", status: "running" },
  },
};

export const Completed: Story = {
  args: {
    tool: { name: "web_search", status: "completed" },
  },
};

export const Error: Story = {
  args: {
    tool: { name: "code_execute", status: "error" },
  },
};

export const StatusBar: Story = {
  render: () => (
    <ToolStatusBar
      tools={[
        { name: "web_search", status: "completed" },
        { name: "code_execute", status: "running" },
        { name: "file_read", status: "completed" },
        { name: "database_query", status: "error" },
      ]}
    />
  ),
};

/** All tool status states and patterns */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Individual Chips</p>
        <div className="flex items-center gap-2 flex-wrap">
          <ToolStatusChip tool={{ name: "web_search", status: "running" }} />
          <ToolStatusChip tool={{ name: "code_execute", status: "completed" }} />
          <ToolStatusChip tool={{ name: "file_read", status: "error" }} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Status Bar — Agent Workflow</p>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-surface-secondary border border-border">
            <p className="text-xs text-text-tertiary mb-2">Research task in progress</p>
            <ToolStatusBar
              tools={[
                { name: "web_search", status: "completed" },
                { name: "extract_content", status: "completed" },
                { name: "analyze_data", status: "running" },
                { name: "generate_report", status: "running" },
              ]}
            />
          </div>

          <div className="p-4 rounded-xl bg-surface-secondary border border-border">
            <p className="text-xs text-text-tertiary mb-2">Completed with errors</p>
            <ToolStatusBar
              tools={[
                { name: "fetch_api", status: "completed" },
                { name: "parse_response", status: "error" },
                { name: "retry_fetch", status: "completed" },
                { name: "format_output", status: "completed" },
              ]}
            />
          </div>

          <div className="p-4 rounded-xl bg-surface-secondary border border-border">
            <p className="text-xs text-text-tertiary mb-2">All complete</p>
            <ToolStatusBar
              tools={[
                { name: "search", status: "completed" },
                { name: "summarize", status: "completed" },
                { name: "cite_sources", status: "completed" },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  ),
};
