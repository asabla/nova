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

/** Color palette widget */
export const ColorPalette: Story = {
  args: {
    config: {
      type: "colorpalette",
      title: "Brand Colors",
      params: {
        colors: "#6366f1,#ec4899,#14b8a6,#f59e0b,#ef4444",
        labels: "Primary,Accent,Teal,Amber,Red",
      },
    } satisfies WidgetConfig,
  },
};

/** Checklist widget */
export const Checklist: Story = {
  args: {
    config: {
      type: "checklist",
      title: "Sprint Tasks",
      params: {
        items: "Design mockups,Implement API,Write tests,Code review,Deploy",
        checked: "0,1",
      },
    } satisfies WidgetConfig,
  },
};

/** Timeline widget */
export const Timeline: Story = {
  args: {
    config: {
      type: "timeline",
      title: "Project Milestones",
      params: {
        events: JSON.stringify([
          { date: "2025-01-15", title: "Kickoff", description: "Project started" },
          { date: "2025-03-01", title: "Alpha Release" },
          { date: "2025-06-15", title: "Beta Release", description: "Public beta launch" },
          { date: "2025-09-01", title: "GA Release" },
        ]),
      },
    } satisfies WidgetConfig,
  },
};

/** Dice roller widget */
export const Dice: Story = {
  args: {
    config: {
      type: "dice",
      title: "D20 Roller",
      params: { type: "d20", count: "2" },
    } satisfies WidgetConfig,
  },
};

/** Unit converter widget */
export const UnitConverter: Story = {
  args: {
    config: {
      type: "unitconverter",
      title: "Length Converter",
      params: { category: "length", from: "km", to: "mi", value: "10" },
    } satisfies WidgetConfig,
  },
};

/** Calendar widget */
export const Calendar: Story = {
  args: {
    config: {
      type: "calendar",
      title: "March 2026",
      params: {
        month: "2026-03",
        highlights: "2026-03-05,2026-03-15,2026-03-21",
        labels: JSON.stringify({ "2026-03-05": "Sprint Start", "2026-03-15": "Demo Day", "2026-03-21": "Retro" }),
      },
    } satisfies WidgetConfig,
  },
};

/** QR code widget */
export const QRCode: Story = {
  args: {
    config: {
      type: "qrcode",
      title: "QR Code",
      params: { data: "https://nova.dev", size: "200" },
    } satisfies WidgetConfig,
  },
};

/** Diff widget — unified mode */
export const Diff: Story = {
  args: {
    config: {
      type: "diff",
      title: "Code Changes",
      params: {
        original: "function greet(name) {\n  console.log('Hello ' + name);\n  return true;\n}",
        modified: "function greet(name: string) {\n  console.log(`Hello ${name}`);\n  return true;\n}",
        language: "typescript",
        mode: "unified",
      },
    } satisfies WidgetConfig,
  },
};

/** JSON explorer widget */
export const JsonExplorer: Story = {
  args: {
    config: {
      type: "jsonexplorer",
      title: "API Response",
      params: {
        data: JSON.stringify({
          status: "ok",
          data: { users: [{ id: 1, name: "Alice", active: true }, { id: 2, name: "Bob", active: false }], total: 2 },
          meta: { page: 1, limit: 10 },
        }),
      },
    } satisfies WidgetConfig,
  },
};

/** Code display widget */
export const CodeDisplay: Story = {
  args: {
    config: {
      type: "codedisplay",
      title: "Execution Result",
      params: {
        code: "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.describe())",
        language: "python",
        output: "       age    salary\ncount  100    100\nmean   34.5   72000\nstd    8.2    15000",
        status: "success",
      },
    } satisfies WidgetConfig,
  },
};

/** Currency converter widget */
export const Currency: Story = {
  args: {
    config: {
      type: "currency",
      title: "USD to EUR",
      params: { from: "USD", to: "EUR", amount: "100" },
    } satisfies WidgetConfig,
  },
};

/** Stock widget */
export const Stock: Story = {
  args: {
    config: {
      type: "stock",
      title: "AAPL",
      params: {
        symbol: "AAPL",
        price: "178.72",
        change: "+2.35",
        changePercent: "+1.33",
        range: "1m",
        sparkline: "165,168,170,169,172,175,173,176,178,177,179,178",
      },
    } satisfies WidgetConfig,
  },
};

