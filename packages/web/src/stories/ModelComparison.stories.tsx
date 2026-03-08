import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import { Check, Zap, Brain, Gauge, DollarSign, Clock, Sparkles } from "lucide-react";
import { ModelCapabilityBadges } from "@/components/ui/ModelCapabilityBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const meta: Meta = {
  title: "Patterns/ModelComparison",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Mock Model Data ──────────────────────────────────────────────────────

interface MockModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  contextWindow: number;
  maxOutput: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  speed: "fast" | "medium" | "slow";
  quality: "good" | "great" | "best";
  recommended?: boolean;
}

const models: MockModel[] = [
  {
    id: "claude-opus-4",
    name: "Claude Opus 4",
    provider: "Anthropic",
    description: "Most capable model for complex reasoning, creative writing, and nuanced analysis.",
    capabilities: ["vision", "tools", "reasoning", "code", "streaming", "json-mode", "long-context"],
    contextWindow: 200_000,
    maxOutput: 32_000,
    inputCostPer1M: 15,
    outputCostPer1M: 75,
    speed: "slow",
    quality: "best",
  },
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    description: "Best balance of intelligence, speed, and cost. Ideal for most tasks.",
    capabilities: ["vision", "tools", "reasoning", "code", "streaming", "json-mode", "long-context"],
    contextWindow: 200_000,
    maxOutput: 16_000,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
    speed: "medium",
    quality: "great",
    recommended: true,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Fastest and most affordable. Great for simple tasks, classification, and extraction.",
    capabilities: ["vision", "tools", "code", "streaming", "json-mode"],
    contextWindow: 200_000,
    maxOutput: 8_000,
    inputCostPer1M: 0.8,
    outputCostPer1M: 4,
    speed: "fast",
    quality: "good",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "OpenAI's flagship multimodal model with strong general capabilities.",
    capabilities: ["vision", "function-calling", "code", "streaming", "json-mode", "long-context"],
    contextWindow: 128_000,
    maxOutput: 16_384,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10,
    speed: "medium",
    quality: "great",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "OpenAI",
    description: "Compact, fast model for lightweight tasks and high-volume processing.",
    capabilities: ["vision", "function-calling", "code", "streaming", "json-mode"],
    contextWindow: 128_000,
    maxOutput: 16_384,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    speed: "fast",
    quality: "good",
  },
];

// ── Helper Components ────────────────────────────────────────────────────

function SpeedIndicator({ speed }: { speed: MockModel["speed"] }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={clsx(
              "h-2 w-1.5 rounded-sm",
              (speed === "fast" || (speed === "medium" && i <= 2) || (speed === "slow" && i <= 1))
                ? "bg-primary"
                : "bg-surface-tertiary",
            )}
          />
        ))}
      </div>
      <span className="text-[10px] text-text-tertiary capitalize">{speed}</span>
    </div>
  );
}

function QualityIndicator({ quality }: { quality: MockModel["quality"] }) {
  const stars = quality === "best" ? 3 : quality === "great" ? 2 : 1;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <Sparkles
            key={i}
            className={clsx("h-3 w-3", i <= stars ? "text-warning" : "text-surface-tertiary")}
          />
        ))}
      </div>
      <span className="text-[10px] text-text-tertiary capitalize">{quality}</span>
    </div>
  );
}

