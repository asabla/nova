import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import {
  ChevronDown, ChevronRight, Loader2, Check, X,
  RefreshCw, Bell, Heart, Star, Zap,
} from "lucide-react";

const meta: Meta = {
  title: "NOVA/AnimationGuide",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Helpers ──────────────────────────────────────────────────────────────

function DemoCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-5">
      <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
      <p className="text-xs text-text-tertiary mb-4">{description}</p>
      {children}
    </div>
  );
}

/** Interactive animation and motion reference for NOVA design system */
export const Default: Story = {
  render: () => {
    const [expanded, setExpanded] = useState(false);
    const [liked, setLiked] = useState(false);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(false);
    const [progress, setProgress] = useState(0);

    const simulateLoading = () => {
      setLoading(true);
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setTimeout(() => setLoading(false), 500);
            return 100;
          }
          return p + 20;
        });
      }, 300);
    };

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-1">Animation & Motion Guide</h2>
        <p className="text-sm text-text-secondary mb-6">
          NOVA uses subtle, purposeful animations. All transitions use CSS transitions
          with consistent timing functions and durations.
        </p>

        {/* Timing Reference */}
        <div className="rounded-xl border border-border bg-surface-secondary p-5 mb-6">
          <h3 className="text-sm font-semibold text-text mb-3">Timing Reference</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "Fast", duration: "150ms", use: "Hover states, micro-interactions", css: "duration-150" },
              { name: "Normal", duration: "200ms", use: "State changes, toggles, panels", css: "duration-200" },
              { name: "Slow", duration: "300ms", use: "Page transitions, modals, complex animations", css: "duration-300" },
            ].map((t) => (
              <div key={t.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text">{t.name}</span>
                  <code className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-text-secondary font-mono">{t.css}</code>
                </div>
                <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                  <div
                    className={clsx("h-full bg-primary rounded-full animate-pulse")}
                    style={{ width: "100%", animationDuration: t.duration }}
                  />
                </div>
                <p className="text-[10px] text-text-tertiary">{t.duration} — {t.use}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Hover Transitions */}
          <DemoCard title="Hover Transitions" description="Hover over each item to see the transition effect.">
            <div className="space-y-2">
              <div className="px-3 py-2 rounded-lg border border-border hover:bg-surface-tertiary hover:border-border-strong transition-colors duration-150 cursor-pointer">
                <p className="text-xs text-text">Color transition (150ms)</p>
              </div>
              <div className="px-3 py-2 rounded-lg border border-border hover:translate-x-1 transition-transform duration-200 cursor-pointer">
                <p className="text-xs text-text">Translate X (200ms)</p>
              </div>
              <div className="px-3 py-2 rounded-lg border border-border hover:scale-[1.02] transition-transform duration-200 cursor-pointer">
                <p className="text-xs text-text">Scale up (200ms)</p>
              </div>
              <div className="px-3 py-2 rounded-lg border border-border hover:shadow-lg hover:shadow-primary/5 transition-shadow duration-300 cursor-pointer">
                <p className="text-xs text-text">Shadow elevation (300ms)</p>
              </div>
            </div>
          </DemoCard>

          {/* Expand/Collapse */}
          <DemoCard title="Expand/Collapse" description="Click to toggle expanded state.">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-surface-tertiary transition-colors"
            >
              <span className="text-xs font-medium text-text">Reasoning steps</span>
              <ChevronDown
                className={clsx(
                  "h-4 w-4 text-text-tertiary transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
            </button>
            <div
              className={clsx(
                "overflow-hidden transition-all duration-300",
                expanded ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0",
              )}
            >
              <div className="px-3 py-2 rounded-lg bg-surface-tertiary space-y-1">
                <p className="text-xs text-text-secondary">1. Analyzing the query...</p>
                <p className="text-xs text-text-secondary">2. Searching knowledge base...</p>
                <p className="text-xs text-text-secondary">3. Generating response...</p>
              </div>
            </div>
          </DemoCard>

          {/* Like/Favorite Animation */}
          <DemoCard title="Toggle States" description="Click icons to see state transitions.">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setLiked(!liked)}
                className="p-2 rounded-lg hover:bg-surface-tertiary transition-colors"
              >
                <Heart
                  className={clsx(
                    "h-5 w-5 transition-all duration-200",
                    liked ? "text-danger fill-danger scale-110" : "text-text-tertiary scale-100",
                  )}
                />
              </button>
              <button
                onClick={() => setNotification(!notification)}
                className="relative p-2 rounded-lg hover:bg-surface-tertiary transition-colors"
              >
                <Bell className={clsx("h-5 w-5 transition-colors duration-150", notification ? "text-primary" : "text-text-tertiary")} />
                <span
                  className={clsx(
                    "absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger transition-all duration-200",
                    notification ? "scale-100 opacity-100" : "scale-0 opacity-0",
                  )}
                />
              </button>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={clsx(
                    "h-4 w-4 cursor-pointer transition-all duration-150",
                    i <= 3 ? "text-warning fill-warning" : "text-text-tertiary",
                  )}
                />
              ))}
            </div>
          </DemoCard>

          {/* Loading States */}
          <DemoCard title="Loading & Progress" description="Click button to simulate loading.">
            <div className="space-y-3">
              <Button onClick={simulateLoading} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Start Process"
                )}
              </Button>

              <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    "h-5 w-5 rounded-full flex items-center justify-center transition-all duration-300",
                    progress === 100 ? "bg-success scale-100" : "bg-surface-tertiary scale-90",
                  )}
                >
                  {progress === 100 && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-xs text-text-secondary">
                  {progress === 0 ? "Ready" : progress < 100 ? `${progress}%` : "Complete!"}
                </span>
              </div>
            </div>
          </DemoCard>

          {/* Spinner Variants */}
          <DemoCard title="Spinners & Indicators" description="Standard loading indicators.">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-1" />
                <p className="text-[10px] text-text-tertiary">Spinner</p>
              </div>
              <div className="text-center">
                <div className="flex gap-1 mx-auto mb-1 justify-center">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-2 w-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-text-tertiary">Dots</p>
              </div>
              <div className="text-center">
                <div className="h-6 w-6 rounded-full border-2 border-surface-tertiary border-t-primary animate-spin mx-auto mb-1" />
                <p className="text-[10px] text-text-tertiary">Ring</p>
              </div>
              <div className="text-center">
                <RefreshCw className="h-6 w-6 text-primary animate-spin mx-auto mb-1" style={{ animationDuration: "1.5s" }} />
                <p className="text-[10px] text-text-tertiary">Refresh</p>
              </div>
            </div>
          </DemoCard>

          {/* Easing Functions */}
          <DemoCard title="Easing Functions" description="Hover bars to see different easing curves.">
            <div className="space-y-2">
              {[
                { name: "ease-out", class: "ease-out" },
                { name: "ease-in-out", class: "ease-in-out" },
                { name: "ease-in", class: "ease-in" },
                { name: "linear", class: "ease-linear" },
              ].map((easing) => (
                <div key={easing.name} className="flex items-center gap-3 group">
                  <code className="text-[10px] font-mono text-text-tertiary w-20">{easing.name}</code>
                  <div className="flex-1 h-6 bg-surface-tertiary rounded overflow-hidden">
                    <div
                      className={clsx(
                        "h-full w-0 bg-primary rounded transition-all duration-500 group-hover:w-full",
                        easing.class,
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DemoCard>
        </div>

        {/* Motion Principles */}
        <div className="mt-6 rounded-xl border border-border bg-surface-secondary p-5">
          <h3 className="text-sm font-semibold text-text mb-3">Motion Principles</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { title: "Purposeful", desc: "Every animation serves a function: providing feedback, guiding attention, or showing relationships." },
              { title: "Subtle", desc: "Prefer micro-animations (color, opacity, small transforms) over dramatic effects. Less is more." },
              { title: "Consistent", desc: "Use the three standard durations (150/200/300ms) and ease-out for exits, ease-in-out for movements." },
            ].map((p) => (
              <div key={p.title}>
                <p className="text-xs font-medium text-text mb-1">{p.title}</p>
                <p className="text-[10px] text-text-tertiary leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};
