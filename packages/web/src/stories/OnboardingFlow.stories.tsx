import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  Sparkles, MessageSquare, Bot, Upload, Keyboard,
  ArrowRight, ArrowLeft, Check, Command, Plus,
  Search, Zap, Globe, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Kbd } from "@/components/ui/Kbd";

const meta: Meta = {
  title: "Patterns/OnboardingFlow",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

// ── Step Data ────────────────────────────────────────────────────────────

interface Step {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  iconColor: string;
  iconBg: string;
}

const steps: Step[] = [
  { id: "welcome", title: "Welcome to NOVA", subtitle: "Your AI-powered workspace", icon: Sparkles, iconColor: "text-primary", iconBg: "bg-primary/10" },
  { id: "profile", title: "Set Up Your Profile", subtitle: "Tell us about your work", icon: Bot, iconColor: "text-purple-500", iconBg: "bg-purple-500/10" },
  { id: "model", title: "Choose Your Model", subtitle: "Select a default AI model", icon: Globe, iconColor: "text-blue-500", iconBg: "bg-blue-500/10" },
  { id: "shortcuts", title: "Keyboard Shortcuts", subtitle: "Work faster with shortcuts", icon: Keyboard, iconColor: "text-orange-500", iconBg: "bg-orange-500/10" },
  { id: "done", title: "You're All Set!", subtitle: "Start exploring NOVA", icon: Check, iconColor: "text-success", iconBg: "bg-success/10" },
];

// ── Stories ───────────────────────────────────────────────────────────────

/** Interactive multi-step onboarding wizard */
export const Default: Story = {
  render: () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedModel, setSelectedModel] = useState("claude-sonnet-4");
    const step = steps[currentStep]!;
    const Icon = step.icon;

    const next = () => setCurrentStep((s) => Math.min(steps.length - 1, s + 1));
    const prev = () => setCurrentStep((s) => Math.max(0, s - 1));

    return (
      <div className="min-h-[600px] flex items-center justify-center bg-surface p-8">
        <div className="w-full max-w-lg">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={clsx(
                  "h-2 rounded-full transition-all duration-300",
                  i === currentStep ? "w-8 bg-primary" : i < currentStep ? "w-2 bg-primary/50" : "w-2 bg-surface-tertiary",
                )}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="rounded-2xl border border-border bg-surface-secondary p-8 text-center">
            <div className={clsx("h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4", step.iconBg)}>
              <Icon className={clsx("h-8 w-8", step.iconColor)} />
            </div>
            <h2 className="text-xl font-bold text-text mb-1">{step.title}</h2>
            <p className="text-sm text-text-secondary mb-6">{step.subtitle}</p>

            {/* Step-specific content */}
            {step.id === "welcome" && (
              <div className="space-y-3 text-left max-w-sm mx-auto">
                {[
                  { icon: MessageSquare, text: "Have conversations with AI models" },
                  { icon: Upload, text: "Upload documents for RAG-powered answers" },
                  { icon: Bot, text: "Create and use specialized agents" },
                  { icon: Shield, text: "Enterprise-grade security and privacy" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-text-tertiary" />
                    </div>
                    <p className="text-sm text-text-secondary">{item.text}</p>
                  </div>
                ))}
              </div>
            )}

            {step.id === "profile" && (
              <div className="space-y-4 text-left max-w-sm mx-auto">
                <Input label="Display Name" placeholder="Sarah Chen" />
                <Input label="Role" placeholder="Software Engineer" />
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-2 block">Preferences</label>
                  <div className="space-y-2">
                    <Switch label="Dark mode" checked />
                    <Switch label="Sound effects" />
                    <Switch label="Email notifications" checked />
                  </div>
                </div>
              </div>
            )}

            {step.id === "model" && (
              <div className="space-y-2 text-left max-w-sm mx-auto">
                {[
                  { id: "claude-sonnet-4", name: "Claude Sonnet 4", desc: "Best balance of speed and intelligence", recommended: true },
                  { id: "claude-opus-4", name: "Claude Opus 4", desc: "Most capable, for complex tasks" },
                  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", desc: "Fastest, for simple tasks" },
                ].map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={clsx(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                      selectedModel === model.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className={clsx(
                      "h-4 w-4 rounded-full border-2 transition-colors",
                      selectedModel === model.id ? "border-primary bg-primary" : "border-border",
                    )}>
                      {selectedModel === model.id && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{model.name}</span>
                        {model.recommended && (
                          <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">Recommended</span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary">{model.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step.id === "shortcuts" && (
              <div className="space-y-3 text-left max-w-sm mx-auto">
                {[
                  { keys: ["⌘", "K"], desc: "Open command palette" },
                  { keys: ["⌘", "N"], desc: "New conversation" },
                  { keys: ["⌘", "/"], desc: "Toggle sidebar" },
                  { keys: ["⌘", "⇧", "P"], desc: "Search commands" },
                  { keys: ["Esc"], desc: "Cancel / close" },
                ].map((shortcut) => (
                  <div key={shortcut.desc} className="flex items-center justify-between py-1">
                    <span className="text-sm text-text-secondary">{shortcut.desc}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step.id === "done" && (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary max-w-xs mx-auto">
                  Your workspace is ready. Start a conversation, upload documents, or explore the agent marketplace.
                </p>
                <Button>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Start Using NOVA
                </Button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={prev}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <span className="text-xs text-text-tertiary">
              {currentStep + 1} of {steps.length}
            </span>
            {currentStep < steps.length - 1 ? (
              <Button size="sm" onClick={next}>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <div className="w-20" />
            )}
          </div>
        </div>
      </div>
    );
  },
};

/** Individual step: Welcome */
export const WelcomeStep: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[400px] bg-surface p-8">
      <div className="max-w-lg text-center">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">Welcome to NOVA</h1>
        <p className="text-sm text-text-secondary mb-8 max-w-sm mx-auto">
          NOVA is your self-hosted AI workspace. Let&apos;s get you set up in just a few steps.
        </p>
        <Button>
          Get Started
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  ),
};

/** Completion step */
export const CompletionStep: Story = {
  render: () => (
    <div className="flex items-center justify-center min-h-[400px] bg-surface p-8">
      <div className="max-w-lg text-center">
        <div className="h-20 w-20 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">You&apos;re All Set!</h1>
        <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
          Your NOVA workspace is configured and ready to use.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary">
            <Search className="h-4 w-4 mr-1.5" />
            Explore Agents
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            New Conversation
          </Button>
        </div>
      </div>
    </div>
  ),
};
