import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send, Square, Paperclip, Pause, Play } from "lucide-react";
import { clsx } from "clsx";
import { VoiceInput } from "./VoiceInput";

interface MessageInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isStreaming?: boolean;
  isPaused?: boolean;
  disabled?: boolean;
  onFileUpload?: (file: File) => void;
}

export function MessageInput({ onSend, onStop, onPause, onResume, isStreaming, isPaused, disabled, onFileUpload }: MessageInputProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) return;
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    e.target.value = "";
  };

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-secondary px-3 py-2 focus-within:border-primary/50 transition-colors">
          {onFileUpload && (
            <>
              <button
                onClick={handleFileClick}
                className="text-text-tertiary hover:text-text-secondary p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors shrink-0 mb-0.5"
                title={t("files.upload")}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
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
            onAudioFile={onFileUpload}
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
            className="flex-1 resize-none bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none py-1.5 max-h-[200px]"
          />

          {(isStreaming || isPaused) ? (
            <div className="flex items-center gap-1 shrink-0 mb-0.5">
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
                  title="Resume"
                >
                  <Play className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="p-2 rounded-xl bg-surface-tertiary text-text-secondary hover:bg-surface-tertiary/80 transition-colors"
                  title="Pause"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={onStop}
                className="p-2 rounded-xl bg-danger text-primary-foreground hover:bg-danger/90 transition-colors"
                title="Stop"
              >
                <Square className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || disabled}
              className={clsx(
                "p-2 rounded-xl transition-colors shrink-0 mb-0.5",
                content.trim() && !disabled
                  ? "bg-primary text-primary-foreground hover:bg-primary-dark"
                  : "bg-surface-tertiary text-text-tertiary",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-text-tertiary text-center mt-2">
          {t("messages.disclaimer")}
        </p>
      </div>
    </div>
  );
}
