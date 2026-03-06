import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Keyboard, RotateCcw, Save } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/settings/shortcuts")({
  component: ShortcutsSettingsPage,
});

const DEFAULT_SHORTCUTS = [
  { action: "new-conversation", label: "New Conversation", default: "Ctrl+N" },
  { action: "search", label: "Search", default: "Ctrl+K" },
  { action: "toggle-sidebar", label: "Toggle Sidebar", default: "Ctrl+B" },
  { action: "settings", label: "Open Settings", default: "Ctrl+," },
  { action: "send-message", label: "Send Message", default: "Enter" },
  { action: "new-line", label: "New Line in Input", default: "Shift+Enter" },
  { action: "stop-generation", label: "Stop Generation", default: "Escape" },
  { action: "focus-input", label: "Focus Input", default: "Ctrl+L" },
  { action: "copy-last", label: "Copy Last Response", default: "Ctrl+Shift+C" },
  { action: "clear-input", label: "Clear Input", default: "Ctrl+Shift+Backspace" },
  { action: "navigate-up", label: "Previous Conversation", default: "Alt+ArrowUp" },
  { action: "navigate-down", label: "Next Conversation", default: "Alt+ArrowDown" },
  { action: "toggle-theme", label: "Toggle Theme", default: "Ctrl+Shift+T" },
  { action: "help", label: "Show Help", default: "Ctrl+?" },
];

function ShortcutsSettingsPage() {
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
      toast("Shortcuts saved", "success");
    },
  });

  const getBinding = (action: string, defaultKey: string) => {
    return bindings[action] ?? defaultKey;
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: string) => {
    if (!recording || recording !== action) return;
    e.preventDefault();

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
    toast("Reset to defaults (save to apply)", "info");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Keyboard className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-text">Keyboard Shortcuts</h2>
            <p className="text-xs text-text-tertiary">Customize keyboard shortcuts to match your workflow</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saveBulk.isPending}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        {DEFAULT_SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.action}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-secondary transition-colors"
          >
            <span className="text-sm text-text">{shortcut.label}</span>
            <button
              onClick={() => setRecording(recording === shortcut.action ? null : shortcut.action)}
              onKeyDown={(e) => handleKeyDown(e, shortcut.action)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors min-w-[120px] text-center ${
                recording === shortcut.action
                  ? "border-primary bg-primary/10 text-primary animate-pulse"
                  : "border-border bg-surface-secondary text-text-secondary hover:border-border-strong"
              }`}
            >
              {recording === shortcut.action
                ? "Press keys..."
                : getBinding(shortcut.action, shortcut.default)}
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-surface-secondary border border-border">
        <p className="text-xs text-text-tertiary">
          Click on a shortcut to start recording. Press any key combination to set it.
          Press Escape to cancel recording. Changes take effect after saving.
        </p>
      </div>
    </div>
  );
}
