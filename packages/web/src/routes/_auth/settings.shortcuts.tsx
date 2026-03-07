import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Keyboard, RotateCcw, Save, AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/settings/shortcuts")({
  component: ShortcutsSettingsPage,
});

const DEFAULT_SHORTCUTS = [
  { action: "new-conversation", labelKey: "settings.shortcutNewConversation", label: "New Conversation", default: "Ctrl+N" },
  { action: "search", labelKey: "settings.shortcutSearch", label: "Search", default: "Ctrl+K" },
  { action: "toggle-sidebar", labelKey: "settings.shortcutToggleSidebar", label: "Toggle Sidebar", default: "Ctrl+B" },
  { action: "settings", labelKey: "settings.shortcutOpenSettings", label: "Open Settings", default: "Ctrl+," },
  { action: "send-message", labelKey: "settings.shortcutSendMessage", label: "Send Message", default: "Enter" },
  { action: "new-line", labelKey: "settings.shortcutNewLine", label: "New Line in Input", default: "Shift+Enter" },
  { action: "stop-generation", labelKey: "settings.shortcutStopGeneration", label: "Stop Generation", default: "Escape" },
  { action: "focus-input", labelKey: "settings.shortcutFocusInput", label: "Focus Input", default: "Ctrl+L" },
  { action: "copy-last", labelKey: "settings.shortcutCopyLast", label: "Copy Last Response", default: "Ctrl+Shift+C" },
  { action: "clear-input", labelKey: "settings.shortcutClearInput", label: "Clear Input", default: "Ctrl+Shift+Backspace" },
  { action: "navigate-up", labelKey: "settings.shortcutNavigateUp", label: "Previous Conversation", default: "Alt+ArrowUp" },
  { action: "navigate-down", labelKey: "settings.shortcutNavigateDown", label: "Next Conversation", default: "Alt+ArrowDown" },
  { action: "toggle-theme", labelKey: "settings.shortcutToggleTheme", label: "Toggle Theme", default: "Ctrl+Shift+T" },
  { action: "help", labelKey: "settings.shortcutHelp", label: "Show Help", default: "Ctrl+?" },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** Convert internal key string (Ctrl+N) to platform-appropriate display */
function displayKey(key: string): string {
  if (isMac) {
    return key
      .replace(/Ctrl\+/g, "\u2318")
      .replace(/Alt\+/g, "\u2325")
      .replace(/Shift\+/g, "\u21E7")
      .replace(/Meta\+/g, "\u2318");
  }
  return key;
}

function ShortcutsSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState<string | null>(null);

  const { data: customShortcuts } = useQuery({
    queryKey: ["shortcuts"],
    queryFn: () => api.get<any[]>("/api/shortcuts"),
  });

  useEffect(() => {
    const custom: Record<string, string> = {};
    for (const s of (customShortcuts as any[]) ?? []) {
      custom[s.action] = s.keybinding;
    }
    setBindings(custom);
  }, [customShortcuts]);

  const saveBulk = useMutation({
    mutationFn: (shortcuts: { action: string; keybinding: string }[]) =>
      api.put("/api/shortcuts/bulk", { shortcuts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortcuts"] });
      toast(t("settings.shortcutsSaved", "Shortcuts saved"), "success");
    },
    onError: () => {
      toast(t("settings.shortcutsSaveFailed", "Failed to save shortcuts"), "error");
    },
  });

  const getBinding = (action: string, defaultKey: string) => {
    return bindings[action] ?? defaultKey;
  };

  /** Detect if a key combo is already assigned to another action */
  const conflicts = useMemo(() => {
    const result: Record<string, string> = {};
    for (const shortcut of DEFAULT_SHORTCUTS) {
      const currentBinding = getBinding(shortcut.action, shortcut.default);
      // Check if this binding conflicts with any other action
      for (const other of DEFAULT_SHORTCUTS) {
        if (other.action === shortcut.action) continue;
        const otherBinding = getBinding(other.action, other.default);
        if (currentBinding === otherBinding) {
          result[shortcut.action] = other.action;
          break;
        }
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindings]);

  const handleKeyDown = (e: React.KeyboardEvent, action: string) => {
    if (!recording || recording !== action) return;
    e.preventDefault();

    // Escape cancels recording instead of saving it as a binding
    if (e.key === "Escape") {
      setRecording(null);
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    const key = e.key;
    if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      setBindings((prev) => ({ ...prev, [action]: parts.join("+") }));
      setRecording(null);
    }
  };

  const handleSave = () => {
    const shortcuts = Object.entries(bindings).map(([action, keybinding]) => ({
      action,
      keybinding,
    }));
    saveBulk.mutate(shortcuts);
  };

  const handleReset = () => {
    setBindings({});
    toast(t("settings.shortcutsResetNotice", "Reset to defaults (save to apply)"), "info");
  };

  /** Find the label for a conflicting action */
  const getConflictLabel = (action: string): string => {
    const shortcut = DEFAULT_SHORTCUTS.find((s) => s.action === action);
    return shortcut ? t(shortcut.labelKey, shortcut.label) : action;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Keyboard className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-text">
              {t("settings.keyboardShortcuts", "Keyboard Shortcuts")}
            </h2>
            <p className="text-xs text-text-tertiary">
              {t("settings.keyboardShortcutsDescription", "Customize keyboard shortcuts to match your workflow")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" /> {t("settings.reset", "Reset")}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saveBulk.isPending}>
            <Save className="h-3.5 w-3.5" /> {t("settings.save")}
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {DEFAULT_SHORTCUTS.map((shortcut) => {
          const conflictAction = conflicts[shortcut.action];
          return (
            <div key={shortcut.action}>
              <div
                className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-secondary transition-colors"
              >
                <span className="text-sm text-text">
                  {t(shortcut.labelKey, shortcut.label)}
                </span>
                <button
                  onClick={() => setRecording(recording === shortcut.action ? null : shortcut.action)}
                  onKeyDown={(e) => handleKeyDown(e, shortcut.action)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors min-w-[120px] text-center ${
                    recording === shortcut.action
                      ? "border-primary bg-primary/10 text-primary animate-pulse"
                      : conflictAction
                        ? "border-warning bg-warning/10 text-warning"
                        : "border-border bg-surface-secondary text-text-secondary hover:border-border-strong"
                  }`}
                >
                  {recording === shortcut.action
                    ? t("settings.pressKeys", "Press keys...")
                    : displayKey(getBinding(shortcut.action, shortcut.default))}
                </button>
              </div>
              {conflictAction && (
                <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {t("settings.shortcutConflict", {
                    action: getConflictLabel(conflictAction),
                    defaultValue: `Conflicts with "${getConflictLabel(conflictAction)}"`,
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-surface-secondary border border-border">
        <p className="text-xs text-text-tertiary">
          {t("settings.shortcutsHelpText", "Click on a shortcut to start recording. Press any key combination to set it. Press Escape to cancel recording. Changes take effect after saving.")}
        </p>
      </div>
    </div>
  );
}
