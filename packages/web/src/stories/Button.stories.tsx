import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/ui/Button";
import { Plus, Send, Trash2, Download, Settings, Sparkles } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  args: {
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger"],
      description: "Visual style variant",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Button size",
    },
    loading: {
      control: "boolean",
      description: "Shows a loading spinner and disables the button",
    },
    disabled: {
      control: "boolean",
      description: "Disables the button",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary Button",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost Button",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "Delete",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "Small",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large Button",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "Saving...",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled",
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Sparkles className="h-4 w-4" />
        Generate
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    variant: "ghost",
    size: "sm",
    children: <Settings className="h-4 w-4" />,
    "aria-label": "Settings",
  },
};

/** Showcases all variants side by side */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Variants</p>
        <div className="flex items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Sizes</p>
        <div className="flex items-end gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">States</p>
        <div className="flex items-center gap-3">
          <Button>Default</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">With Icons</p>
        <div className="flex items-center gap-3">
          <Button><Plus className="h-4 w-4" /> New Chat</Button>
          <Button variant="secondary"><Download className="h-4 w-4" /> Export</Button>
          <Button variant="ghost"><Settings className="h-4 w-4" /> Settings</Button>
          <Button variant="danger"><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Real-World Examples</p>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-secondary border border-border">
          <Button variant="ghost" size="sm">Cancel</Button>
          <Button size="sm"><Send className="h-3.5 w-3.5" /> Send Message</Button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
