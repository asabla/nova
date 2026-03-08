import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui/Badge";

const meta: Meta = {
  title: "NOVA/Changelog",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

interface ChangelogEntry {
  version: string;
  date: string;
  label: "major" | "minor" | "patch";
  changes: { type: "added" | "changed" | "fixed" | "removed"; text: string }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "1.3.0",
    date: "2026-03-08",
    label: "minor",
    changes: [
      { type: "added", text: "Responsive Patterns — mobile/tablet/desktop comparison stories" },
      { type: "added", text: "Onboarding Flow — multi-step wizard pattern with all step variants" },
      { type: "added", text: "Design Tokens Reference — comprehensive color, typography, and spacing tokens" },
      { type: "added", text: "Animation & Motion Guide — interactive hover, expand, loading, and easing demos" },
      { type: "added", text: "Dark Mode Audit — side-by-side light/dark comparison of all UI primitives" },
      { type: "added", text: "Admin Panel Layout — member management, settings form, security settings" },
      { type: "added", text: "Dashboard Layout — full page with sidebar, header, stats, and activity feed" },
      { type: "added", text: "Agent Marketplace — grid with categories, search, pagination, and detail card" },
      { type: "added", text: "Knowledge Base Browser — collections, documents, upload area, empty state" },
      { type: "added", text: "Model Comparison — selector cards, comparison table, compact picker" },
      { type: "added", text: "Conversation List — date-grouped sidebar with bulk select and empty states" },
      { type: "added", text: "Component Status Matrix — interactive table tracking all 69 components" },
      { type: "changed", text: "Added autodocs tags to all 41 component stories" },
      { type: "changed", text: "Added JSDoc descriptions to 16 component story metas" },
      { type: "changed", text: "Added play functions to Dropdown story" },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-03-07",
    label: "minor",
    changes: [
      { type: "added", text: "MessageBubble stories — user/assistant variants with code blocks and metadata" },
      { type: "added", text: "MessageInput stories — empty, disabled, streaming states" },
      { type: "added", text: "StreamingMessage stories — simulated character-by-character streaming" },
      { type: "added", text: "ToolCallDisplay + ToolCallPanel stories — all status states" },
      { type: "added", text: "CommandPalette stories — open state with mock router context" },
      { type: "added", text: "FileAttachments stories — FilePreview, AttachmentBar, FileUploadPreview" },
      { type: "added", text: "ArtifactDisplay stories — code, table, document, HTML, mermaid types" },
      { type: "added", text: "SlashCommand + MentionPopup stories — dropdown overlays" },
      { type: "added", text: "ConversationHeader stories — default, pinned, untitled variants" },
      { type: "added", text: "AgentReasoningTrace stories — completed, running, failed, nested steps" },
      { type: "added", text: "URLPreviewCard stories — with pre-seeded QueryClient" },
      { type: "added", text: "VoiceInput, DynamicWidget, ShortcutsHelpOverlay, SkipNav stories" },
      { type: "added", text: "Error Recovery Patterns — rate limit, server, network, boundary fallback" },
      { type: "added", text: "Loading States Collection — skeleton screens for all major views" },
      { type: "added", text: "Icon Library — 80+ lucide-react icons with search and categories" },
      { type: "changed", text: "Added i18n and QueryClientProvider to Storybook preview globally" },
      { type: "changed", text: "Added play functions to Button, Input, Tabs, Dialog" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-06",
    label: "minor",
    changes: [
      { type: "added", text: "35 initial Storybook stories covering all 25 UI components" },
      { type: "added", text: "Introduction story with design tokens, typography, and spacing reference" },
      { type: "added", text: "Showcase story — full app mockup with sidebar, chat, and settings" },
      { type: "added", text: "Patterns stories — chat thread, agent cards, settings, empty states" },
      { type: "added", text: "FormPatterns stories — login, agent creation, search with filters" },
      { type: "added", text: "Accessibility stories — skip nav, labels, focus management" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-05",
    label: "major",
    changes: [
      { type: "added", text: "Storybook 10.x setup with @storybook/react-vite" },
      { type: "added", text: "Dark/light theme switching via data-theme attribute" },
      { type: "added", text: "Addons: docs, a11y, themes" },
      { type: "added", text: "14 foundational UI components added to design system" },
    ],
  },
];

const typeColors: Record<string, string> = {
  added: "text-success",
  changed: "text-primary",
  fixed: "text-warning",
  removed: "text-danger",
};

const typeLabels: Record<string, string> = {
  added: "Added",
  changed: "Changed",
  fixed: "Fixed",
  removed: "Removed",
};

const labelVariants: Record<string, "primary" | "success" | "warning"> = {
  major: "primary",
  minor: "success",
  patch: "warning",
};

/** Design system changelog documenting versions and changes */
export const Default: Story = {
  render: () => (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-text mb-1">Design System Changelog</h2>
      <p className="text-sm text-text-secondary mb-6">
        Version history and notable changes to the NOVA design system.
      </p>

      <div className="space-y-8">
        {changelog.map((entry) => (
          <div key={entry.version}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-bold text-text">v{entry.version}</h3>
              <Badge variant={labelVariants[entry.label]}>{entry.label}</Badge>
              <span className="text-xs text-text-tertiary">{entry.date}</span>
            </div>

            <div className="space-y-1.5 pl-4 border-l-2 border-border">
              {entry.changes.map((change, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider w-16 shrink-0 pt-0.5 ${typeColors[change.type]}`}>
                    {typeLabels[change.type]}
                  </span>
                  <p className="text-xs text-text-secondary">{change.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
};
