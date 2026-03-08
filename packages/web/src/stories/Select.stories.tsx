import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select, type SelectOption } from "@/components/ui/Select";

/** Styled select dropdown for choosing from predefined options. */
const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "md"] },
    disabled: { control: "boolean" },
    label: { control: "text" },
    error: { control: "text" },
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const models: SelectOption[] = [
  { value: "claude-4", label: "Claude 4 Opus" },
  { value: "claude-4-sonnet", label: "Claude 4 Sonnet" },
  { value: "claude-4-haiku", label: "Claude 4 Haiku" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const timezones: SelectOption[] = [
  { value: "utc", label: "UTC (Coordinated Universal Time)" },
  { value: "est", label: "EST (Eastern Standard Time)" },
  { value: "cst", label: "CST (Central Standard Time)" },
  { value: "mst", label: "MST (Mountain Standard Time)" },
  { value: "pst", label: "PST (Pacific Standard Time)" },
  { value: "gmt", label: "GMT (Greenwich Mean Time)" },
  { value: "cet", label: "CET (Central European Time)" },
  { value: "eet", label: "EET (Eastern European Time)" },
  { value: "ist", label: "IST (India Standard Time)" },
  { value: "jst", label: "JST (Japan Standard Time)" },
  { value: "aest", label: "AEST (Australian Eastern)" },
  { value: "nzst", label: "NZST (New Zealand Standard)" },
];

function InteractiveSelect(props: React.ComponentProps<typeof Select>) {
  const [value, setValue] = useState(props.value ?? "");
  return <Select {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <InteractiveSelect options={models} placeholder="Choose a model" />
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-64">
      <InteractiveSelect
        options={models}
        label="Default Model"
        placeholder="Select model"
      />
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="w-64">
      <InteractiveSelect
        options={models}
        label="Model"
        error="A model must be selected"
        placeholder="Select model"
      />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-64">
      <InteractiveSelect
        options={models}
        label="Model"
        value="claude-4"
        disabled
      />
    </div>
  ),
};

export const ManyOptions: Story = {
  render: () => (
    <div className="w-72">
      <InteractiveSelect
        options={timezones}
        label="Timezone"
        placeholder="Select timezone"
        helperText="Used for scheduling and timestamps."
      />
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="w-48">
      <InteractiveSelect options={models} size="sm" placeholder="Model" />
    </div>
  ),
};

export const WithDisabledOptions: Story = {
  render: () => (
    <div className="w-64">
      <InteractiveSelect
        options={[
          { value: "claude-4", label: "Claude 4 Opus" },
          { value: "claude-4-sonnet", label: "Claude 4 Sonnet" },
          { value: "gpt-4o", label: "GPT-4o", disabled: true },
          { value: "gpt-4o-mini", label: "GPT-4o Mini", disabled: true },
          { value: "claude-4-haiku", label: "Claude 4 Haiku" },
        ]}
        label="Available Models"
        placeholder="Select model"
        helperText="Some models are unavailable in this workspace."
      />
    </div>
  ),
};

/** Showcases all select states and patterns */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-8 w-80">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Basic</p>
        <InteractiveSelect options={models} placeholder="Choose a model" />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">With Label & Helper</p>
        <InteractiveSelect
          options={models}
          label="Default Model"
          placeholder="Select model"
          helperText="This model will be used for new conversations."
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Pre-selected</p>
        <InteractiveSelect
          options={models}
          label="Current Model"
          value="claude-4"
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Error State</p>
        <InteractiveSelect
          options={models}
          label="Model"
          error="Required — please select a model"
          placeholder="Select model"
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Disabled</p>
        <InteractiveSelect
          options={models}
          label="Locked Model"
          value="claude-4"
          disabled
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Sizes</p>
        <div className="space-y-3">
          <InteractiveSelect options={models} size="sm" placeholder="Small" />
          <InteractiveSelect options={models} size="md" placeholder="Medium (default)" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Scrollable (12 items)</p>
        <InteractiveSelect
          options={timezones}
          label="Timezone"
          placeholder="Select timezone"
        />
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
