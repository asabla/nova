import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "@/components/ui/Separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

const meta: Meta<typeof Separator> = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
    label: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-80">
      <p className="text-sm text-text">Content above</p>
      <Separator />
      <p className="text-sm text-text">Content below</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex items-center h-10 gap-0">
      <span className="text-sm text-text-secondary px-3">Item 1</span>
      <Separator orientation="vertical" />
      <span className="text-sm text-text-secondary px-3">Item 2</span>
      <Separator orientation="vertical" />
      <span className="text-sm text-text-secondary px-3">Item 3</span>
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-80">
      <p className="text-sm text-text">Sign in with email</p>
      <Separator label="or" />
      <p className="text-sm text-text">Continue with SSO</p>
    </div>
  ),
};

export const InCard: Story = {
  render: () => (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-text">Email: user@example.com</p>
          <p className="text-sm text-text-secondary">Role: Admin</p>
        </div>
        <Separator className="my-3" />
        <div className="space-y-2">
          <p className="text-sm text-text">Organization: NOVA</p>
          <p className="text-sm text-text-secondary">Plan: Enterprise</p>
        </div>
      </CardContent>
    </Card>
  ),
};

/** Showcases all separator patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10 w-96">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Horizontal</p>
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <p className="text-sm text-text">Section A</p>
          <Separator />
          <p className="text-sm text-text">Section B</p>
          <Separator />
          <p className="text-sm text-text">Section C</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Vertical</p>
        <div className="flex items-center h-8 p-4 rounded-xl bg-surface-secondary border border-border">
          <span className="text-sm text-text">Home</span>
          <Separator orientation="vertical" />
          <span className="text-sm text-text">Agents</span>
          <Separator orientation="vertical" />
          <span className="text-sm text-text">Settings</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">With Label</p>
        <div className="p-4 rounded-xl bg-surface-secondary border border-border">
          <p className="text-sm text-text text-center">Sign in with magic link</p>
          <Separator label="or" />
          <p className="text-sm text-text text-center">Sign in with SSO</p>
          <Separator label="new here?" className="mt-6" />
          <p className="text-sm text-text text-center">Create an account</p>
        </div>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
