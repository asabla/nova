import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, MessageSquare, Bot, BookOpen, ArrowRight, Check } from "lucide-react";
import { Button } from "../ui/Button";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const steps = [
  {
    id: "welcome",
    title: "Welcome to NOVA",
    description: "Your self-hosted AI platform. Let's get you set up in just a few steps.",
    icon: Sparkles,
    color: "text-primary",
  },
  {
    id: "conversations",
    title: "Start Conversations",
    description: "Chat with AI models using natural language. Attach files, switch models mid-conversation, and customize with system prompts.",
    icon: MessageSquare,
    color: "text-success",
  },
  {
    id: "agents",
    title: "Build Agents",
    description: "Create custom AI agents with specific instructions, tools, and knowledge bases. Share them with your team.",
    icon: Bot,
    color: "text-warning",
  },
  {
    id: "knowledge",
    title: "Knowledge Base",
    description: "Upload documents and build searchable collections. Your agents can use them for context-aware, grounded answers.",
    icon: BookOpen,
    color: "text-primary",
  },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const Icon = step.icon;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      navigate({ to: "/conversations/new" });
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/95 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx <= currentStep ? "bg-primary w-8" : "bg-border w-2"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
              <Icon className={`h-10 w-10 ${step.color}`} />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-text mb-3">{step.title}</h2>
          <p className="text-text-secondary leading-relaxed max-w-md mx-auto mb-8">
            {step.description}
          </p>

          <div className="flex items-center justify-center gap-4">
            {currentStep > 0 && (
              <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)}>
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
              onClick={onComplete}
              className="text-xs text-text-tertiary hover:text-text-secondary mt-6 underline"
            >
              Skip tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