/** YouTube embed widget */
export const YouTube: Story = {
  args: {
    config: {
      type: "youtube",
      title: "Video",
      params: { videoId: "dQw4w9WgXcQ" },
    } satisfies WidgetConfig,
  },
};

/** Kanban board widget */
export const Kanban: Story = {
  args: {
    config: {
      type: "kanban",
      title: "Sprint Board",
      params: {
        columns: JSON.stringify([
          { id: "todo", title: "To Do" },
          { id: "progress", title: "In Progress" },
          { id: "done", title: "Done" },
        ]),
        cards: JSON.stringify([
          { id: "1", title: "Design mockups", columnId: "todo" },
          { id: "2", title: "API endpoints", description: "REST + WebSocket", columnId: "progress" },
          { id: "3", title: "Auth flow", columnId: "done" },
        ]),
      },
    } satisfies WidgetConfig,
  },
};

/** Quiz widget */
export const Quiz: Story = {
  args: {
    config: {
      type: "quiz",
      title: "JavaScript Quiz",
      params: {
        title: "JavaScript Basics",
        questions: JSON.stringify([
          { question: "Which keyword declares a block-scoped variable?", options: ["var", "let", "both", "neither"], correctIndex: 1 },
          { question: "What does '===' check?", options: ["Value only", "Type only", "Value and type", "Reference"], correctIndex: 2 },
          { question: "Which is NOT a primitive type?", options: ["string", "number", "object", "boolean"], correctIndex: 2 },
        ]),
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

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Color Palette
      </p>
      <DynamicWidget
        config={{
          type: "colorpalette",
          title: "Brand Colors",
          params: { colors: "#6366f1,#ec4899,#14b8a6,#f59e0b,#ef4444", labels: "Primary,Accent,Teal,Amber,Red" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Checklist
      </p>
      <DynamicWidget
        config={{
          type: "checklist",
          title: "Tasks",
          params: { items: "Design,Implement,Test,Deploy", checked: "0" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Timeline
      </p>
      <DynamicWidget
        config={{
          type: "timeline",
          title: "Milestones",
          params: { events: JSON.stringify([{ date: "2025-01-15", title: "Start" }, { date: "2025-06-01", title: "Launch" }]) },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Dice
      </p>
      <DynamicWidget
        config={{ type: "dice", title: "D6 Roller", params: { type: "d6", count: "2" } }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Unit Converter
      </p>
      <DynamicWidget
        config={{ type: "unitconverter", title: "Length", params: { category: "length", from: "km", to: "mi", value: "10" } }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Calendar
      </p>
      <DynamicWidget
        config={{
          type: "calendar",
          title: "March 2026",
          params: { month: "2026-03", highlights: "2026-03-15,2026-03-21" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        QR Code
      </p>
      <DynamicWidget
        config={{ type: "qrcode", title: "QR Code", params: { data: "https://nova.dev" } }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Diff
      </p>
      <DynamicWidget
        config={{
          type: "diff",
          title: "Changes",
          params: { original: "hello world\nfoo", modified: "hello nova\nfoo\nbar", mode: "unified" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        JSON Explorer
      </p>
      <DynamicWidget
        config={{
          type: "jsonexplorer",
          title: "Data",
          params: { data: JSON.stringify({ name: "Nova", version: 1, features: ["widgets", "chat"] }) },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Currency
      </p>
      <DynamicWidget
        config={{ type: "currency", title: "USD → EUR", params: { from: "USD", to: "EUR", amount: "100" } }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Stock
      </p>
      <DynamicWidget
        config={{
          type: "stock",
          title: "AAPL",
          params: { symbol: "AAPL", price: "178.72", change: "+2.35", changePercent: "+1.33", sparkline: "165,168,170,172,175,178" },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Kanban
      </p>
      <DynamicWidget
        config={{
          type: "kanban",
          title: "Board",
          params: {
            columns: JSON.stringify([{ id: "a", title: "To Do" }, { id: "b", title: "Done" }]),
            cards: JSON.stringify([{ id: "1", title: "Task 1", columnId: "a" }, { id: "2", title: "Task 2", columnId: "b" }]),
          },
        }}
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mt-6">
        Quiz
      </p>
      <DynamicWidget
        config={{
          type: "quiz",
          title: "Quick Quiz",
          params: {
            title: "Trivia",
            questions: JSON.stringify([
              { question: "Capital of France?", options: ["London", "Paris", "Berlin"], correctIndex: 1 },
            ]),
          },
        }}
      />
    </div>
  ),
  parameters: { layout: "padded" },
};
