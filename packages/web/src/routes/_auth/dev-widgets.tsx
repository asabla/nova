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
       | "chart" | "progress" | "timer" | "map" | "math";
  title?: string;
  src?: string;              // iframe widgets
  endpoint?: string;         // api widgets
  refreshInterval?: number;  // auto-refresh in seconds
  height?: number;           // widget height in px
  params?: Record<string, string>;
}

// Widget param reference:
// weather:   { location }
// countdown: { date, label }
// poll:      { question, options (comma-sep) }
// chart:     { chartType (bar|line|pie), data (comma-sep numbers), labels (comma-sep) }
// progress:  { steps (comma-sep), current (0-based index), status (in-progress|completed|failed) }
// timer:     { autoStart (true|false), label }
// map:       { lat, lon, zoom, query }
// math:      { expression (LaTeX), displayMode (true|false) }`}
          </pre>
        </section>
      </div>
    </div>
  );
}
