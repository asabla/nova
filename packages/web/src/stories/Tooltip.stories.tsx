import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tooltip } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";
import { Settings, Trash2, Copy, Info } from "lucide-react";

const meta: Meta<typeof Tooltip> = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  argTypes: {
    content: { control: "text" },
    side: { control: "select", options: ["top", "bottom", "left", "right"] },
    delayMs: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Top: Story = {
  args: {
    content: "This is a tooltip",
    side: "top",
    children: <Button variant="secondary">Hover me</Button>,
  },
};

export const Bottom: Story = {
  args: {
    content: "Tooltip below",
    side: "bottom",
    children: <Button variant="secondary">Hover me</Button>,
  },
};

export const Left: Story = {
  args: {
    content: "Left tooltip",
    side: "left",
    children: <Button variant="secondary">Hover me</Button>,
  },
};

export const Right: Story = {
  args: {
    content: "Right tooltip",
    side: "right",
    children: <Button variant="secondary">Hover me</Button>,
  },
};

export const OnIconButton: Story = {
  render: () => (
    <Tooltip content="Settings">
      <button className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-secondary transition-colors">
        <Settings className="h-4 w-4" />
      </button>
    </Tooltip>
  ),
};

/** Showcases all tooltip positions and use cases */
export const AllPositions: Story = {
  render: () => (
    <div className="space-y-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-6">Positions</p>
        <div className="flex items-center justify-center gap-8">
          <Tooltip content="Top tooltip" side="top">
            <Button variant="secondary" size="sm">Top</Button>
          </Tooltip>
          <Tooltip content="Bottom tooltip" side="bottom">
            <Button variant="secondary" size="sm">Bottom</Button>
          </Tooltip>
          <Tooltip content="Left tooltip" side="left">
            <Button variant="secondary" size="sm">Left</Button>
          </Tooltip>
          <Tooltip content="Right tooltip" side="right">
            <Button variant="secondary" size="sm">Right</Button>
          </Tooltip>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-6">Icon Buttons (common pattern)</p>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-secondary border border-border">
          <Tooltip content="Copy to clipboard">
            <button className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
              <Copy className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Settings">
            <button className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
              <Settings className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="More info">
            <button className="p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
              <Info className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content="Delete conversation" side="bottom">
            <button className="p-2 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-6">On Badges & Text</p>
        <div className="flex items-center gap-4">
          <Tooltip content="128,000 token context window">
            <span className="text-xs text-text-tertiary cursor-help underline decoration-dotted underline-offset-2">
              128K context
            </span>
          </Tooltip>
          <Tooltip content="Keyboard shortcut: Ctrl+K" side="bottom">
            <kbd className="px-2 py-0.5 rounded bg-surface-tertiary border border-border text-xs font-mono text-text-secondary cursor-help">
              Ctrl+K
            </kbd>
          </Tooltip>
        </div>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
