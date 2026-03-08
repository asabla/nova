import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "@/components/ui/Checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    indeterminate: { control: "boolean" },
    disabled: { control: "boolean" },
    label: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

function InteractiveCheckbox(props: React.ComponentProps<typeof Checkbox>) {
  const [checked, setChecked] = useState(props.checked ?? false);
  return <Checkbox {...props} checked={checked} onChange={setChecked} />;
}

export const Default: Story = {
  render: () => <InteractiveCheckbox />,
};

export const Checked: Story = {
  render: () => <InteractiveCheckbox checked />,
};

export const Indeterminate: Story = {
  render: () => <Checkbox checked indeterminate />,
};

export const WithLabel: Story = {
  render: () => <InteractiveCheckbox label="Enable notifications" />,
};

export const WithDescription: Story = {
  render: () => (
    <InteractiveCheckbox
      checked
      label="Save conversation history"
      description="Store all conversations for search and analytics."
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="space-y-3">
      <Checkbox disabled label="Disabled unchecked" />
      <Checkbox checked disabled label="Disabled checked" />
    </div>
  ),
};

export const CheckboxGroup: Story = {
  render: () => {
    const Group = () => {
      const [selected, setSelected] = useState<Set<string>>(new Set(["reasoning", "search"]));

      const toggle = (key: string) => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      };

      const capabilities = [
        { key: "reasoning", label: "Reasoning", desc: "Multi-step logical analysis" },
        { key: "search", label: "Web Search", desc: "Search the internet for current information" },
        { key: "code", label: "Code Execution", desc: "Run code in a sandboxed environment" },
        { key: "vision", label: "Vision", desc: "Analyze images and screenshots" },
        { key: "files", label: "File Access", desc: "Read and write to the knowledge base" },
      ];

      const allChecked = capabilities.every((c) => selected.has(c.key));
      const someChecked = capabilities.some((c) => selected.has(c.key));

      return (
        <div className="w-80 space-y-3">
          <Checkbox
            checked={allChecked}
            indeterminate={someChecked && !allChecked}
            onChange={() => {
              if (allChecked) setSelected(new Set());
              else setSelected(new Set(capabilities.map((c) => c.key)));
            }}
            label="Select all capabilities"
          />
          <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
            {capabilities.map((cap) => (
              <Checkbox
                key={cap.key}
                checked={selected.has(cap.key)}
                onChange={() => toggle(cap.key)}
                label={cap.label}
                description={cap.desc}
              />
            ))}
          </div>
        </div>
      );
    };
    return <Group />;
  },
};

/** Showcases all checkbox states and patterns */
export const AllVariants: Story = {
  render: () => {
    const Group = () => {
      const [selected, setSelected] = useState<Set<string>>(new Set(["a", "c"]));
      const toggle = (key: string) => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key); else next.add(key);
          return next;
        });
      };
      const allChecked = selected.size === 4;
      const someChecked = selected.size > 0;

      return (
        <div className="space-y-10 max-w-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">States</p>
            <div className="space-y-3">
              <InteractiveCheckbox label="Unchecked" />
              <InteractiveCheckbox checked label="Checked" />
              <Checkbox checked indeterminate label="Indeterminate" />
              <Checkbox disabled label="Disabled" />
              <Checkbox checked disabled label="Disabled checked" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">With Descriptions</p>
            <div className="space-y-3">
              <InteractiveCheckbox
                checked
                label="Enable streaming"
                description="Show responses as they are generated."
              />
              <InteractiveCheckbox
                label="Auto-select model"
                description="Let NOVA pick the best model per query."
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Select All Pattern</p>
            <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-3">
              <Checkbox
                checked={allChecked}
                indeterminate={someChecked && !allChecked}
                onChange={() => {
                  if (allChecked) setSelected(new Set());
                  else setSelected(new Set(["a", "b", "c", "d"]));
                }}
                label="Select all"
              />
              <div className="ml-6 space-y-2 border-l-2 border-border pl-4">
                {[
                  { key: "a", label: "Option A" },
                  { key: "b", label: "Option B" },
                  { key: "c", label: "Option C" },
                  { key: "d", label: "Option D" },
                ].map((opt) => (
                  <Checkbox
                    key={opt.key}
                    checked={selected.has(opt.key)}
                    onChange={() => toggle(opt.key)}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    };
    return <Group />;
  },
  parameters: { layout: "padded" },
};
