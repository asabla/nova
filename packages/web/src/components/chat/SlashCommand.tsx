import { useState, useEffect, useRef } from "react";
import { Bot, FileText, Settings, Wrench, Search } from "lucide-react";
import { clsx } from "clsx";

interface SlashCommandProps {
  query: string;
  onSelect: (command: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const commands = [
  { command: "/agent", description: "Use a specific agent", icon: Bot },
  { command: "/prompt", description: "Use a prompt template", icon: FileText },
  { command: "/model", description: "Switch the model", icon: Settings },
  { command: "/tool", description: "Use a specific tool", icon: Wrench },
  { command: "/search", description: "Search your conversations", icon: Search },
];

export function SlashCommand({ query, onSelect, onClose, position }: SlashCommandProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((c) =>
    c.command.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="absolute z-50 w-64 bg-surface border border-border rounded-xl shadow-lg overflow-hidden"
      style={{ bottom: position.top, left: position.left }}
    >
      <div className="py-1">
        {filtered.map((cmd, idx) => {
          const Icon = cmd.icon;
          return (
            <button
              key={cmd.command}
              onClick={() => onSelect(cmd.command)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                idx === selectedIndex ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-secondary",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div>
                <span className="font-mono text-xs">{cmd.command}</span>
                <p className="text-[10px] text-text-tertiary">{cmd.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
