import type { Meta, StoryObj } from "@storybook/react-vite";
import { SkipNav } from "@/components/ui/SkipNav";

const meta: Meta<typeof SkipNav> = {
  title: "Components/SkipNav",
  component: SkipNav,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SkipNav>;

/** SkipNav link — visually hidden until focused via Tab key. Press Tab to reveal it. */
export const Default: Story = {
  render: () => (
    <div>
      <SkipNav />
      <div id="main-content" className="p-6 rounded-xl border border-border bg-surface-secondary">
        <p className="text-sm text-text-secondary">
          Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-surface text-xs">Tab</kbd> to
          reveal the "Skip to main content" link. It appears at the top-left and is
          only visible when focused (for keyboard and screen reader users).
        </p>
      </div>
    </div>
  ),
};
