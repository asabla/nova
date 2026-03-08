import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui/Badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "success", "warning", "danger"],
      description: "Badge color variant",
    },
    children: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { variant: "default", children: "Default" },
};

export const Primary: Story = {
  args: { variant: "primary", children: "Primary" },
};

export const Success: Story = {
  args: { variant: "success", children: "Active" },
};

export const Warning: Story = {
  args: { variant: "warning", children: "Pending" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Error" },
};

/** All badge variants displayed together */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Variants</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default">Default</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Status Labels</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="success">Online</Badge>
          <Badge variant="warning">Idle</Badge>
          <Badge variant="danger">Offline</Badge>
          <Badge variant="default">Unknown</Badge>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Usage in Context</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
            <span className="text-sm font-medium text-text">GPT-4o</span>
            <Badge variant="primary">Default</Badge>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
            <span className="text-sm font-medium text-text">Claude Opus</span>
            <Badge variant="warning">Rate Limited</Badge>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
            <span className="text-sm font-medium text-text">Llama 3.1</span>
            <Badge variant="danger">Unavailable</Badge>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
