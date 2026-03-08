import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "@/components/ui/Switch";

const meta: Meta<typeof Switch> = {
  title: "Components/Switch",
  component: Switch,
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
    size: { control: "select", options: ["sm", "md"] },
    label: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

function InteractiveSwitch(props: React.ComponentProps<typeof Switch>) {
  const [checked, setChecked] = useState(props.checked ?? false);
  return <Switch {...props} checked={checked} onChange={setChecked} />;
}

export const Default: Story = {
  render: () => <InteractiveSwitch />,
};

export const Checked: Story = {
  render: () => <InteractiveSwitch checked />,
};

export const WithLabel: Story = {
  render: () => <InteractiveSwitch checked label="Enable notifications" />,
};

export const WithDescription: Story = {
  render: () => (
    <InteractiveSwitch
      checked
      label="Streaming responses"
      description="Show assistant responses as they're generated in real-time."
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-3">
      <Switch checked={false} disabled label="Disabled off" />
      <Switch checked disabled label="Disabled on" />
    </div>
  ),
};

export const Small: Story = {
  render: () => <InteractiveSwitch size="sm" checked label="Compact toggle" />,
};

/** Showcases all switch states and patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 max-w-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Sizes</p>
        <div className="flex items-center gap-6">
          <div className="text-center space-y-2">
            <InteractiveSwitch size="sm" checked />
            <p className="text-[10px] font-mono text-text-tertiary">sm</p>
          </div>
          <div className="text-center space-y-2">
            <InteractiveSwitch size="md" checked />
            <p className="text-[10px] font-mono text-text-tertiary">md</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">States</p>
        <div className="space-y-3">
          <InteractiveSwitch label="Unchecked" />
          <InteractiveSwitch checked label="Checked" />
          <Switch disabled label="Disabled off" />
          <Switch checked disabled label="Disabled on" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Settings Pattern</p>
        <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-4">
          <InteractiveSwitch
            checked
            label="Enable streaming"
            description="Show responses as they generate."
          />
          <InteractiveSwitch
            label="Auto-select model"
            description="Let NOVA pick the best model per query."
          />
          <InteractiveSwitch
            checked
            label="Save history"
            description="Store conversations for search."
          />
        </div>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
