import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useShortcutGroups } from "../../hooks/useKeyboardShortcuts";

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  navigation: "Navigation",
  editor: "Editor",
  chat: "Chat",
};

export function ShortcutsHelpOverlay() {
  const isOpen = useUIStore((s) => s.shortcutsHelpOpen);
  const toggle = useUIStore((s) => s.toggleShortcutsHelp);
  const groups = useShortcutGroups();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, toggle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-overlay backdrop-blur-sm" onClick={toggle} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">Keyboard Shortcuts</h2>
          <button
            onClick={toggle}
            className="p-1 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {groups.map((group) => (
            <div key={group.category}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                {CATEGORY_LABELS[group.category] ?? group.category}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-text-secondary">
                      {shortcut.label}
                    </span>
                    <kbd className="text-xs text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded border border-border font-mono">
                      {shortcut.display}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border">
          <p className="text-[10px] text-text-tertiary text-center">
            Shortcuts can be customised in Settings &gt; Keyboard
          </p>
        </div>
      </div>
    </div>
  );
}
