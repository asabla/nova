import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "@/components/ui/Input";
import { Search, Mail, Lock, Globe } from "lucide-react";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  argTypes: {
    label: { control: "text", description: "Label text above the input" },
    error: { control: "text", description: "Error message displayed below" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    type: { control: "select", options: ["text", "email", "password", "number", "url"] },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Enter text...");
    await expect(input).toBeVisible();
    await userEvent.type(input, "Hello NOVA");
    await expect(input).toHaveValue("Hello NOVA");
  },
};

export const WithLabel: Story = {
  args: {
    label: "Email Address",
    placeholder: "you@example.com",
    type: "email",
  },
};

export const WithError: Story = {
  args: {
    label: "Password",
    type: "password",
    error: "Password must be at least 8 characters",
    defaultValue: "short",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Password must be at least 8 characters")).toBeVisible();
  },
};

export const Disabled: Story = {
  args: {
    label: "Workspace Name",
    disabled: true,
    defaultValue: "My Workspace",
  },
};

/** Showcases all input states and use cases */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-8 w-80">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Basic</p>
        <div className="space-y-4">
          <Input placeholder="Type something..." />
          <Input label="With Label" placeholder="Enter value..." />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">States</p>
        <div className="space-y-4">
          <Input label="Default" placeholder="Active input" />
          <Input label="With Value" defaultValue="hello@nova.ai" />
          <Input label="Error State" error="This field is required" placeholder="Required" />
          <Input label="Disabled" disabled defaultValue="Cannot edit" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Input Types</p>
        <div className="space-y-4">
          <Input label="Email" type="email" placeholder="user@example.com" />
          <Input label="Password" type="password" placeholder="Enter password" />
          <Input label="URL" type="url" placeholder="https://..." />
          <Input label="Number" type="number" placeholder="0" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Form Example</p>
        <div className="p-5 rounded-xl bg-surface-secondary border border-border space-y-4">
          <Input label="Display Name" placeholder="John Doe" />
          <Input label="Email" type="email" placeholder="john@example.com" />
          <Input label="API Key" type="password" placeholder="sk-..." />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
  },
};
