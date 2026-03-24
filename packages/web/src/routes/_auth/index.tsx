import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  ArrowRight, RefreshCw, MessageSquare, Paperclip, X, FileText, Microscope,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { useAuthStore } from "../../stores/auth.store";
import { setPendingFiles as storePendingFiles } from "../../lib/pending-files";
import { ALLOWED_MIME_TYPES } from "@nova/shared/constants";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { MentionPopup, useMentionTrigger, type MentionCandidate } from "../../components/chat/MentionPopup";
import { SlashCommand } from "../../components/chat/SlashCommand";
import { useSlashCommandTrigger } from "../../components/chat/useSlashCommandTrigger";
import { Dialog } from "../../components/ui/Dialog";
import { NewResearchForm, type NewResearchFormSubmitData } from "../../components/research/NewResearchForm";
import { toast } from "../../components/ui/Toast";
import { TemplateInputDialog } from "../../components/explore/TemplateInputDialog";
import { sampleConversations, type SampleConversation } from "./explore";

export const Route = createFileRoute("/_auth/")({
  component: () => (
    <ErrorBoundary>
      <HomePage />
    </ErrorBoundary>
  ),
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
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [message, setMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [researchModalOpen, setResearchModalOpen] = useState(false);
  const [selectedStarter, setSelectedStarter] = useState<SampleConversation | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startResearch = useMutation({
    mutationFn: (data: NewResearchFormSubmitData) =>
      api.post<any>("/api/research", data),
    onSuccess: (data: any) => {
      toast(t("research.started", "Research started"), "success");
      queryClient.invalidateQueries({ queryKey: ["research-reports"] });
      setResearchModalOpen(false);
      navigate({ to: "/research", search: { report: data.id } });
    },
    onError: (err: any) =>
      toast(err.message ?? t("research.startFailed", "Failed to start research"), "error"),
  });

  const greeting = getGreeting(t);
  const firstName = user?.name?.split(" ")[0] || "";

  // --- @mention support ---
  const mention = useMentionTrigger(message, textareaRef);
  const handleMentionSelect = useCallback(
    (candidate: MentionCandidate) => {
      const newValue = mention.handleSelect(candidate);
      setMessage(newValue);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [mention.handleSelect],
  );

  // --- /slash command support ---
  const slash = useSlashCommandTrigger(message, textareaRef);
  const handleSlashSelect = useCallback(
    (command: string) => {
      const newValue = slash.handleSelect(command);
      setMessage(newValue);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [slash.handleSelect],
  );

  const quickStarters = useMemo(() => {
    const shuffled = [...sampleConversations];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3);
  }, []);

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
    if (!text && pendingFiles.length === 0) return;
    if (pendingFiles.length > 0) {
      storePendingFiles(pendingFiles);
    }
    handleStartConversation(text || "Attached files");
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mention.active || slash.active) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Escape") {
        return;
      }
    }
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
          <div className="relative rounded-2xl border border-border bg-surface shadow-sm input-glow transition-all duration-200">
            <MentionPopup
              {...mention.popupProps}
              onSelect={handleMentionSelect}
            />
            <SlashCommand
              {...slash.popupProps}
              onSelect={handleSlashSelect}
            />
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                {pendingFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-secondary border border-border text-xs text-text-secondary max-w-[200px]">
                    <FileText className="h-3 w-3 shrink-0 text-text-tertiary" aria-hidden="true" />
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="shrink-0 text-text-tertiary hover:text-text" aria-label="Remove">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("home.inputPlaceholder", "Ask anything...")}
              rows={2}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-text placeholder:text-text-tertiary px-5 pt-5 pb-2 outline-none ring-0 focus:outline-none focus:ring-0 focus:shadow-none"
            />
            <div className="flex items-center justify-between px-4 pb-3.5">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ALLOWED_MIME_TYPES.join(",")}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
                  aria-label={t("home.attach", "Attach file")}
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setResearchModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-text-secondary hover:text-primary hover:bg-primary/10 border border-border hover:border-primary/30 transition-colors"
                  aria-label={t("research.deepResearch", { defaultValue: "Deep Research" })}
                >
                  <Microscope className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("research.research", { defaultValue: "Research" })}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!message.trim() && pendingFiles.length === 0}
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-25 disabled:cursor-not-allowed hover:bg-primary-dark active:scale-95 transition-all duration-150"
                  aria-label={t("home.send", "Send message")}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
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
                  key={starter.id}
                  onClick={() => setSelectedStarter(starter)}
                  className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-border-strong transition-all text-center group hover-lift"
                >
                  <div className={`h-10 w-10 rounded-xl ${starter.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${starter.color}`} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-medium text-text-secondary group-hover:text-text transition-colors leading-tight">
                    {starter.title}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setResearchModalOpen(true)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-primary/30 transition-all text-center group hover-lift"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center">
                <Microscope className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-xs font-medium text-text-secondary group-hover:text-text transition-colors leading-tight">
                {t("home.starterResearch", "Deep Research")}
              </span>
            </button>
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

      {/* Deep Research modal */}
      <Dialog
        open={researchModalOpen}
        onClose={() => setResearchModalOpen(false)}
        title={t("research.deepResearch", { defaultValue: "Deep Research" })}
        size="md"
      >
        <NewResearchForm
          compact
          isPending={startResearch.isPending}
          defaultValues={message.trim() ? { query: message.trim() } : undefined}
          onSubmit={(data) => startResearch.mutate(data)}
        />
      </Dialog>

      {/* Starter input dialog */}
      <TemplateInputDialog
        open={!!selectedStarter}
        onClose={() => setSelectedStarter(null)}
        conversation={selectedStarter}
        onSubmit={(resolvedMessage, files) => {
          if (files?.length) {
            storePendingFiles(files);
          }
          setSelectedStarter(null);
          handleStartConversation(resolvedMessage);
        }}
      />
    </div>
  );
}
