import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquarePlus, Sparkles, Bot, BookOpen, Wrench, Code2,
  Microscope, ArrowRight, Lightbulb, Palette, BarChart3,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

export const Route = createFileRoute("/_auth/")({
  component: HomePage,
});

const quickStarters = [
  {
    icon: Lightbulb,
    color: "text-warning",
    bgColor: "bg-warning/10",
    label: "Explain a concept",
    message: "Explain how neural networks learn, starting from the basics and building up to backpropagation.",
  },
  {
    icon: Code2,
    color: "text-success",
    bgColor: "bg-success/10",
    label: "Review my code",
    message: "Review this code for bugs, performance issues, and best practices. Suggest improvements:\n\n```\n// Paste your code here\n```",
  },
  {
    icon: Palette,
    color: "text-primary",
    bgColor: "bg-primary/10",
    label: "Help me write",
    message: "Help me draft a clear, engaging piece of writing on the following topic:\n\n[Describe your topic here]",
  },
  {
    icon: BarChart3,
    color: "text-danger",
    bgColor: "bg-danger/10",
    label: "Analyze data",
    message: "Analyze the following data and identify key trends, patterns, and actionable insights:\n\n[Paste your data here]",
  },
];

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: conversationsData } = useQuery({
    queryKey: queryKeys.conversations.list({ isArchived: false }),
    queryFn: () => api.get<any>(`/api/conversations?isArchived=false`),
    staleTime: 30_000,
  });

  const conversations = conversationsData?.data ?? [];
  const recentConversations = conversations.slice(0, 3);

  const handleStartConversation = (starterMessage: string) => {
    try {
      sessionStorage.setItem("nova:starter-message", starterMessage);
    } catch { /* sessionStorage unavailable */ }
    navigate({ to: "/conversations/new" });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-text mb-2">
            {t("app.welcome")}
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            {t("app.description")}
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate({ to: "/conversations/new" })}
          >
            <MessageSquarePlus className="h-5 w-5" />
            {t("conversations.new")}
          </Button>
        </div>

        {/* Quick Starters */}
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-text mb-3">Try something</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickStarters.map((starter) => {
              const Icon = starter.icon;
              return (
                <button
                  key={starter.label}
                  onClick={() => handleStartConversation(starter.message)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary border border-border hover:border-border-strong hover:bg-surface-tertiary transition-colors text-left group"
                >
                  <div className={`h-8 w-8 rounded-lg ${starter.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 ${starter.color}`} />
                  </div>
                  <span className="text-sm text-text-secondary group-hover:text-text transition-colors">
                    {starter.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-tertiary ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Conversations */}
        {recentConversations.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-text mb-3">Recent conversations</h2>
            <div className="space-y-1">
              {recentConversations.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => navigate({ to: `/conversations/${conv.id}` })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-secondary transition-colors text-left group"
                >
                  <MessageSquarePlus className="h-4 w-4 text-text-tertiary shrink-0" />
                  <span className="text-sm text-text-secondary group-hover:text-text truncate">
                    {conv.title ?? "Untitled"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-tertiary ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-text mb-3">Quick links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <QuickLink icon={Bot} label={t("nav.agents")} to="/agents" />
            <QuickLink icon={BookOpen} label={t("nav.knowledge")} to="/knowledge" />
            <QuickLink icon={Wrench} label={t("nav.tools")} to="/tools" />
            <QuickLink icon={Microscope} label={t("nav.research")} to="/research" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to })}
      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-secondary border border-border hover:border-border-strong hover:bg-surface-tertiary transition-colors"
    >
      <Icon className="h-5 w-5 text-text-tertiary" />
      <span className="text-xs text-text-secondary">{label}</span>
    </button>
  );
}
