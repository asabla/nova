import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Square, Paperclip, Pause, Play } from "lucide-react";
import { clsx } from "clsx";
import { VoiceInput } from "./VoiceInput";
import { AttachmentBar } from "./AttachmentBar";
import { MentionPopup, useMentionTrigger, type MentionCandidate } from "./MentionPopup";

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
}

export function MessageInput({ onSend, onStop, onPause, onResume, isStreaming, isPaused, disabled, onFileUpload, onTyping }: MessageInputProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Auto-save draft on disconnect / page unload (story #202)
  const draftKey = "nova:message-draft";
  const [content, setContent] = useState(() => {
    try { return localStorage.getItem(draftKey) ?? ""; } catch { return ""; }
  });

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
            <button
              onClick={handleSubmit}
              disabled={(!content.trim() && pendingFiles.length === 0) || disabled}
              aria-label={t("messages.send")}
              className={clsx(
                "p-2 rounded-xl transition-colors shrink-0 mb-0.5",
                (content.trim() || pendingFiles.length > 0) && !disabled
                  ? "bg-primary text-primary-foreground hover:bg-primary-dark"
                  : "bg-surface-tertiary text-text-tertiary",
              )}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-text-tertiary text-center mt-1">
          {t("messages.shiftEnterHint", { defaultValue: "Shift+Enter for new line" })}
        </p>
        <p className="text-[10px] text-text-tertiary text-center mt-0.5">
          {t("messages.disclaimer")}
        </p>
      </div>
    </div>
  );
}
