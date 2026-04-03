import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Sparkles, MessageSquare, Bot, BookOpen, Settings, ArrowRight, ArrowLeft,
  Check, Palette, Bell, Shield, Zap, Loader2,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Switch } from "../../components/ui/Switch";
import { toast } from "../../components/ui/Toast";
import { useAuthStore } from "../../stores/auth.store";

export const Route = createFileRoute("/_auth/onboarding")({
  component: OnboardingPage,
});

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  content: React.ReactNode;
}

function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState({
    theme: "dark",
    defaultModel: "",
    enableNotifications: true,
    setupComplete: false,
  });

  const completeOnboarding = useMutation({
    mutationFn: () => api.post("/api/users/me/onboarding-complete", preferences),
    onSuccess: () => {
      useAuthStore.setState({ onboardingCompleted: true });
      navigate({ to: "/" });
    },
    onError: () => {
      toast(t("onboarding.completeFailed", "Failed to complete onboarding. Please try again."), "error");
    },
  });

  const steps: Step[] = [
    {
      id: "welcome",
      title: t("onboarding.welcomeTitle", "Welcome to NOVA"),
      description: t("onboarding.welcomeDesc", "Your self-hosted AI platform for teams"),
      icon: Sparkles,
      color: "text-primary",
      content: (
        <div className="text-center space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text">{t("onboarding.welcomeTitle", "Welcome to NOVA")}</h2>
            <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
              {t("onboarding.welcomeBody", "NOVA is a powerful AI platform that gives you and your team access to multiple AI models, custom agents, knowledge bases, and more.")}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            <FeatureCard icon={MessageSquare} title={t("onboarding.featureConversations", "Conversations")} desc={t("onboarding.featureConversationsDesc", "Chat with AI models")} />
            <FeatureCard icon={Bot} title={t("onboarding.featureAgents", "Agents")} desc={t("onboarding.featureAgentsDesc", "Custom AI assistants")} />
            <FeatureCard icon={BookOpen} title={t("onboarding.featureKnowledge", "Knowledge")} desc={t("onboarding.featureKnowledgeDesc", "RAG-powered search")} />
          </div>
        </div>
      ),
    },
    {
      id: "appearance",
      title: t("onboarding.appearanceTitle", "Customize Appearance"),
      description: t("onboarding.appearanceDesc", "Choose your preferred theme and display settings"),
      icon: Palette,
      color: "text-purple-400",
      content: (
        <div className="space-y-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-text text-center">{t("onboarding.chooseTheme", "Choose Your Theme")}</h3>
          <div className="grid grid-cols-3 gap-4">
            {(["light", "dark", "system"] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => setPreferences((p) => ({ ...p, theme }))}
                className={`p-4 rounded-xl border-2 transition-all ${
                  preferences.theme === theme
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <div className={`h-8 w-8 rounded-lg mx-auto mb-2 ${
                  theme === "dark" ? "bg-gray-900" : theme === "light" ? "bg-gray-100" : "bg-gradient-to-br from-gray-100 to-gray-900"
                }`} />
                <span className="text-sm font-medium text-text capitalize">{theme}</span>
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "notifications",
      title: t("onboarding.notificationsTitle", "Notification Preferences"),
      description: t("onboarding.notificationsDesc", "Choose how you'd like to be notified"),
      icon: Bell,
      color: "text-warning",
      content: (
        <div className="space-y-4 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-text text-center">{t("onboarding.stayInformed", "Stay Informed")}</h3>
          <div className="space-y-3">
            <Switch
              label={t("onboarding.inAppNotifications", "In-app Notifications")}
              description={t("onboarding.inAppNotificationsDesc", "Get notified about mentions, replies, and agent completions")}
              checked={preferences.enableNotifications}
              onChange={(v) => setPreferences((p) => ({ ...p, enableNotifications: v }))}
            />
            <Switch
              label={t("onboarding.desktopNotifications", "Desktop Notifications")}
              description={t("onboarding.desktopNotificationsDesc", "Show browser notifications for important events")}
              checked={false}
              onChange={() => {
                if ("Notification" in window) {
                  Notification.requestPermission();
                }
              }}
            />
          </div>
        </div>
      ),
    },
    {
      id: "security",
      title: t("onboarding.securityTitle", "Security Setup"),
      description: t("onboarding.securityDesc", "Protect your account"),
      icon: Shield,
      color: "text-success",
      content: (
        <div className="space-y-6 max-w-md mx-auto text-center">
          <h3 className="text-lg font-semibold text-text">{t("onboarding.securityTips", "Security Tips")}</h3>
          <div className="space-y-3 text-left">
            <Tip icon={Shield} text={t("onboarding.tip2fa", "Enable two-factor authentication in Settings > Security")} />
            <Tip icon={Zap} text={t("onboarding.tipApiKeys", "API keys are scoped to your organization and can be rotated anytime")} />
            <Tip icon={Settings} text={t("onboarding.tipSessions", "Review your active sessions periodically")} />
          </div>
        </div>
      ),
    },
    {
      id: "ready",
      title: t("onboarding.readyTitle", "You're All Set!"),
      description: t("onboarding.readyDesc", "Start exploring NOVA"),
      icon: Check,
      color: "text-success",
      content: (
        <div className="text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text">{t("onboarding.readyHeading", "You're Ready!")}</h2>
            <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
              {t("onboarding.readyBody", "Start a conversation, create an agent, or explore sample conversations to see what NOVA can do.")}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => navigate({ to: "/explore" })}>
              {t("onboarding.exploreExamples", "Explore Examples")}
            </Button>
            <Button variant="primary" onClick={() => completeOnboarding.mutate()} loading={completeOnboarding.isPending}>
              {completeOnboarding.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              )}
              {t("onboarding.startChatting", "Start Chatting")}
            </Button>
          </div>
        </div>
      ),
    },
  ];

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(i)}
            className={`h-2 rounded-full transition-all ${
              i === currentStep ? "w-8 bg-primary" : i < currentStep ? "w-2 bg-primary/50" : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="w-full max-w-xl">
        {step.content}
      </div>

      {/* Navigation */}
      {!isLast && (
        <div className="flex items-center gap-4 mt-8">
          {!isFirst && (
            <Button variant="ghost" onClick={() => setCurrentStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("onboarding.back", "Back")}
            </Button>
          )}
          <Button variant="primary" onClick={() => setCurrentStep((s) => s + 1)}>
            {isFirst ? t("onboarding.getStarted", "Get Started") : t("onboarding.next", "Next")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          {isFirst && (
            <button
              onClick={() => completeOnboarding.mutate()}
              className="text-xs text-text-tertiary hover:text-text-secondary"
            >
              {t("onboarding.skipTutorial", "Skip tutorial")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="p-3 rounded-xl bg-surface-secondary border border-border text-center">
      <Icon className="h-5 w-5 text-primary mx-auto mb-1.5" />
      <p className="text-xs font-medium text-text">{title}</p>
      <p className="text-[10px] text-text-tertiary">{desc}</p>
    </div>
  );
}


function Tip({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-secondary border border-border">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <p className="text-sm text-text-secondary">{text}</p>
    </div>
  );
}
