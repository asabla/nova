import { useState, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressBar } from "@/components/ui/ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
    size: { control: "select", options: ["sm", "md", "lg"] },
    variant: { control: "select", options: ["default", "success", "warning", "danger"] },
    showValue: { control: "boolean" },
    indeterminate: { control: "boolean" },
    animated: { control: "boolean" },
    label: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {
  args: { value: 65 },
};

export const WithLabel: Story = {
  args: {
    value: 72,
    label: "Storage Used",
    showValue: true,
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <ProgressBar value={60} size="sm" label="Small" showValue />
      <ProgressBar value={60} size="md" label="Medium" showValue />
      <ProgressBar value={60} size="lg" label="Large" showValue />
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <ProgressBar value={45} variant="default" label="Default" showValue />
      <ProgressBar value={100} variant="success" label="Complete" showValue />
      <ProgressBar value={78} variant="warning" label="Nearing limit" showValue />
      <ProgressBar value={95} variant="danger" label="Critical" showValue />
    </div>
  ),
};

export const Indeterminate: Story = {
  args: { indeterminate: true, label: "Loading…" },
};

export const Animated: Story = {
  args: { value: 60, animated: true, label: "Processing", showValue: true },
};

function LiveProgress() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setValue((v) => {
        if (v >= 100) return 0;
        return v + Math.random() * 8;
      });
    }, 400);
    return () => clearInterval(timer);
  }, []);

  const rounded = Math.min(100, Math.round(value));
  const variant = rounded >= 90 ? "danger" : rounded >= 70 ? "warning" : rounded >= 100 ? "success" : "default";

  return (
    <div className="w-80">
      <ProgressBar
        value={rounded}
        variant={variant}
        label="Token budget"
        showValue
        size="md"
      />
    </div>
  );
}

export const LiveDemo: Story = {
  render: () => <LiveProgress />,
};

/** Showcases all progress bar states */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10 w-96">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Sizes</p>
        <div className="space-y-4">
          <ProgressBar value={55} size="sm" />
          <ProgressBar value={55} size="md" />
          <ProgressBar value={55} size="lg" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Variants</p>
        <div className="space-y-4">
          <ProgressBar value={45} variant="default" label="Primary" showValue />
          <ProgressBar value={100} variant="success" label="Complete" showValue />
          <ProgressBar value={78} variant="warning" label="Warning" showValue />
          <ProgressBar value={95} variant="danger" label="Critical" showValue />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">States</p>
        <div className="space-y-4">
          <ProgressBar value={0} label="Empty" showValue />
          <ProgressBar value={33} label="In progress" showValue />
          <ProgressBar value={100} variant="success" label="Complete" showValue />
          <ProgressBar indeterminate label="Indeterminate" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Real-world</p>
        <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-4">
          <ProgressBar value={72} label="Storage (7.2 GB / 10 GB)" showValue size="sm" />
          <ProgressBar value={45} variant="warning" label="Token budget (45K / 100K)" showValue size="sm" />
          <ProgressBar indeterminate label="Indexing knowledge base…" size="sm" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Live</p>
        <LiveProgress />
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
