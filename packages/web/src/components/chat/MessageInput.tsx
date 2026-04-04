import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query-keys";
import { Send, Square, Paperclip, Pause, Play, Microscope, X, Sparkles, Database, Check, Search } from "lucide-react";
import { clsx } from "clsx";
import { VoiceInput } from "./VoiceInput";
import { AttachmentBar } from "./AttachmentBar";
import { MentionPopup, useMentionTrigger, type MentionCandidate } from "./MentionPopup";
import { SlashCommand, getSlashCommand } from "./SlashCommand";
import { useSlashCommandTrigger } from "./useSlashCommandTrigger";
import { HelpDialog } from "./HelpDialog";
import { PromptPickerDialog } from "./PromptPickerDialog";
import { Dialog } from "../ui/Dialog";
import { NewResearchForm, type NewResearchFormSubmitData } from "../research/NewResearchForm";
import { api } from "../../lib/api";
import { toast } from "../ui/Toast";

interface MessageInputProps {
  onSend: (content: string, files?: File[]) => void;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isStreaming?: boolean;
  isPaused?: boolean;
  disabled?: boolean;
  onFileUpload?: (files: File[]) => void;
  onTyping?: () => void;
  conversationId?: string;
  onSlashCommand?: (command: string, args?: string) => void;
  onClearConversation?: () => void;
  onExportConversation?: () => void;
}

// ---------------------------------------------------------------------------
// Research intent detection (high threshold)
// ---------------------------------------------------------------------------

const RESEARCH_START_PATTERNS = [
  /^research\b/i,
  /^deep\s*dive\s+(into|on)\b/i,
  /^investigate\b/i,
  /^find\s+sources?\s+(about|on|for)\b/i,
  /^comprehensive\s+(analysis|review|overview|report)\s+(of|on|about)\b/i,
  /^thorough(ly)?\s+(research|investigate|analyze|review)\b/i,
  /^in-depth\s+(research|analysis|review|report)\b/i,
];

const RESEARCH_KEYWORD_PATTERNS = [
  /\bwith\s+(sources|citations|references)\b/i,
  /\bcite\s+sources\b/i,
  /\bresearch\s+report\b/i,
  /\bliterature\s+review\b/i,
];

