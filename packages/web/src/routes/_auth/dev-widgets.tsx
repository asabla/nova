import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Blocks } from "lucide-react";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { DynamicWidget, type WidgetConfig } from "../../components/chat/DynamicWidget";
import { ArtifactRenderer, type ArtifactData } from "../../components/chat/ArtifactRenderer";

export const Route = createFileRoute("/_auth/dev-widgets")({
  component: DevWidgetsPage,
});

// ---------------------------------------------------------------------------
// Sample widget configs
// ---------------------------------------------------------------------------

const SAMPLE_WIDGETS: { label: string; config: WidgetConfig }[] = [
  {
    label: "Weather (Stockholm)",
    config: {
      type: "weather",
      title: "Stockholm Weather",
      params: { location: "Stockholm" },
    },
  },
  {
    label: "Weather (Tokyo)",
    config: {
      type: "weather",
      title: "Tokyo Weather",
      params: { location: "Tokyo" },
    },
  },
  {
    label: "Countdown (New Year)",
    config: {
      type: "countdown",
      title: "New Year Countdown",
      params: { date: "2027-01-01T00:00:00Z", label: "New Year 2027" },
    },
  },
  {
    label: "Poll",
    config: {
      type: "poll",
      title: "Favorite Framework",
      params: {
        question: "What's your favorite frontend framework?",
        options: "React,Vue,Svelte,Angular,Solid",
      },
    },
  },
  {
    label: "API (Random Joke)",
    config: {
      type: "api",
      title: "Random Joke",
      endpoint: "https://official-joke-api.appspot.com/random_joke",
      refreshInterval: 0,
    },
  },
  {
    label: "iFrame (example.com)",
    config: {
      type: "iframe",
      title: "Example Embed",
      src: "https://example.com",
      height: 200,
    },
  },
  {
    label: "Bar Chart",
    config: {
      type: "chart",
      title: "Quarterly Revenue",
      params: { chartType: "bar", data: "10,25,40,30", labels: "Q1,Q2,Q3,Q4" },
    },
  },
  {
    label: "Line Chart",
    config: {
      type: "chart",
      title: "Monthly Trend",
      params: { chartType: "line", data: "5,12,8,22,18,30", labels: "Jan,Feb,Mar,Apr,May,Jun" },
    },
  },
  {
    label: "Pie Chart",
    config: {
      type: "chart",
      title: "Market Share",
      params: { chartType: "pie", data: "45,30,15,10", labels: "Chrome,Safari,Firefox,Edge" },
    },
  },
  {
    label: "Progress (step 2 of 4)",
    config: {
      type: "progress",
      title: "Setup Progress",
      params: { steps: "Account,Profile,Settings,Done", current: "2", status: "in-progress" },
    },
  },
  {
    label: "Timer",
    config: {
      type: "timer",
      title: "Focus Timer",
      params: { autoStart: "false", label: "Focus Session" },
    },
  },
  {
    label: "Map (Paris)",
    config: {
      type: "map",
      title: "Paris",
      params: { lat: "48.8566", lon: "2.3522", zoom: "13", query: "Paris, France" },
    },
  },
  {
    label: "Math (Euler's Identity)",
    config: {
      type: "math",
      title: "Euler's Identity",
      params: { expression: "e^{i\\pi} + 1 = 0", displayMode: "true" },
    },
  },
  {
    label: "Color Palette",
    config: {
      type: "colorpalette",
      title: "Brand Colors",
      params: { colors: "#6366f1,#ec4899,#14b8a6,#f59e0b,#ef4444,#8b5cf6", labels: "Primary,Pink,Teal,Amber,Red,Purple" },
    },
  },
  {
    label: "Checklist",
    config: {
      type: "checklist",
      title: "Sprint Tasks",
      params: { items: "Design mockups,Implement API,Write tests,Code review,Deploy to staging", checked: "0,1" },
    },
  },
  {
    label: "Timeline",
    config: {
      type: "timeline",
      title: "Project Milestones",
      params: {
        events: JSON.stringify([
          { date: "2025-01-15", title: "Kickoff", description: "Project initiated" },
          { date: "2025-03-01", title: "Alpha Release" },
          { date: "2025-06-15", title: "Beta Release", description: "Public beta" },
          { date: "2025-09-01", title: "GA Launch" },
        ]),
      },
    },
  },
  {
    label: "Dice (D6)",
    config: {
      type: "dice",
      title: "Dice Roller",
      params: { type: "d6", count: "2" },
    },
  },
  {
    label: "Unit Converter",
    config: {
      type: "unitconverter",
      title: "Length Converter",
      params: { category: "length", from: "km", to: "mi", value: "10" },
    },
  },
  {
    label: "Calendar",
    config: {
      type: "calendar",
      title: "March 2026",
      params: {
        month: "2026-03",
        highlights: "2026-03-05,2026-03-15,2026-03-21",
        labels: JSON.stringify({ "2026-03-05": "Sprint Start", "2026-03-15": "Demo Day", "2026-03-21": "Retro" }),
      },
    },
  },
  {
    label: "QR Code",
    config: {
      type: "qrcode",
      title: "QR Code",
      params: { data: "https://nova.dev", size: "200" },
    },
  },
  {
    label: "Diff (Unified)",
    config: {
      type: "diff",
      title: "Code Changes",
      params: {
        original: "function greet(name) {\n  console.log('Hello ' + name);\n  return true;\n}",
        modified: "function greet(name: string) {\n  console.log(`Hello ${name}`);\n  return true;\n}",
        language: "typescript",
        mode: "unified",
      },
    },
  },
  {
    label: "JSON Explorer",
    config: {
      type: "jsonexplorer",
      title: "API Response",
      params: {
        data: JSON.stringify({
          status: "ok",
          data: { users: [{ id: 1, name: "Alice", active: true }, { id: 2, name: "Bob" }], total: 2 },
          meta: { page: 1, limit: 10 },
        }),
      },
    },
  },
  {
    label: "Code Display",
    config: {
      type: "codedisplay",
      title: "Python Execution",
      params: {
        code: "import pandas as pd\ndf = pd.read_csv('data.csv')\nprint(df.head())",
        language: "python",
        output: "   name  age\n0  Alice   30\n1  Bob     25",
        status: "success",
      },
    },
  },
  {
    label: "Currency (USD → EUR)",
    config: {
      type: "currency",
      title: "USD to EUR",
      params: { from: "USD", to: "EUR", amount: "100" },
    },
  },
  {
    label: "Stock (AAPL)",
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
    },
  },
  {
    label: "YouTube",
    config: {
      type: "youtube",
      title: "Video",
      params: { videoId: "dQw4w9WgXcQ" },
    },
  },
  {
    label: "Kanban Board",
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
    },
  },
  {
    label: "Quiz",
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
    },
  },
];

