import { useState, useRef, useCallback, useEffect } from "react";
import { Bot, ArrowLeft, Save, Copy, Trash2, MessageSquare, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Skeleton } from "../ui/Skeleton";
import { getAgentBgStyle, getAgentIconStyle } from "../../lib/agent-appearance";
import { useAgentForm } from "./useAgentForm";
import { ConfigPanel } from "./ConfigPanel";
import { PreviewPanel } from "./PreviewPanel";
import { RefreshCw } from "lucide-react";

const STORAGE_KEY = "nova:agent-builder-split";
const MIN_LEFT = 360;
const MIN_RIGHT = 320;
const DEFAULT_RATIO = 0.42;

function getStoredRatio(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const n = parseFloat(v);
      if (n > 0.2 && n < 0.8) return n;
    }
  } catch {}
  return DEFAULT_RATIO;
}

export function AgentBuilderLayout({
  mode,
  agentId,
}: {
  mode: "create" | "edit";
  agentId?: string;
}) {
  const { t } = useTranslation();
  const ctx = useAgentForm({ mode, agentId });
  const {
    form,
    setField,
    agentColor,
    agent,
    agentLoading,
    agentError,
    refetchAgent,
    save,
    isSaving,
    isDirty,
    deleteMutation,
    cloneMutation,
    navigate,
  } = ctx;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // --- Resize ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(getStoredRatio);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const newLeft = ev.clientX - rect.left;
      const clampedLeft = Math.max(MIN_LEFT, Math.min(newLeft, totalWidth - MIN_RIGHT));
      const newRatio = clampedLeft / totalWidth;
      setRatio(newRatio);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Persist
      setRatio((r) => {
        try {
          localStorage.setItem(STORAGE_KEY, String(r));
        } catch {}
        return r;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // --- Mobile ---
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"config" | "preview">("config");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // --- Loading / Error ---
  if (mode === "edit" && agentLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div>
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex">
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          </div>
          <div className="flex-1 border-l border-border p-6">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "edit" && agentError) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-sm text-danger mb-4">
          {t("agents.loadError", { defaultValue: "Failed to load agent." })}
        </p>
        <Button variant="secondary" onClick={() => refetchAgent()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("common.retry", { defaultValue: "Retry" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border gap-3 bg-surface">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => navigate({ to: "/agents" })}
            className="p-1.5 hover:bg-surface-secondary rounded-lg shrink-0 transition-colors"
            aria-label={t("common.goBack", { defaultValue: "Go back" })}
          >
            <ArrowLeft className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          </button>
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            style={getAgentBgStyle(agentColor)}
          >
            <Bot
              className="h-4.5 w-4.5"
              style={getAgentIconStyle(agentColor)}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder={t("agents.namePlaceholder", { defaultValue: "Agent name..." })}
              className="text-sm font-semibold text-text bg-transparent border-none outline-none w-full placeholder:text-text-tertiary"
              aria-label={t("agents.nameLabel", { defaultValue: "Agent name" })}
            />
            <input
              type="text"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder={t("agents.descriptionPlaceholder", { defaultValue: "Description..." })}
              className="text-[11px] text-text-secondary bg-transparent border-none outline-none w-full placeholder:text-text-tertiary"
              aria-label={t("agents.descriptionLabel", { defaultValue: "Agent description" })}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigate({ to: "/conversations/new", search: { agentId: agentId! } })
                }
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {t("agents.chat", { defaultValue: "Chat" })}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cloneMutation.mutate()}
                className="hidden sm:flex"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {t("agents.clone", { defaultValue: "Clone" })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger hidden sm:flex"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("common.delete", { defaultValue: "Delete" })}
              </Button>
            </>
          )}
          {mode === "create" && (
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/agents" })}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={save} disabled={isSaving}>
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {isSaving
              ? t("common.saving", { defaultValue: "Saving..." })
              : mode === "create"
                ? t("agents.createAgent", { defaultValue: "Create" })
                : t("common.save", { defaultValue: "Save" })}
          </Button>
        </div>
      </div>

      {/* Split view */}
      {isMobile ? (
        <>
          <div className="flex-1 overflow-hidden">
            {mobilePanel === "config" ? (
              <ConfigPanel ctx={ctx} />
            ) : (
              <PreviewPanel ctx={ctx} />
            )}
          </div>
          {/* Mobile toggle FAB */}
          <button
            onClick={() =>
              setMobilePanel((p) => (p === "config" ? "preview" : "config"))
            }
            className="fixed bottom-6 right-6 h-13 w-13 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center z-50 hover:bg-primary/90 active:scale-95 transition-all"
            style={{
              boxShadow: `0 4px 24px -4px color-mix(in oklch, ${agentColor} 35%, transparent), 0 2px 8px -2px rgba(0,0,0,0.1)`,
            }}
            aria-label={
              mobilePanel === "config"
                ? t("agents.showPreview", { defaultValue: "Show preview" })
                : t("agents.showConfig", { defaultValue: "Show configuration" })
            }
          >
            {mobilePanel === "config" ? (
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </>
      ) : (
        <div ref={containerRef} className="flex-1 flex overflow-hidden">
          {/* Left: Config */}
          <div
            className="overflow-hidden"
            style={{ flex: `0 0 ${ratio * 100}%`, minWidth: MIN_LEFT }}
          >
            <ConfigPanel ctx={ctx} />
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className="w-[3px] shrink-0 cursor-col-resize relative group"
          >
            {/* Wider invisible hit area */}
            <div className="absolute inset-y-0 -left-1.5 -right-1.5 z-10" />
            {/* Visible line */}
            <div className="absolute inset-y-0 inset-x-0 bg-border transition-colors group-hover:bg-primary/40 group-active:bg-primary/60" />
            {/* Grip dots */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="h-1 w-1 rounded-full bg-text-tertiary" />
              <div className="h-1 w-1 rounded-full bg-text-tertiary" />
              <div className="h-1 w-1 rounded-full bg-text-tertiary" />
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 overflow-hidden bg-surface-secondary/30" style={{ minWidth: MIN_RIGHT }}>
            <PreviewPanel ctx={ctx} />
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {mode === "edit" && (
        <Dialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          title={t("agents.deleteTitle", { defaultValue: "Delete Agent" })}
        >
          <p className="text-sm text-text-secondary mb-4">
            {t("agents.deleteConfirm", {
              defaultValue:
                "Are you sure you want to delete this agent? This action cannot be undone.",
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteMutation.mutate();
                setShowDeleteDialog(false);
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {deleteMutation.isPending
                ? t("common.deleting", { defaultValue: "Deleting..." })
                : t("common.delete", { defaultValue: "Delete" })}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
