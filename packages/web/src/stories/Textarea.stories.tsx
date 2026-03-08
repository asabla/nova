import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "@/components/ui/Textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    error: { control: "text" },
    helperText: { control: "text" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: "Type something...",
  },
};

export const WithLabel: Story = {
  args: {
    label: "System Prompt",
    placeholder: "You are a helpful assistant...",
  },
};

export const WithError: Story = {
  args: {
    label: "Description",
    error: "Description must be at least 10 characters",
    defaultValue: "Too short",
  },
};

export const WithHelperText: Story = {
  args: {
    label: "System Prompt",
    helperText: "Supports Markdown. Use {{user_name}} for dynamic content.",
    placeholder: "Define the agent's behavior...",
  },
};

export const Disabled: Story = {
  args: {
    label: "Read-only Notes",
    disabled: true,
    defaultValue: "This content cannot be edited in this context.",
  },
};

/** Showcases all textarea states */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-6 w-96">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Basic</p>
        <Textarea placeholder="Start typing..." />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">With Label & Helper</p>
        <Textarea
          label="Agent Instructions"
          placeholder="Define how the agent should respond..."
          helperText="Be specific about tone, format, and constraints."
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">With Value</p>
        <Textarea
          label="System Prompt"
          defaultValue={"You are a research analyst. Your job is to:\n1. Search for relevant sources\n2. Cross-reference findings\n3. Produce structured reports with citations"}
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Error State</p>
        <Textarea
          label="Description"
          error="Required field — please provide a description"
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">Disabled</p>
        <Textarea
          label="Notes"
          disabled
          defaultValue="This conversation has been archived."
        />
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
