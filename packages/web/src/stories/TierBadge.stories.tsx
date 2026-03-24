import type { Meta, StoryObj } from "@storybook/react-vite";
import { TierBadge } from "@/components/chat/TierBadge";

const meta: Meta<typeof TierBadge> = {
  title: "Chat/TierBadge",
  component: TierBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof TierBadge>;

export const Direct: Story = {
  args: {
    tier: "direct",
  },
};

export const DirectWithReasoning: Story = {
  args: {
    tier: "direct",
    reasoning: "This is a simple factual question that can be answered directly without tools or multi-step planning.",
  },
};

export const Sequential: Story = {
  args: {
    tier: "sequential",
    reasoning: "The user wants me to search for information and then summarize it. This requires a web search followed by synthesis — a linear chain of steps.",
  },
};

export const Orchestrated: Story = {
  args: {
    tier: "orchestrated",
    reasoning: "This research task requires searching multiple sources in parallel, fetching several pages, executing analysis code, and then synthesizing everything into a report. Multiple independent branches can run concurrently.",
  },
};

export const NoReasoning: Story = {
  name: "Sequential (no reasoning)",
  args: {
    tier: "sequential",
    reasoning: null,
  },
};

export const AllTiers: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <TierBadge tier="direct" reasoning="Simple question, no tools needed." />
      <TierBadge tier="sequential" reasoning="Linear search-then-summarize flow." />
      <TierBadge tier="orchestrated" reasoning="Complex research with parallel branches." />
    </div>
  ),
};
