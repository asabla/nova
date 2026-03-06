import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  MessageSquare,
  Bot,
  Upload,
  Keyboard,
  ArrowRight,
  ArrowLeft,
  Check,
  Command,
  Plus,
  Search,
  FileText,
  Folder,
} from "lucide-react";
import { Button } from "../ui/Button";

const ONBOARDING_STORAGE_KEY = "nova:onboarding-completed";

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface StepDef {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  details?: React.ReactNode;
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border text-xs font-mono text-text-secondary">
      {children}
    </kbd>
  );
}

const steps: StepDef[] = [
  {
    id: "welcome",
    title: "Welcome to NOVA",
    subtitle: "Your AI platform, your way",
    description:
      "NOVA is a self-hosted AI chat platform built for teams. Interact with multiple AI models, build custom agents, and manage knowledge -- all in one place.",
    icon: Sparkles,
    color: "text-primary",
    bgColor: "bg-primary/10",
    details: (
      <div className="grid grid-cols-3 gap-3 mt-2">
        {[
          { label: "Multi-model", desc: "Switch between AI providers" },
          { label: "Self-hosted", desc: "Your data, your infrastructure" },
          { label: "Team-ready", desc: "Built for collaboration" },
        ].map((f) => (
          <div
            key={f.label}
            className="p-3 rounded-xl bg-surface-secondary border border-border text-center"
          >
            <p className="text-xs font-semibold text-text">{f.label}</p>
            <p className="text-[10px] text-text-tertiary mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "conversations",
    title: "Start a Conversation",
    subtitle: "Chat with AI naturally",
    description:
      "Create a new conversation to begin chatting. Type your message, choose a model, and get streaming responses in real-time. You can branch conversations, attach files, and set system prompts.",
    icon: MessageSquare,
    color: "text-success",
    bgColor: "bg-success/10",
    details: (
      <div className="space-y-2 mt-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
          <Plus className="h-4 w-4 text-success shrink-0" />
          <div>
            <p className="text-xs font-medium text-text">New conversation</p>
            <p className="text-[10px] text-text-tertiary">
              Click the + button in the sidebar or press{" "}
              <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">
                Cmd+N
              </kbd>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
          <MessageSquare className="h-4 w-4 text-success shrink-0" />
          <div>
            <p className="text-xs font-medium text-text">Type and send</p>
            <p className="text-[10px] text-text-tertiary">
              Write your message and press Enter to send
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "agents",
    title: "Use Agents",
    subtitle: "Custom AI assistants for any task",
    description:
      "Agents are AI assistants with specific instructions, tools, and knowledge bases. Select an agent at the start of a conversation, or browse the agent library to find one that fits your task.",
    icon: Bot,
    color: "text-warning",
    bgColor: "bg-warning/10",
    details: (
      <div className="space-y-2 mt-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
          <Bot className="h-4 w-4 text-warning shrink-0" />
          <div>
            <p className="text-xs font-medium text-text">Select an agent</p>
            <p className="text-[10px] text-text-tertiary">
              Choose from pre-built or custom agents before chatting
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
          <Plus className="h-4 w-4 text-warning shrink-0" />
          <div>
            <p className="text-xs font-medium text-text">Build your own</p>
            <p className="text-[10px] text-text-tertiary">
              Define instructions, attach tools, and share with your team
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "files",
    title: "Upload Files",
    subtitle: "Give AI the context it needs",
    description:
      "Drag and drop files into any conversation, or build a knowledge base of documents. Agents can search your knowledge base to provide grounded, accurate answers.",
    icon: Upload,
    color: "text-primary",
    bgColor: "bg-primary/10",
    details: (
      <div className="space-y-2 mt-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs font-medium text-text">In-chat uploads</p>
            <p className="text-[10px] text-text-tertiary">
              Drag files into the chat or click the attachment button
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
          <Folder className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-xs font-medium text-text">Knowledge bases</p>
            <p className="text-[10px] text-text-tertiary">
              Organize documents into searchable collections
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "shortcuts",
    title: "Keyboard Shortcuts",
    subtitle: "Work faster with shortcuts",
    description:
      "NOVA is built for speed. Use keyboard shortcuts to navigate, search, and manage conversations without touching your mouse.",
    icon: Keyboard,
    color: "text-text-secondary",
    bgColor: "bg-surface-secondary",
    details: (
      <div className="space-y-2 mt-2">
        {[
          {
            keys: (
              <>
                <Command className="h-3 w-3" /> K
              </>
            ),
            label: "Command palette",
            desc: "Search anything",
          },
          {
            keys: (
              <>
                <Command className="h-3 w-3" /> N
              </>
            ),
            label: "New conversation",
            desc: "Start fresh",
          },
          {
            keys: (
              <>
                <Command className="h-3 w-3" /> /
              </>
            ),
            label: "Focus input",
            desc: "Jump to message box",
          },
          {
            keys: (
              <>
                <Command className="h-3 w-3" /> ?
              </>
            ),
            label: "Shortcuts help",
            desc: "View all shortcuts",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border"
          >
            <div className="flex items-center gap-3">
              <ShortcutKey>{s.keys}</ShortcutKey>
              <div>
                <p className="text-xs font-medium text-text">{s.label}</p>
                <p className="text-[10px] text-text-tertiary">{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

export function markOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // localStorage unavailable
  }
}

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const Icon = step.icon;

  const handleComplete = useCallback(() => {
    markOnboardingComplete();
    onComplete();
  }, [onComplete]);

  const handleFinish = useCallback(() => {
    handleComplete();
    navigate({ to: "/conversations/new" });
  }, [handleComplete, navigate]);

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/95 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentStep
                  ? "bg-primary w-8"
                  : idx < currentStep
                    ? "bg-primary/50 w-4"
                    : "bg-border w-2"
              }`}
              aria-label={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Step counter */}
        <p className="text-center text-[10px] text-text-tertiary mb-4 uppercase tracking-wider font-medium">
          Step {currentStep + 1} of {steps.length}
        </p>

        {/* Content */}
        <div className="text-center">
          <div className="flex justify-center mb-5">
            <div
              className={`h-20 w-20 rounded-3xl ${step.bgColor} flex items-center justify-center transition-colors`}
            >
              <Icon className={`h-10 w-10 ${step.color}`} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-text mb-1">{step.title}</h2>
          <p className="text-sm font-medium text-text-secondary mb-3">
            {step.subtitle}
          </p>
          <p className="text-sm text-text-tertiary leading-relaxed max-w-md mx-auto mb-4">
            {step.description}
          </p>

          {/* Step-specific details */}
          {step.details && (
            <div className="max-w-sm mx-auto mb-6">{step.details}</div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-center gap-3 mt-6">
            {!isFirst && (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button variant="primary" size="lg" onClick={handleNext}>
              {isLast ? (
                <>
                  <Check className="h-4 w-4" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {!isLast && (
            <button
              onClick={handleSkip}
              className="text-xs text-text-tertiary hover:text-text-secondary mt-6 underline underline-offset-2 transition-colors"
            >
              Skip tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
