import { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp, Lightbulb, Code2, Palette, BarChart3,
  ArrowRight, RefreshCw, MessageSquare, Paperclip,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { useAuthStore } from "../../stores/auth.store";

export const Route = createFileRoute("/_auth/")({
  component: HomePage,
});

function getGreeting(t: (key: string, fallback: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("home.goodMorning", "Good morning");
  if (hour < 18) return t("home.goodAfternoon", "Good afternoon");
  return t("home.goodEvening", "Good evening");
}

function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const greeting = getGreeting(t);
  const firstName = user?.name?.split(" ")[0] || "";

  const quickStarters = [
    {
      icon: Lightbulb,
      color: "text-amber-500",
      bg: "bg-amber-500/8",
      label: t("home.starterExplain", "Explain a concept"),
      message: t("home.starterExplainMessage", "Explain how neural networks learn, starting from the basics and building up to backpropagation."),
    },
    {
      icon: Code2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/8",
      label: t("home.starterReview", "Review my code"),
      message: t("home.starterReviewMessage", "Review this code for bugs, performance issues, and best practices. Suggest improvements:\n\n```\n// Paste your code here\n```"),
    },
    {
      icon: Palette,
      color: "text-primary",
      bg: "bg-primary/8",
      label: t("home.starterWrite", "Help me write"),
      message: t("home.starterWriteMessage", "Help me draft a clear, engaging piece of writing on the following topic:\n\n[Describe your topic here]"),
    },
    {
      icon: BarChart3,
      color: "text-rose-500",
      bg: "bg-rose-500/8",
      label: t("home.starterAnalyze", "Analyze data"),
      message: t("home.starterAnalyzeMessage", "Analyze the following data and identify key trends, patterns, and actionable insights:\n\n[Paste your data here]"),
    },
  ];

  const { data: conversationsData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.conversations.list({ isArchived: false }),
    queryFn: () => api.get<any>(`/api/conversations?isArchived=false`),
    staleTime: 30_000,
  });

  const conversations = conversationsData?.data ?? [];
  const recentConversations = conversations.slice(0, 5);

  const handleStartConversation = (starterMessage: string) => {
    try {
      sessionStorage.setItem("nova:starter-message", starterMessage);
    } catch { /* sessionStorage unavailable */ }
    navigate({ to: "/conversations/new" });
  };

  const handleSend = () => {
    const text = message.trim();
    if (!text) return;
    handleStartConversation(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [message]);

  // Focus the textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 pt-16 pb-12 page-enter">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-text tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-base text-text-tertiary mt-2">
            {t("home.subtitle", "What would you like to explore today?")}
          </p>
        </div>

        {/* Chat Input — hero element with signature glow */}
        <div className="relative mb-10">
          <div className="rounded-2xl border border-border bg-surface shadow-sm input-glow transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("home.inputPlaceholder", "Ask anything...")}
              rows={2}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-text placeholder:text-text-tertiary px-5 pt-5 pb-2 focus:outline-none rounded-2xl"
            />
            <div className="flex items-center justify-between px-4 pb-3.5">
              <div className="flex items-center gap-1">
                <button
                  className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
                  aria-label={t("home.attach", "Attach file")}
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={!message.trim()}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-25 disabled:cursor-not-allowed hover:bg-primary-dark active:scale-95 transition-all duration-150"
                aria-label={t("home.send", "Send message")}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Starters */}
        <div className="mb-12 stagger-children">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {quickStarters.map((starter) => {
              const Icon = starter.icon;
              return (
                <button
                  key={starter.label}
                  onClick={() => handleStartConversation(starter.message)}
                  className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-border-strong transition-all text-center group hover-lift"
                >
                  <div className={`h-10 w-10 rounded-xl ${starter.bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${starter.color}`} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-text-secondary group-hover:text-text transition-colors leading-tight">
                    {starter.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Conversations */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3 px-1">
            {t("home.recentConversations", "Recent conversations")}
          </h2>

          {isLoading && (
            <div className="grid grid-cols-1 gap-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {isError && (
            <div className="text-center py-8">
              <p className="text-sm text-text-secondary mb-3">
                {t("home.loadError", "Failed to load recent conversations")}
              </p>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {t("common.retry", "Retry")}
              </Button>
            </div>
          )}

          {!isLoading && !isError && recentConversations.length === 0 && (
            <div className="text-center py-10 rounded-2xl border border-dashed border-border bg-surface-secondary/40">
              <MessageSquare className="h-9 w-9 text-text-tertiary mx-auto mb-3 opacity-30" />
              <p className="text-sm text-text-secondary font-medium">
                {t("home.noConversations", "No conversations yet")}
              </p>
              <p className="text-xs text-text-tertiary mt-1.5">
                {t("home.startPrompt", "Start typing above to begin")}
              </p>
            </div>
          )}

          {!isLoading && !isError && recentConversations.length > 0 && (
            <div className="space-y-0.5 stagger-children">
              {recentConversations.map((conv: any) => (
                <button
                  key={conv.id}
                  onClick={() => navigate({ to: `/conversations/${conv.id}` })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-secondary transition-all duration-150 text-left group"
                >
                  <MessageSquare className="h-4 w-4 text-text-tertiary shrink-0" aria-hidden="true" />
                  <span className="text-sm text-text-secondary group-hover:text-text truncate flex-1 transition-colors">
                    {conv.title ?? t("conversations.untitled", "Untitled")}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-tertiary ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