// Wrap a widget config as an ArtifactData to test the ArtifactRenderer pipeline
function widgetToArtifact(config: WidgetConfig, index: number): ArtifactData {
  return {
    id: `test-widget-${index}`,
    type: "widget",
    title: config.title ?? config.type,
    content: "",
    metadata: config as unknown as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Custom widget editor
// ---------------------------------------------------------------------------

function CustomWidgetEditor({ onAdd }: { onAdd: (config: WidgetConfig) => void }) {
  const [json, setJson] = useState(
    JSON.stringify(
      {
        type: "weather",
        title: "My City",
        params: { location: "Berlin" },
      },
      null,
      2,
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed.type) throw new Error("Missing 'type' field");
      setError(null);
      onAdd(parsed as WidgetConfig);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4">
      <h3 className="text-sm font-medium text-text mb-2">Custom Widget JSON</h3>
      <Textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={8}
        className="w-full text-xs font-mono"
      />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      <button
        onClick={handleAdd}
        className="mt-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90"
      >
        Render Widget
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DevWidgetsPage() {
  const [customWidgets, setCustomWidgets] = useState<WidgetConfig[]>([]);
  const [renderMode, setRenderMode] = useState<"standalone" | "artifact">("standalone");

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Blocks className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-text">Widget Test Harness</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
            Dev
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Render mode:</span>
          <Select
            options={[
              { value: "standalone", label: "DynamicWidget (standalone)" },
              { value: "artifact", label: "ArtifactRenderer (pipeline)" },
            ]}
            value={renderMode}
            onChange={(val) => setRenderMode(val as "standalone" | "artifact")}
            size="sm"
          />
        </div>
      </div>

      <div className="flex-1 p-6 space-y-8 max-w-4xl mx-auto w-full">
        {/* Preset widgets */}
        <section>
          <h2 className="text-sm font-medium text-text mb-3">
            Preset Widgets ({renderMode === "artifact" ? "via ArtifactRenderer" : "standalone"})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAMPLE_WIDGETS.map((sample, i) =>
              renderMode === "artifact" ? (
                <div key={i}>
                  <p className="text-[10px] text-text-tertiary mb-1">{sample.label}</p>
                  <ArtifactRenderer artifact={widgetToArtifact(sample.config, i)} />
                </div>
              ) : (
                <div key={i}>
                  <p className="text-[10px] text-text-tertiary mb-1">{sample.label}</p>
                  <DynamicWidget config={sample.config} />
                </div>
              ),
            )}
          </div>
        </section>

        {/* Custom widget editor */}
        <section>
          <h2 className="text-sm font-medium text-text mb-3">Add Custom Widget</h2>
          <CustomWidgetEditor onAdd={(config) => setCustomWidgets((prev) => [...prev, config])} />
          {customWidgets.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="text-xs font-medium text-text-secondary">Custom Widgets</h3>
              {customWidgets.map((config, i) =>
                renderMode === "artifact" ? (
                  <ArtifactRenderer
                    key={i}
                    artifact={widgetToArtifact(config, SAMPLE_WIDGETS.length + i)}
                  />
                ) : (
                  <DynamicWidget key={i} config={config} />
                ),
              )}
            </div>
          )}
        </section>

        {/* Config reference */}
        <section>
          <h2 className="text-sm font-medium text-text mb-2">WidgetConfig Reference</h2>
          <pre className="p-4 rounded-xl border border-border bg-surface-secondary text-xs text-text-secondary font-mono overflow-x-auto">
{`interface WidgetConfig {
  type: "weather" | "iframe" | "api" | "countdown" | "poll"
       | "chart" | "progress" | "timer" | "map" | "math"
       | "colorpalette" | "checklist" | "timeline" | "dice"
       | "unitconverter" | "calendar" | "qrcode" | "diff"
       | "jsonexplorer" | "codedisplay" | "currency" | "stock"
       | "youtube" | "kanban" | "quiz";
  title?: string;
  src?: string;              // iframe widgets
  endpoint?: string;         // api widgets
  refreshInterval?: number;  // auto-refresh in seconds
  height?: number;           // widget height in px
  params?: Record<string, string>;
}

// Widget param reference:
// weather:       { location }
// countdown:     { date, label }
// poll:          { question, options (comma-sep) }
// chart:         { chartType (bar|line|pie), data (comma-sep numbers), labels (comma-sep) }
// progress:      { steps (comma-sep), current (0-based index), status (in-progress|completed|failed) }
// timer:         { autoStart (true|false), label }
// map:           { lat, lon, zoom, query }
// math:          { expression (LaTeX), displayMode (true|false) }
// colorpalette:  { colors (comma-sep hex), labels (comma-sep) }
// checklist:     { items (comma-sep), checked (comma-sep indices) }
// timeline:      { events (JSON: [{date,title,description?}]) }
// dice:          { type (d6|d20|coin|custom), sides, count }
// unitconverter: { category (length|weight|temperature|volume|speed), from, to, value }
// calendar:      { month (YYYY-MM), highlights (comma-sep dates), labels (JSON date→label) }
// qrcode:        { data, size }
// diff:          { original, modified, language, mode (unified|split) }
// jsonexplorer:  { data (JSON string) }
// codedisplay:   { code, language, output, status (success|error) }
// currency:      { from, to, amount }
// stock:         { symbol, price, change, changePercent, range, sparkline (comma-sep) }
// youtube:       { videoId, url, start (seconds) }
// kanban:        { columns (JSON), cards (JSON) }
// quiz:          { title, questions (JSON: [{question,options[],correctIndex}]) }`}
          </pre>
        </section>
      </div>
    </div>
  );
}
