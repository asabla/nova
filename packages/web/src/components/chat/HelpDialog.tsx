import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  Keyboard,
  MessageSquare,
  Bot,
  BookOpen,
  Wrench,
  FileText,
  Search,
  BarChart3,
  Settings,
  ArrowRight,
} from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { commands } from "./SlashCommand";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

// ── Static config ──────────────────────────────────────────────────
// Update these arrays when features change. Slash commands are derived
// from the SlashCommand registry automatically.

const EXAMPLE_PROMPTS = [
  { text: "/search what did we discuss about auth?", description: "Search past conversations" },
  { text: "@research-agent summarize the latest on LLM agents", description: "Delegate to an agent" },
  { text: "Help me write a Python script to parse CSV files", description: "Get coding help" },
  { text: "/export", description: "Export conversation as Markdown" },
];

const KEYBOARD_SHORTCUTS = [
  { keys: "Enter", label: "Send message" },
  { keys: "Shift + Enter", label: "New line" },
  { keys: "⌘K", label: "Search" },
  { keys: "/", label: "Slash commands" },
  { keys: "@", label: "Mention user or agent" },
  { keys: "⌘?", label: "Keyboard shortcuts" },
];

const QUICK_LINKS: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { to: "/conversations/new", label: "New Conversation", icon: MessageSquare },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  { to: "/prompts", label: "Prompt Library", icon: FileText },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/search", label: "Search", icon: Search },
  { to: "/usage", label: "Usage", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

// ── Component ──────────────────────────────────────────────────────

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} title={t("help.title", "Help")} size="lg">
      <div className="max-h-[70vh] overflow-y-auto -mx-6 px-6 space-y-6">
        {/* Slash Commands */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Slash Commands
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {commands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <div key={cmd.command} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg">
                  <Icon className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                  <span className="font-mono text-xs text-primary">{cmd.command}</span>
                  <span className="text-xs text-text-secondary truncate">{cmd.description}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Example Prompts */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Example Prompts
          </h3>
          <div className="space-y-1.5">
            {EXAMPLE_PROMPTS.map((ex) => (
              <div key={ex.text} className="px-3 py-2 rounded-lg bg-surface-secondary border border-border">
                <p className="font-mono text-xs text-text">{ex.text}</p>
                <p className="text-[10px] text-text-tertiary mt-0.5">{ex.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Keyboard Shortcuts */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Keyboard Shortcuts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {KEYBOARD_SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-text-secondary">{s.label}</span>
                <kbd className="text-xs text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded border border-border font-mono">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Quick Links
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text hover:bg-surface-secondary transition-colors group"
                >
                  <Icon className="h-3.5 w-3.5 text-text-tertiary group-hover:text-primary shrink-0" />
                  <span className="truncate">{link.label}</span>
                  <ArrowRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover:opacity-100 ml-auto shrink-0 transition-opacity" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