function detectResearchIntent(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;
  if (RESEARCH_START_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (RESEARCH_KEYWORD_PATTERNS.some((p) => p.test(trimmed))) return true;
  return false;
}

export function MessageInput({ onSend, onStop, onPause, onResume, isStreaming, isPaused, disabled, onFileUpload, onTyping, conversationId, onSlashCommand, onClearConversation, onExportConversation }: MessageInputProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);
  const [researchModalOpen, setResearchModalOpen] = useState(false);
  const [researchDismissed, setResearchDismissed] = useState(false);

  // --- Knowledge collection quick-attach ---
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const knowledgeRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!knowledgeOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (knowledgeRef.current && !knowledgeRef.current.contains(e.target as Node)) {
        setKnowledgeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [knowledgeOpen]);

  const { data: attachedKnowledgeData } = useQuery({
    queryKey: queryKeys.conversations.knowledge(conversationId ?? ""),
    queryFn: () => api.get<any>(`/api/conversations/${conversationId}/knowledge`),
    enabled: !!conversationId,
    staleTime: 30_000,
  });

  const { data: allKnowledgeData } = useQuery({
    queryKey: queryKeys.knowledge.list(),
    queryFn: () => api.get<any>("/api/knowledge?limit=100"),
    enabled: knowledgeOpen,
    staleTime: 30_000,
  });

  const attachedCollections: { knowledgeCollectionId: string; name: string }[] = (attachedKnowledgeData as any)?.data ?? [];
  const allCollections: { id: string; name: string; description: string | null }[] = (allKnowledgeData as any)?.data ?? [];
  const attachedIds = new Set(attachedCollections.map((c) => c.knowledgeCollectionId));
  const knowledgeCount = attachedCollections.length;

  const filteredKnowledge = useMemo(
    () => knowledgeSearch
      ? allCollections.filter((c) => c.name.toLowerCase().includes(knowledgeSearch.toLowerCase()))
      : allCollections,
    [allCollections, knowledgeSearch],
  );

  const attachKnowledge = useMutation({
    mutationFn: (knowledgeCollectionId: string) =>
      api.post(`/api/conversations/${conversationId}/knowledge`, { knowledgeCollectionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.knowledge(conversationId ?? "") });
    },
  });

  const detachKnowledge = useMutation({
    mutationFn: (collectionId: string) =>
      api.delete(`/api/conversations/${conversationId}/knowledge/${collectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.knowledge(conversationId ?? "") });
    },
  });

  // Auto-save draft on disconnect / page unload (story #202)
  const draftKey = conversationId ? `nova:message-draft:${conversationId}` : "nova:message-draft";
  const [content, setContent] = useState(() => {
    try { return localStorage.getItem(draftKey) ?? ""; } catch { return ""; }
  });

  // Research mutation
  const startResearch = useMutation({
    mutationFn: (data: NewResearchFormSubmitData) =>
      api.post<any>("/api/research", { ...data, conversationId }),
    onSuccess: (data: any) => {
      toast(t("research.started", "Research started"), "success");
      queryClient.invalidateQueries({ queryKey: ["research-reports"] });
      setResearchModalOpen(false);
      navigate({ to: "/research", search: { report: data.id } });
    },
    onError: (err: any) =>
      toast(err.message ?? t("research.startFailed", "Failed to start research"), "error"),
  });

  // Smart research detection
  const showResearchSuggestion = useMemo(
    () => !researchDismissed && !isStreaming && detectResearchIntent(content),
    [content, researchDismissed, isStreaming],
  );

  // Reset dismissed state when content changes significantly
  const prevContentRef = useRef(content);
  useEffect(() => {
    if (researchDismissed && content.trim() !== prevContentRef.current.trim()) {
      setResearchDismissed(false);
    }
    prevContentRef.current = content;
  }, [content, researchDismissed]);

  // Save draft to localStorage on change
  const saveDraftTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraft = useCallback((text: string) => {
    if (saveDraftTimeout.current) clearTimeout(saveDraftTimeout.current);
    saveDraftTimeout.current = setTimeout(() => {
      try {
        if (text.trim()) localStorage.setItem(draftKey, text);
        else localStorage.removeItem(draftKey);
      } catch { /* ignore */ }
    }, 500);
  }, []);

  // --- @mention system (stories #45, #46) ---
  const mention = useMentionTrigger(content, textareaRef);

  // --- /slash command system ---
  const slash = useSlashCommandTrigger(content, textareaRef);

  const handleSlashSelect = useCallback(
    (command: string) => {
      const def = getSlashCommand(command);
      if (!def) return;

      if (command === "/prompt") {
        setContent("");
        saveDraft("");
        setPromptPickerOpen(true);
      } else if (def.clientOnly) {
        if (command === "/help") {
          setContent("");
          saveDraft("");
          setHelpOpen(true);
        } else {
          setContent("");
          saveDraft("");
          switch (command) {
            case "/clear":
              onClearConversation?.();
              break;
            case "/export":
              onExportConversation?.();
              break;
          }
        }
      } else {
        const newValue = slash.handleSelect(command);
        setContent(newValue);
        saveDraft(newValue);
        onSlashCommand?.(command);
      }
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [slash.handleSelect, saveDraft, onClearConversation, onExportConversation, onSlashCommand],
  );

  const handleMentionSelect = useCallback(
    (candidate: MentionCandidate) => {
      const newValue = mention.handleSelect(candidate);
      setContent(newValue);
      saveDraft(newValue);
      // Re-focus the textarea after inserting the mention
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [mention.handleSelect, saveDraft],
  );

  // Save draft on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        if (content.trim()) localStorage.setItem(draftKey, content);
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [content]);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if ((!trimmed && pendingFiles.length === 0) || disabled) return;
    onSend(trimmed, pendingFiles.length > 0 ? pendingFiles : undefined);
    setContent("");
    setPendingFiles([]);
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    // Re-focus the textarea so the user can immediately type the next message
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [content, disabled, onSend, onFileUpload, pendingFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // When the mention popup is active, let it handle navigation keys.
    // The MentionPopup registers a capture-phase keydown listener for
    // ArrowUp/ArrowDown/Enter/Tab/Escape, so we just need to prevent
    // the textarea from treating Enter as "submit message".
    if (mention.active) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Escape") {
        return;
      }
    }

    // When the slash command popup is active, let it handle navigation keys
    if (slash.active) {
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
      if (isStreaming) return;
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    saveDraft(e.target.value);
    onTyping?.();
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setPendingFiles((prev) => [...prev, ...Array.from(files)]);
    }
    e.target.value = "";
  };

  const addFiles = useCallback((files: File[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <AttachmentBar files={pendingFiles} onRemove={removeFile} />

        {/* Research intent suggestion bar */}
        {showResearchSuggestion && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-sm">
            <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <span className="text-text-secondary flex-1">
              {t("research.suggestion", { defaultValue: "This looks like a research task." })}
            </span>
            <button
              onClick={() => {
                setResearchModalOpen(true);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
            >
              {t("research.deepResearch", { defaultValue: "Deep Research" })}
            </button>
            <button
              onClick={() => setResearchDismissed(true)}
              className="text-text-tertiary hover:text-text-secondary transition-colors p-0.5"
              aria-label={t("common.dismiss", { defaultValue: "Dismiss" })}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div
          className="relative flex items-end gap-2 rounded-2xl border border-border bg-surface-secondary px-3 py-2 input-glow transition-colors"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) addFiles(files);
          }}
        >
          {/* @mention popup - positioned above the input area */}
          <MentionPopup
            {...mention.popupProps}
            onSelect={handleMentionSelect}
            conversationId={conversationId}
          />

          {/* /slash command popup - positioned above the input area */}
          <SlashCommand
            {...slash.popupProps}
            onSelect={handleSlashSelect}
          />

          {onFileUpload && (
            <>
              <button
                onClick={handleFileClick}
                className="text-text-tertiary hover:text-text-secondary p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors shrink-0 mb-0.5"
                aria-label={t("files.upload")}
                title={t("files.upload")}
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </>
          )}

          {/* Knowledge collection quick-attach */}
          {conversationId && (
            <div ref={knowledgeRef} className="relative shrink-0 mb-0.5">
              <button
                onClick={() => setKnowledgeOpen(!knowledgeOpen)}
                className={clsx(
                  "p-1.5 rounded-lg transition-colors relative",
                  knowledgeCount > 0
                    ? "text-primary hover:bg-primary/10"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary",
                )}
                aria-label={t("knowledge.attach", { defaultValue: "Attach knowledge" })}
                title={t("knowledge.attach", { defaultValue: "Attach knowledge collection" })}
              >
                <Database className="h-4 w-4" aria-hidden="true" />
                {knowledgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                    {knowledgeCount}
                  </span>
                )}
              </button>

              {knowledgeOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-border bg-surface shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                      <input
                        type="text"
                        autoFocus
                        value={knowledgeSearch}
                        onChange={(e) => setKnowledgeSearch(e.target.value)}
                        placeholder={t("knowledge.searchCollections", { defaultValue: "Search collections..." })}
                        className="w-full h-8 pl-7 pr-3 text-xs bg-surface-secondary border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-text placeholder:text-text-tertiary"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredKnowledge.length === 0 ? (
                      <p className="text-xs text-text-tertiary p-3 text-center">
                        {allCollections.length === 0
                          ? t("knowledge.noCollections", { defaultValue: "No knowledge collections yet" })
                          : t("knowledge.noMatch", { defaultValue: "No matches" })}
                      </p>
                    ) : (
                      filteredKnowledge.map((c) => {
                        const isAttached = attachedIds.has(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              if (isAttached) detachKnowledge.mutate(c.id);
                              else attachKnowledge.mutate(c.id);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover text-xs transition-colors"
                          >
                            <span className={clsx(
                              "flex-shrink-0 h-4 w-4 rounded border flex items-center justify-center transition-colors",
                              isAttached ? "bg-primary border-primary text-white" : "border-border",
                            )}>
                              {isAttached && <Check className="h-3 w-3" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-text font-medium">{c.name}</div>
                              {c.description && (
                                <div className="truncate text-text-tertiary text-[10px]">{c.description}</div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <VoiceInput
            onTranscript={(text) => {
              setContent((prev) => {
                const separator = prev.trim() ? " " : "";
                return prev + separator + text;
              });
            }}
            onAudioFile={(file) => addFiles([file])}
            disabled={disabled || isStreaming}
          />

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t("messages.placeholder")}
            disabled={disabled}
            rows={1}
            aria-label={t("messages.inputLabel", { defaultValue: "Message input" })}
            className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none py-1.5 max-h-[200px]"
          />

          {(isStreaming || isPaused) ? (
            <div className="flex items-center gap-1 shrink-0 mb-0.5">
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
                  aria-label={t("messages.resume", { defaultValue: "Resume streaming" })}
                  title="Resume"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="p-2 rounded-xl bg-surface-tertiary text-text-secondary hover:bg-surface-tertiary/80 transition-colors"
                  aria-label={t("messages.pause", { defaultValue: "Pause streaming" })}
                  title="Pause"
                >
                  <Pause className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                onClick={onStop}
                className="p-2 rounded-xl bg-danger text-primary-foreground hover:bg-danger/90 transition-colors"
                aria-label={t("messages.stop", { defaultValue: "Stop streaming" })}
                title="Stop"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0 mb-0.5">
              <button
                onClick={() => setResearchModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-text-secondary hover:text-primary hover:bg-primary/10 border border-border hover:border-primary/30 transition-colors"
                aria-label={t("research.deepResearch", { defaultValue: "Deep Research" })}
              >
                <Microscope className="h-3.5 w-3.5" aria-hidden="true" />
                {t("research.research", { defaultValue: "Research" })}
              </button>
              <button
                onClick={handleSubmit}
                disabled={(!content.trim() && pendingFiles.length === 0) || disabled}
                aria-label={t("messages.send")}
                className={clsx(
                  "p-2 rounded-xl transition-colors",
                  (content.trim() || pendingFiles.length > 0) && !disabled
                    ? "bg-primary text-primary-foreground hover:bg-primary-dark"
                    : "bg-surface-tertiary text-text-tertiary",
                )}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-text-tertiary">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono">Enter</kbd> {t("messages.toSend", { defaultValue: "to send" })}
            </span>
            <span className="text-border-strong">|</span>
            <span>
              <kbd className="font-mono">Shift+Enter</kbd> {t("messages.forNewLine", { defaultValue: "for new line" })}
            </span>
          </div>
          <span>{t("messages.disclaimer")}</span>
        </div>
      </div>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Prompt template picker */}
      <PromptPickerDialog
        open={promptPickerOpen}
        onClose={() => setPromptPickerOpen(false)}
        onSelect={(templateContent) => {
          setContent(templateContent);
          saveDraft(templateContent);
          setPromptPickerOpen(false);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
      />

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
          defaultValues={content.trim() ? { query: content.trim() } : undefined}
          onSubmit={(data) => startResearch.mutate(data)}
        />
      </Dialog>
    </div>
  );
}
