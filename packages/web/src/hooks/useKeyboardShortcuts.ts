import { useEffect, useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShortcutHandler = (e: KeyboardEvent) => void;

export interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
}

export interface ShortcutDescriptor {
  id: string;
  /** Human-readable label shown in the help overlay */
  label: string;
  /** The keyboard combo, e.g. "Cmd+K" */
  display: string;
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Category for grouping in help overlay */
  category: "general" | "navigation" | "editor" | "chat";
}

// ---------------------------------------------------------------------------
// Default shortcut registry
// ---------------------------------------------------------------------------

const STORAGE_KEY = "nova-keyboard-shortcuts";

/**
 * Canonical list of all shortcuts the app supports.
 * Users can override bindings via localStorage.
 */
const DEFAULT_SHORTCUTS: ShortcutDescriptor[] = [
  { id: "command-palette",  label: "Open command palette",  display: "Cmd+K",     key: "k",     meta: true,  category: "general" },
  { id: "new-chat",         label: "New conversation",      display: "Cmd+N",     key: "n",     meta: true,  category: "general" },
  { id: "shortcuts-help",   label: "Show keyboard shortcuts",display: "Cmd+/",    key: "/",     meta: true,  category: "general" },
  { id: "settings",         label: "Open settings",         display: "Cmd+,",     key: ",",     meta: true,  category: "general" },
  { id: "search",           label: "Focus search",          display: "Cmd+Shift+F", key: "f",   meta: true,  shift: true, category: "general" },
  { id: "toggle-sidebar",   label: "Toggle sidebar",        display: "Cmd+B",     key: "b",     meta: true,  category: "navigation" },
  { id: "go-home",          label: "Go to home",            display: "Cmd+Shift+H", key: "h",   meta: true, shift: true, category: "navigation" },
  { id: "send-message",     label: "Send message",          display: "Enter",     key: "Enter",              category: "chat" },
  { id: "new-line",         label: "New line in message",   display: "Shift+Enter",key: "Enter", shift: true, category: "chat" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}

/**
 * Load user-customised shortcut overrides from localStorage.
 * Returns a map of shortcutId -> partial override.
 */
function loadCustomShortcuts(): Record<string, Partial<ShortcutDescriptor>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Persist a single shortcut override. Merges with existing overrides.
 */
export function saveCustomShortcut(id: string, override: Partial<Pick<ShortcutDescriptor, "key" | "meta" | "ctrl" | "shift" | "alt">>) {
  const existing = loadCustomShortcuts();
  existing[id] = { ...existing[id], ...override };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

/**
 * Reset all custom shortcuts back to defaults.
 */
export function resetCustomShortcuts() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Build the resolved list of shortcut descriptors, merging defaults with
 * any user customisations stored in localStorage.
 */
export function getResolvedShortcuts(): ShortcutDescriptor[] {
  const overrides = loadCustomShortcuts();
  return DEFAULT_SHORTCUTS.map((s) => {
    const o = overrides[s.id];
    if (!o) return s;
    return { ...s, ...o };
  });
}

/**
 * Get human-readable key display for a shortcut descriptor, respecting OS.
 */
export function formatShortcut(desc: ShortcutDescriptor): string {
  const mac = isMac();
  const parts: string[] = [];
  if (desc.meta) parts.push(mac ? "\u2318" : "Ctrl");
  if (desc.ctrl) parts.push("Ctrl");
  if (desc.shift) parts.push(mac ? "\u21E7" : "Shift");
  if (desc.alt) parts.push(mac ? "\u2325" : "Alt");

  let keyLabel = desc.key;
  if (keyLabel === " ") keyLabel = "Space";
  else if (keyLabel === "/") keyLabel = "/";
  else if (keyLabel === ",") keyLabel = ",";
  else if (keyLabel === "Enter") keyLabel = "\u21B5";
  else if (keyLabel === "Escape") keyLabel = "Esc";
  else keyLabel = keyLabel.toUpperCase();

  parts.push(keyLabel);
  return parts.join(mac ? "" : "+");
}

// ---------------------------------------------------------------------------
// Core hook — low-level, used internally and can be used directly
// ---------------------------------------------------------------------------

/**
 * Register an array of keyboard shortcuts. Each shortcut's handler is called
 * when the matching key combination is pressed. Prevents default browser
 * behaviour for matched combos.
 *
 * On non-Mac platforms, `meta: true` also matches `Ctrl` so that Cmd+K / Ctrl+K
 * both work cross-platform.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when an input/textarea/contenteditable is focused,
      // unless the shortcut explicitly uses meta/ctrl (i.e. it's a global shortcut).
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      for (const shortcut of shortcuts) {
        const isGlobal = shortcut.meta || shortcut.ctrl;

        // If inside an input field and not a global shortcut, skip
        if (isInput && !isGlobal) continue;

        const mac = isMac();

        // On Mac: meta means metaKey. On other platforms: meta means ctrlKey.
        const metaMatch = shortcut.meta
          ? mac
            ? e.metaKey
            : e.metaKey || e.ctrlKey
          : !(mac ? e.metaKey : false);

        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !shortcut.meta ? !e.ctrlKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          metaMatch &&
          ctrlMatch &&
          shiftMatch &&
          altMatch
        ) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.handler(e);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [shortcuts]);
}

// ---------------------------------------------------------------------------
// High-level hook — provides global app shortcuts with handler map
// ---------------------------------------------------------------------------

export interface GlobalShortcutHandlers {
  onCommandPalette?: () => void;
  onNewChat?: () => void;
  onShortcutsHelp?: () => void;
  onSettings?: () => void;
  onSearch?: () => void;
  onToggleSidebar?: () => void;
  onGoHome?: () => void;
}

/**
 * Registers all global keyboard shortcuts for the application.
 * Handlers are mapped by shortcut id; any unset handler is a no-op.
 *
 * Reads user-customised key bindings from localStorage and merges
 * with defaults so that users can rebind keys.
 */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  const resolved = useMemo(() => getResolvedShortcuts(), []);

  const handlerMap: Record<string, (() => void) | undefined> = useMemo(
    () => ({
      "command-palette": handlers.onCommandPalette,
      "new-chat": handlers.onNewChat,
      "shortcuts-help": handlers.onShortcutsHelp,
      "settings": handlers.onSettings,
      "search": handlers.onSearch,
      "toggle-sidebar": handlers.onToggleSidebar,
      "go-home": handlers.onGoHome,
    }),
    [handlers],
  );

  const shortcuts: Shortcut[] = useMemo(
    () =>
      resolved
        .filter((desc) => handlerMap[desc.id])
        .map((desc) => ({
          key: desc.key,
          meta: desc.meta,
          ctrl: desc.ctrl,
          shift: desc.shift,
          alt: desc.alt,
          handler: () => handlerMap[desc.id]?.(),
        })),
    [resolved, handlerMap],
  );

  useKeyboardShortcuts(shortcuts);
}

// ---------------------------------------------------------------------------
// Shortcut help data (for the help overlay)
// ---------------------------------------------------------------------------

export interface ShortcutGroup {
  category: string;
  shortcuts: Array<{ label: string; display: string }>;
}

/**
 * Returns shortcut descriptors grouped by category for rendering the help
 * overlay. Respects user overrides.
 */
export function useShortcutGroups(): ShortcutGroup[] {
  return useMemo(() => {
    const resolved = getResolvedShortcuts();
    const map = new Map<string, ShortcutGroup>();

    for (const desc of resolved) {
      const cat = desc.category;
      if (!map.has(cat)) {
        map.set(cat, { category: cat, shortcuts: [] });
      }
      map.get(cat)!.shortcuts.push({
        label: desc.label,
        display: formatShortcut(desc),
      });
    }

    // Order categories consistently
    const order = ["general", "navigation", "editor", "chat"];
    return order.filter((c) => map.has(c)).map((c) => map.get(c)!);
  }, []);
}
