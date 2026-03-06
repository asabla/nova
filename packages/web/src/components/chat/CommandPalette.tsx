import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, MessageSquare, Bot, BookOpen, Settings, FolderKanban, Sun, Moon, Monitor } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  section: string;
}

export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useUIStore((s) => s.commandPaletteOpen);
  const toggle = useUIStore((s) => s.toggleCommandPalette);
  const setTheme = useUIStore((s) => s.setTheme);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts([
    { key: "k", meta: true, handler: () => toggle() },
  ]);

  const commands: Command[] = useMemo(() => [
    { id: "new-conv", label: t("conversations.new"), icon: <MessageSquare className="h-4 w-4" />, action: () => navigate({ to: "/conversations/new" }), section: "Navigation" },
    { id: "agents", label: "Agents", icon: <Bot className="h-4 w-4" />, action: () => navigate({ to: "/agents" }), section: "Navigation" },
    { id: "knowledge", label: "Knowledge", icon: <BookOpen className="h-4 w-4" />, action: () => navigate({ to: "/knowledge" }), section: "Navigation" },
    { id: "workspaces", label: "Workspaces", icon: <FolderKanban className="h-4 w-4" />, action: () => navigate({ to: "/workspaces" }), section: "Navigation" },
    { id: "settings", label: t("app.settings"), icon: <Settings className="h-4 w-4" />, action: () => navigate({ to: "/settings/profile" }), section: "Navigation" },
    { id: "theme-light", label: "Light Mode", icon: <Sun className="h-4 w-4" />, action: () => setTheme("light"), section: "Theme" },
    { id: "theme-dark", label: "Dark Mode", icon: <Moon className="h-4 w-4" />, action: () => setTheme("dark"), section: "Theme" },
    { id: "theme-system", label: "System Theme", icon: <Monitor className="h-4 w-4" />, action: () => setTheme("system"), section: "Theme" },
  ], [t, navigate, setTheme]);

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      toggle();
    } else if (e.key === "Escape") {
      toggle();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={toggle} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none"
          />
          <kbd className="text-[10px] text-text-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-tertiary">
              No matching commands
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); toggle(); }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                  idx === selectedIndex ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-secondary"
                }`}
              >
                {cmd.icon}
                <span>{cmd.label}</span>
                <span className="ml-auto text-[10px] text-text-tertiary">{cmd.section}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
