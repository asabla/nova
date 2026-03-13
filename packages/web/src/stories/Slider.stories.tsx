import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Slider } from "@/components/ui/Slider";

const meta: Meta<typeof Slider> = {
  title: "Components/Slider",
  component: Slider,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Slider>;

function ControlledSlider(props: Omit<React.ComponentProps<typeof Slider>, "onChange">) {
  const [value, setValue] = useState(props.value);
  return <Slider {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: () => <ControlledSlider value={50} min={0} max={100} label="Volume" />,
};

export const WithLabels: Story = {
  render: () => (
    <div className="space-y-6">
      <ControlledSlider value={10} min={1} max={50} step={1} label="Max Sources" />
      <ControlledSlider value={3} min={1} max={10} step={1} label="Max Iterations" />
      <ControlledSlider value={75} min={0} max={100} step={5} label="Confidence" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Slider value={30} onChange={() => {}} min={0} max={100} label="Disabled" disabled />
  ),
};
