import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, FileText, ArrowRight } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import type { SampleConversation, TemplateInput } from "../../routes/_auth/explore";

interface TemplateInputDialogProps {
  open: boolean;
  onClose: () => void;
  conversation: SampleConversation | null;
  onSubmit: (resolvedMessage: string, files?: File[]) => void;
}

/**
 * Groups inputs by shared prefix (e.g. "code" and "code_file" form a group).
 * Returns pairs of [textInput, fileInput?].
 */
function groupInputs(inputs: TemplateInput[]): [TemplateInput, TemplateInput | undefined][] {
  const textInputs = inputs.filter((i) => i.type !== "file");
  const fileInputs = inputs.filter((i) => i.type === "file");

  return textInputs.map((text) => {
    const companion = fileInputs.find((f) => f.id.startsWith(text.id + "_"));
    return [text, companion];
  });
}

/** Replace all {{id}} tokens in the template with provided values. */
function resolveTemplate(
  template: string,
  values: Record<string, string>,
  files: Record<string, File | null>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, id: string) => {
    if (values[id]) return values[id];
    // Check if a companion file was uploaded
    const fileKey = `${id}_file`;
    if (files[fileKey]) return `(see attached file: ${files[fileKey]!.name})`;
    return "";
  });
}

export function TemplateInputDialog({ open, onClose, conversation, onSubmit }: TemplateInputDialogProps) {
  const { t } = useTranslation();
  const [textValues, setTextValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Reset state when conversation changes
  useEffect(() => {
    if (open) {
      setTextValues({});
      setFileValues({});
      setErrors({});
    }
  }, [open, conversation?.id]);

  const handleTextChange = useCallback((id: string, value: string) => {
    setTextValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: false }));
  }, []);

  const handleFileSelect = useCallback((id: string, file: File | null) => {
    setFileValues((prev) => ({ ...prev, [id]: file }));
    // Clear error on the text companion
    const textId = id.replace(/_file$/, "");
    setErrors((prev) => ({ ...prev, [textId]: false }));
  }, []);

  const handleDrop = useCallback((id: string, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(id, file);
  }, [handleFileSelect]);

  const handleSubmit = useCallback(() => {
    if (!conversation?.inputs) return;

    const groups = groupInputs(conversation.inputs);
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    for (const [textInput, fileInput] of groups) {
      const hasText = !!textValues[textInput.id]?.trim();
      const hasFile = fileInput ? !!fileValues[fileInput.id] : false;

      if (textInput.required && !hasText && !hasFile) {
        newErrors[textInput.id] = true;
        hasError = true;
      }
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    const resolved = resolveTemplate(conversation.starterMessage, textValues, fileValues);
    const files = Object.values(fileValues).filter((f): f is File => f !== null);

    onSubmit(resolved, files.length > 0 ? files : undefined);
  }, [conversation, textValues, fileValues, onSubmit]);

  if (!conversation?.inputs) return null;

  const groups = groupInputs(conversation.inputs);
  const Icon = conversation.icon;

  return (
    <Dialog open={open} onClose={onClose} title={conversation.title} size="lg">
      {/* Context header */}
      <div className="flex items-start gap-3 mb-6 p-3 rounded-lg bg-surface-secondary">
        <div className={`h-8 w-8 rounded-lg ${conversation.bgColor} flex items-center justify-center shrink-0`}>
          <Icon className={`h-4 w-4 ${conversation.color}`} aria-hidden="true" />
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">
          {conversation.description}
        </p>
      </div>

      {/* Input groups */}
      <div className="space-y-5">
        {groups.map(([textInput, fileInput]) => (
          <div key={textInput.id}>
            {/* Text/textarea input */}
            <label htmlFor={textInput.id} className="block text-sm font-medium text-text mb-1.5">
              {textInput.label}
            </label>
            {textInput.type === "text" ? (
              <input
                type="text"
                id={textInput.id}
                value={textValues[textInput.id] ?? ""}
                onChange={(e) => handleTextChange(textInput.id, e.target.value)}
                placeholder={textInput.placeholder}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm text-text bg-surface placeholder:text-text-tertiary transition-colors ${
                  errors[textInput.id]
                    ? "border-danger focus:ring-danger/30"
                    : "border-border focus:border-primary focus:ring-primary/20"
                } focus:outline-none focus:ring-2`}
              />
            ) : (
              <textarea
                id={textInput.id}
                value={textValues[textInput.id] ?? ""}
                onChange={(e) => handleTextChange(textInput.id, e.target.value)}
                placeholder={textInput.placeholder}
                rows={6}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm text-text bg-surface placeholder:text-text-tertiary resize-y min-h-[120px] max-h-[320px] font-mono transition-colors ${
                  errors[textInput.id]
                    ? "border-danger focus:ring-danger/30"
                    : "border-border focus:border-primary focus:ring-primary/20"
                } focus:outline-none focus:ring-2`}
              />
            )}
            {errors[textInput.id] && (
              <p className="mt-1 text-xs text-danger">
                {t("explore.inputRequired", "Please provide content or upload a file")}
              </p>
            )}

            {/* File input companion */}
            {fileInput && (
              <>
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-text-tertiary">{t("common.or", "or")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {fileValues[fileInput.id] ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface-secondary">
                    <FileText className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                    <span className="text-sm text-text truncate flex-1">
                      {fileValues[fileInput.id]!.name}
                    </span>
                    <button
                      onClick={() => handleFileSelect(fileInput.id, null)}
                      className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-danger transition-colors"
                      aria-label={t("common.remove", "Remove")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[fileInput.id]?.click()}
                    onDrop={(e) => handleDrop(fileInput.id, e)}
                    onDragOver={(e) => e.preventDefault()}
                    className="w-full p-4 rounded-lg border border-dashed border-border hover:border-primary/50 bg-surface-secondary hover:bg-primary/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <Upload className="h-5 w-5 text-text-tertiary group-hover:text-primary transition-colors" aria-hidden="true" />
                      <span className="text-xs font-medium text-text-secondary group-hover:text-primary transition-colors">
                        {fileInput.label}
                      </span>
                      <span className="text-[11px] text-text-tertiary">
                        {fileInput.placeholder}
                      </span>
                    </div>
                    <input
                      ref={(el) => { fileInputRefs.current[fileInput.id] = el; }}
                      type="file"
                      accept={fileInput.accept}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        handleFileSelect(fileInput.id, file);
                        e.target.value = "";
                      }}
                    />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
        <Button variant="ghost" onClick={onClose}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          {t("explore.startConversation", "Start Conversation")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </Dialog>
  );
}