function formatNumber(n: number) {
  return n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Model selector cards with capability badges */
export const ModelSelector: Story = {
  render: () => {
    const [selected, setSelected] = useState("claude-sonnet-4");

    return (
      <div className="max-w-3xl">
        <h2 className="text-lg font-semibold text-text mb-1">Choose a Model</h2>
        <p className="text-sm text-text-secondary mb-4">Select the model that best fits your task.</p>

        <div className="grid gap-3">
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelected(model.id)}
              className={clsx(
                "relative w-full text-left rounded-xl border p-4 transition-all",
                selected === model.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-surface hover:border-primary/40",
              )}
            >
              {model.recommended && (
                <Badge variant="primary" className="absolute top-3 right-3">
                  Recommended
                </Badge>
              )}

              <div className="flex items-start gap-3">
                {selected === model.id && (
                  <div className="mt-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                {selected !== model.id && (
                  <div className="mt-0.5 h-5 w-5 rounded-full border-2 border-border shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-text">{model.name}</span>
                    <span className="text-[10px] text-text-tertiary">{model.provider}</span>
                  </div>
                  <p className="text-xs text-text-secondary mb-2">{model.description}</p>

                  <div className="flex items-center gap-4 mb-2">
                    <SpeedIndicator speed={model.speed} />
                    <QualityIndicator quality={model.quality} />
                    <span className="text-[10px] text-text-tertiary">
                      {formatNumber(model.contextWindow)} ctx
                    </span>
                  </div>

                  <ModelCapabilityBadges capabilities={model.capabilities} compact />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  },
};

/** Side-by-side comparison table */
export const ComparisonTable: Story = {
  render: () => {
    const [selectedIds, setSelectedIds] = useState(["claude-sonnet-4", "gpt-4o"]);
    const compared = models.filter((m) => selectedIds.includes(m.id));

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-1">Compare Models</h2>
        <p className="text-sm text-text-secondary mb-4">Side-by-side comparison of selected models.</p>

        {/* Model chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedIds((prev) =>
                  prev.includes(m.id)
                    ? prev.filter((id) => id !== m.id)
                    : prev.length < 3 ? [...prev, m.id] : prev,
                );
              }}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                selectedIds.includes(m.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-text-secondary hover:text-text",
              )}
            >
              {m.name}
            </button>
          ))}
          <span className="text-[10px] text-text-tertiary self-center ml-1">Max 3</span>
        </div>

        {compared.length >= 2 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-tertiary/50">
                  <th className="text-left px-4 py-2.5 font-medium text-text-tertiary w-36" />
                  {compared.map((m) => (
                    <th key={m.id} className="text-left px-4 py-2.5 font-medium text-text">
                      <div>{m.name}</div>
                      <div className="font-normal text-text-tertiary">{m.provider}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-2.5 text-text-tertiary font-medium">Quality</td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-2.5"><QualityIndicator quality={m.quality} /></td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-text-tertiary font-medium">Speed</td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-2.5"><SpeedIndicator speed={m.speed} /></td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-text-tertiary font-medium">Context Window</td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-2.5 text-text">{formatNumber(m.contextWindow)} tokens</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-text-tertiary font-medium">Max Output</td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-2.5 text-text">{formatNumber(m.maxOutput)} tokens</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-text-tertiary font-medium">Input Cost</td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-2.5 text-text">${m.inputCostPer1M} / 1M tokens</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-text-tertiary font-medium">Output Cost</td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-2.5 text-text">${m.outputCostPer1M} / 1M tokens</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-text-tertiary font-medium">Capabilities</td>
                  {compared.map((m) => (
                    <td key={m.id} className="px-4 py-2.5">
                      <ModelCapabilityBadges capabilities={m.capabilities} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {compared.length < 2 && (
          <div className="rounded-xl border border-border bg-surface-secondary p-8 text-center">
            <p className="text-sm text-text-tertiary">Select at least 2 models to compare</p>
          </div>
        )}
      </div>
    );
  },
};

/** Compact model picker for conversation settings */
export const CompactPicker: Story = {
  render: () => {
    const [selected, setSelected] = useState("claude-sonnet-4");

    return (
      <div className="max-w-sm">
        <label className="text-xs font-medium text-text-secondary mb-2 block">Model</label>
        <div className="space-y-1.5">
          {models.filter((m) => m.provider === "Anthropic").map((model) => (
            <button
              key={model.id}
              onClick={() => setSelected(model.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                selected === model.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface hover:border-primary/40",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">{model.name}</span>
                  {model.recommended && (
                    <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">Best value</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <SpeedIndicator speed={model.speed} />
                  <span className="text-[10px] text-text-tertiary">${model.inputCostPer1M}/M in</span>
                </div>
              </div>
              {selected === model.id && (
                <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  },
};
