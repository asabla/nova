import { useState, useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check, X, Minus, Search } from "lucide-react";
import { clsx } from "clsx";

const meta: Meta = {
  title: "NOVA/ComponentStatus",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

interface ComponentEntry {
  name: string;
  category: "ui" | "chat" | "layout" | "markdown" | "other";
  hasStory: boolean;
  hasPlayTest: boolean;
  hasDarkMode: boolean;
  notes?: string;
}

const components: ComponentEntry[] = [
  // UI components
  { name: "AccessibleLabel", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "Via Accessibility.stories" },
  { name: "Alert", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Avatar", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Badge", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Breadcrumb", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Button", category: "ui", hasStory: true, hasPlayTest: true, hasDarkMode: true },
  { name: "Card", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Checkbox", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Dialog", category: "ui", hasStory: true, hasPlayTest: true, hasDarkMode: true },
  { name: "Dropdown", category: "ui", hasStory: true, hasPlayTest: true, hasDarkMode: true },
  { name: "EmptyState", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Input", category: "ui", hasStory: true, hasPlayTest: true, hasDarkMode: true },
  { name: "Kbd", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ModelCapabilityBadges", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Pagination", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ProgressBar", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "QRCode", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Select", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Separator", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ShortcutsHelpOverlay", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Skeleton", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "SkipNav", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Switch", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Table", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Tabs", category: "ui", hasStory: true, hasPlayTest: true, hasDarkMode: true },
  { name: "Textarea", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Toast", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "Tooltip", category: "ui", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ContextualTooltip", category: "ui", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Extends Tooltip" },

  // Chat components
  { name: "MessageBubble", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "MessageInput", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "StreamingMessage", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ToolCallDisplay", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ToolCallPanel", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "In ToolCallDisplay.stories" },
  { name: "ToolStatusChip", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "CommandPalette", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "AttachmentBar", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "In FileAttachments.stories" },
  { name: "FilePreview", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "In FileAttachments.stories" },
  { name: "FileUploadPreview", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "In FileAttachments.stories" },
  { name: "ArtifactDisplay", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ArtifactRenderer", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "In ArtifactDisplay.stories" },
  { name: "SlashCommand", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "MentionPopup", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "In SlashCommand.stories" },
  { name: "ConversationHeader", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ConversationSettings", category: "chat", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Complex store deps" },
  { name: "AgentReasoningTrace", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "AgentTraceView", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "In AgentReasoningTrace.stories" },
  { name: "URLPreviewCard", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "VoiceInput", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "DynamicWidget", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "ErrorMessage", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "RateLimitWarning", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "TypingIndicator", category: "chat", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "MessageList", category: "chat", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Requires WebSocket context" },

  // Layout components
  { name: "Sidebar", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Complex store + router deps" },
  { name: "Header", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Complex store + router deps" },
  { name: "OmniBar", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Complex store + router deps" },
  { name: "NotificationPanel", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Requires notification store" },
  { name: "NotificationCenter", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Requires notification store" },
  { name: "ConnectionStatus", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Requires WS hook" },
  { name: "StatusBanner", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Requires WS store" },
  { name: "SystemStatusBanner", category: "layout", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Fetches /health" },
  { name: "GlobalShortcuts", category: "other", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Logic-only, no visual" },

  // Markdown
  { name: "CodeBlock", category: "markdown", hasStory: true, hasPlayTest: false, hasDarkMode: true },
  { name: "MarkdownRenderer", category: "markdown", hasStory: false, hasPlayTest: false, hasDarkMode: true, notes: "Used via MessageBubble stories" },

  // Other
  { name: "ErrorBoundary", category: "other", hasStory: true, hasPlayTest: false, hasDarkMode: true, notes: "Via ErrorRecovery.stories" },
  { name: "NotFound", category: "other", hasStory: false, hasPlayTest: false, hasDarkMode: true },
  { name: "OnboardingWizard", category: "other", hasStory: false, hasPlayTest: false, hasDarkMode: true },
  { name: "SetupWizard", category: "other", hasStory: false, hasPlayTest: false, hasDarkMode: true },
];

function StatusIcon({ value }: { value: boolean }) {
  return value ? (
    <Check className="h-4 w-4 text-success" />
  ) : (
    <X className="h-4 w-4 text-text-tertiary" />
  );
}

/** Component Status Matrix — shows story coverage, interaction tests, and dark mode support */
export const Default: Story = {
  render: () => {
    const [filter, setFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");

    const filtered = useMemo(() => {
      return components.filter((c) => {
        if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
        if (filter && !c.name.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
      });
    }, [filter, categoryFilter]);

    const total = components.length;
    const withStories = components.filter((c) => c.hasStory).length;
    const withTests = components.filter((c) => c.hasPlayTest).length;

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-1">Component Status Matrix</h2>
        <p className="text-sm text-text-secondary mb-4">
          {total} components total — {withStories} with stories ({Math.round((withStories / total) * 100)}%) — {withTests} with interaction tests
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Filter components..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-8 pl-9 pr-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary field-glow"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-3 text-xs rounded-lg border border-border bg-surface text-text"
          >
            <option value="all">All categories</option>
            <option value="ui">UI</option>
            <option value="chat">Chat</option>
            <option value="layout">Layout</option>
            <option value="markdown">Markdown</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-tertiary/50">
                <th className="text-left px-3 py-2 font-medium text-text">Component</th>
                <th className="text-left px-3 py-2 font-medium text-text">Category</th>
                <th className="text-center px-3 py-2 font-medium text-text">Story</th>
                <th className="text-center px-3 py-2 font-medium text-text">Play Test</th>
                <th className="text-center px-3 py-2 font-medium text-text">Dark Mode</th>
                <th className="text-left px-3 py-2 font-medium text-text">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.name}
                  className={clsx(
                    "border-t border-border hover:bg-surface-secondary/50",
                    !c.hasStory && "opacity-70",
                  )}
                >
                  <td className="px-3 py-2 font-mono text-text">{c.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={clsx(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        c.category === "ui" && "bg-primary/10 text-primary",
                        c.category === "chat" && "bg-success/10 text-success",
                        c.category === "layout" && "bg-warning/10 text-warning",
                        c.category === "markdown" && "bg-purple-500/10 text-purple-400",
                        c.category === "other" && "bg-surface-tertiary text-text-tertiary",
                      )}
                    >
                      {c.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center"><StatusIcon value={c.hasStory} /></td>
                  <td className="px-3 py-2 text-center"><StatusIcon value={c.hasPlayTest} /></td>
                  <td className="px-3 py-2 text-center"><StatusIcon value={c.hasDarkMode} /></td>
                  <td className="px-3 py-2 text-text-tertiary">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
};
