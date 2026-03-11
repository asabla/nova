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

/** Bar chart widget */
export const BarChart: Story = {
  args: {
    config: {
      type: "chart",
      title: "Quarterly Sales",
      params: {
        chartType: "bar",
        data: "10,25,40,30",
        labels: "Q1,Q2,Q3,Q4",
      },
    } satisfies WidgetConfig,
  },
};

/** Line chart widget */
export const LineChart: Story = {
  args: {
    config: {
      type: "chart",
      title: "Monthly Trend",
      params: {
        chartType: "line",
        data: "5,12,8,22,18,30",
        labels: "Jan,Feb,Mar,Apr,May,Jun",
      },
    } satisfies WidgetConfig,
  },
};

/** Pie chart widget */
export const PieChart: Story = {
  args: {
    config: {
      type: "chart",
      title: "Market Share",
      params: {
        chartType: "pie",
        data: "45,30,15,10",
        labels: "Chrome,Safari,Firefox,Edge",
      },
    } satisfies WidgetConfig,
  },
};

/** Progress step tracker */
export const Progress: Story = {
  args: {
    config: {
      type: "progress",
      title: "Setup Progress",
      params: {
        steps: "Account,Profile,Settings,Done",
        current: "2",
        status: "in-progress",
      },
    } satisfies WidgetConfig,
  },
};

/** Progress — completed state */
export const ProgressCompleted: Story = {
  args: {
    config: {
      type: "progress",
      title: "All Done",
      params: {
        steps: "Upload,Process,Review,Publish",
        current: "3",
        status: "completed",
      },
    } satisfies WidgetConfig,
  },
};

/** Timer / stopwatch widget */
export const Timer: Story = {
  args: {
    config: {
      type: "timer",
      title: "Focus Timer",
      params: { autoStart: "false", label: "Focus Session" },
    } satisfies WidgetConfig,
  },
};

/** Map widget (OpenStreetMap) */
export const Map: Story = {
  args: {
    config: {
      type: "map",
      title: "Paris",
      params: {
        lat: "48.8566",
        lon: "2.3522",
        zoom: "13",
        query: "Paris, France",
      },
    } satisfies WidgetConfig,
  },
};

/** Math / LaTeX equation widget */
export const Math: Story = {
  args: {
    config: {
      type: "math",
      title: "Einstein's Equation",
      params: { expression: "E = mc^2", displayMode: "true" },
    } satisfies WidgetConfig,
  },
};

/** Math — complex equation */
export const MathComplex: Story = {
  args: {
    config: {
      type: "math",
      title: "Quadratic Formula",
      params: {
        expression: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
        displayMode: "true",
      },
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

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Bar Chart
      </p>
      <DynamicWidget
        config={{
          type: "chart",
          title: "Quarterly Revenue",
          params: { chartType: "bar", data: "10,25,40,30", labels: "Q1,Q2,Q3,Q4" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Line Chart
      </p>
      <DynamicWidget
        config={{
          type: "chart",
          title: "Growth Trend",
          params: { chartType: "line", data: "5,12,8,22,18,30", labels: "Jan,Feb,Mar,Apr,May,Jun" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Pie Chart
      </p>
      <DynamicWidget
        config={{
          type: "chart",
          title: "Browser Share",
          params: { chartType: "pie", data: "45,30,15,10", labels: "Chrome,Safari,Firefox,Edge" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Progress
      </p>
      <DynamicWidget
        config={{
          type: "progress",
          title: "Onboarding",
          params: { steps: "Sign Up,Verify,Profile,Complete", current: "2", status: "in-progress" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Timer
      </p>
      <DynamicWidget
        config={{
          type: "timer",
          title: "Stopwatch",
          params: { autoStart: "false", label: "Elapsed" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Map
      </p>
      <DynamicWidget
        config={{
          type: "map",
          title: "Tokyo",
          params: { lat: "35.6762", lon: "139.6503", zoom: "12", query: "Tokyo, Japan" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Math
      </p>
      <DynamicWidget
        config={{
          type: "math",
          title: "Euler's Identity",
          params: { expression: "e^{i\\pi} + 1 = 0", displayMode: "true" },
        }}
      />
    </div>
  ),
  parameters: { layout: "padded" },
};
