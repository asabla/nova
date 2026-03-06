import { useState, useEffect, useRef, useMemo } from "react";
import {
  Bot,
  FileText,
  Settings,
  Wrench,
  Search,
  Trash2,
  HelpCircle,
  Download,
} from "lucide-react";
import { clsx } from "clsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlashCommandDef {
  command: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If true the command is handled entirely on the client side */
  clientOnly?: boolean;
}

export interface SlashCommandProps {
  query: string;
  onSelect: (command: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

// ---------------------------------------------------------------------------
// Command registry
// ---------------------------------------------------------------------------

const commands: SlashCommandDef[] = [
  { command: "/model",   description: "Switch the active model",          icon: Settings },
  { command: "/agent",   description: "Use a specific agent",             icon: Bot },
  { command: "/clear",   description: "Clear the current conversation",   icon: Trash2,     clientOnly: true },
  { command: "/help",    description: "Show available commands & help",    icon: HelpCircle, clientOnly: true },
  { command: "/export",  description: "Export conversation as Markdown",   icon: Download,   clientOnly: true },
  { command: "/prompt",  description: "Use a prompt template",            icon: FileText },
  { command: "/tool",    description: "Use a specific tool",              icon: Wrench },
  { command: "/search",  description: "Search your conversations",        icon: Search },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SlashCommand({ query, onSelect, onClose, position }: SlashCommandProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      commands.filter((c) =>
        c.command.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        onSelect(filtered[selectedIndex].command);
      } else if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Tab" && filtered[selectedIndex]) {
        // Tab completes the selected command
        e.preventDefault();
        onSelect(filtered[selectedIndex].command);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Scroll selected into view
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute z-50 w-72 bg-surface border border-border rounded-xl shadow-lg overflow-hidden"
      style={{ bottom: position.top, left: position.left }}
    >
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        Slash Commands
      </div>
      <div className="py-1 max-h-[240px] overflow-y-auto">
        {filtered.map((cmd, idx) => {
          const Icon = cmd.icon;
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={cmd.command}
              data-selected={isSelected}
              onClick={() => onSelect(cmd.command)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:bg-surface-secondary",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs">{cmd.command}</span>
                <p className="text-[10px] text-text-tertiary truncate">
                  {cmd.description}
                </p>
              </div>
              {isSelected && (
                <kbd className="text-[10px] text-text-tertiary bg-surface-tertiary px-1 py-0.5 rounded border border-border">
                  Tab
                </kbd>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Utility: check if a slash command is client-only (handled without sending to API).
 */
export function isClientOnlySlashCommand(input: string): boolean {
  const cmd = input.trim().split(/\s/)[0]?.toLowerCase();
  return commands.some((c) => c.command === cmd && c.clientOnly);
}

/**
 * Get the SlashCommandDef for a given input string, if it matches.
 */
export function getSlashCommand(input: string): SlashCommandDef | undefined {
  const cmd = input.trim().split(/\s/)[0]?.toLowerCase();
  return commands.find((c) => c.command === cmd);
}
