import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { RateLimitWarning } from "@/components/chat/RateLimitWarning";

const meta: Meta<typeof RateLimitWarning> = {
  title: "Chat/RateLimitWarning",
  component: RateLimitWarning,
  args: {
    onDismiss: fn(),
  },
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof RateLimitWarning>;

export const WarningLevel: Story = {
  args: {
    currentUsage: 85,
    limit: 100,
    warningThreshold: 0.8,
  },
};

export const NearLimit: Story = {
  args: {
    currentUsage: 97,
    limit: 100,
    warningThreshold: 0.8,
  },
};

export const Limited: Story = {
  args: {
    currentUsage: 100,
    limit: 100,
    isLimited: true,
    resetInSeconds: 120,
  },
};

export const BelowThreshold: Story = {
  args: {
    currentUsage: 50,
    limit: 100,
    warningThreshold: 0.8,
  },
};

/** Showcases the rate limit warning progression */
export const Progression: Story = {
  render: () => (
    <div className="space-y-6 max-w-lg">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Below threshold (hidden)</p>
        <div className="p-3 rounded-lg bg-surface-secondary border border-border text-xs text-text-tertiary">
          50/100 — No warning shown
        </div>
        <RateLimitWarning currentUsage={50} limit={100} warningThreshold={0.8} onDismiss={fn()} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Warning level (80%+)</p>
        <RateLimitWarning currentUsage={82} limit={100} warningThreshold={0.8} onDismiss={fn()} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Critical level (95%+)</p>
        <RateLimitWarning currentUsage={97} limit={100} warningThreshold={0.8} onDismiss={fn()} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-2">Rate limited with countdown</p>
        <RateLimitWarning currentUsage={100} limit={100} isLimited resetInSeconds={90} onDismiss={fn()} />
      </div>
    </div>
  ),
};
