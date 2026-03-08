import type { Meta, StoryObj } from "@storybook/react-vite";
import { DynamicWidget, type WidgetConfig } from "@/components/chat/DynamicWidget";

const meta: Meta<typeof DynamicWidget> = {
  title: "Chat/DynamicWidget",
  component: DynamicWidget,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DynamicWidget>;

/** Weather widget (fetches from wttr.in) */
export const Weather: Story = {
  args: {
    config: {
      type: "weather",
      title: "Weather — London",
      params: { location: "London" },
    } satisfies WidgetConfig,
  },
};

/** Countdown timer widget */
export const Countdown: Story = {
  args: {
    config: {
      type: "countdown",
      title: "Launch Countdown",
      params: {
        date: new Date(Date.now() + 3 * 86400000).toISOString(),
        label: "Time until launch",
      },
    } satisfies WidgetConfig,
  },
};

/** Poll widget with voting */
export const Poll: Story = {
  args: {
    config: {
      type: "poll",
      title: "Team Poll",
      params: {
        question: "Which framework should we use?",
        options: "React,Vue,Svelte,Angular",
      },
    } satisfies WidgetConfig,
  },
};

/** Iframe embed widget */
export const IframeEmbed: Story = {
  args: {
    config: {
      type: "iframe",
      title: "Example Embed",
      src: "https://example.com",
      height: 200,
    } satisfies WidgetConfig,
  },
};

/** All widget types gallery */
export const AllWidgets: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Countdown
      </p>
      <DynamicWidget
        config={{
          type: "countdown",
          title: "New Year Countdown",
          params: { date: "2027-01-01T00:00:00Z", label: "Until 2027" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Poll
      </p>
      <DynamicWidget
        config={{
          type: "poll",
          title: "Quick Poll",
          params: { question: "Best color?", options: "Blue,Red,Green" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Weather (live)
      </p>
      <DynamicWidget
        config={{
          type: "weather",
          title: "Stockholm Weather",
          params: { location: "Stockholm" },
        }}
      />
    </div>
  ),
  parameters: { layout: "padded" },
};
