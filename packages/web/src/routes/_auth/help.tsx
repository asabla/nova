import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle, MessageSquare, Bot, BookOpen, FolderKanban, Settings, Keyboard, ChevronDown, ChevronUp, Search, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_auth/help")({
  component: HelpPage,
});

const SECTIONS = [
  {
    title: "Getting Started",
    icon: MessageSquare,
    content: [
      { q: "How do I start a conversation?", a: "Click 'New Chat' in the sidebar or press Cmd+N. Type your message and press Enter to send." },
      { q: "How do I switch models?", a: "Open conversation settings (gear icon) and select a different model from the dropdown." },
      { q: "Can I use keyboard shortcuts?", a: "Yes! Press Cmd+/ to see all available keyboard shortcuts, or Cmd+K to open the command palette." },
    ],
  },
  {
    title: "Conversations",
    icon: MessageSquare,
    content: [
      { q: "How do I share a conversation?", a: "Click the menu icon (...) in the conversation header and select 'Share'. A public link will be copied to your clipboard." },
      { q: "Can I fork a conversation?", a: "Yes, click the menu icon and select 'Fork'. This creates a copy of the conversation up to that point." },
      { q: "How do I export conversations?", a: "Use the menu to export as JSON or Markdown. You can also export from Settings > API Keys." },
      { q: "How do I organize conversations?", a: "Use folders and tags to organize your conversations. You can also pin important ones for quick access." },
    ],
  },
  {
    title: "Agents",
    icon: Bot,
    content: [
      { q: "What are agents?", a: "Agents are custom AI assistants with specific system prompts, tools, and knowledge. You can create agents tailored to specific tasks." },
      { q: "How do I create an agent?", a: "Go to Agents > New Agent. Configure the system prompt, attach tools and knowledge, then test before publishing." },
      { q: "Can I share agents?", a: "Yes, set the agent visibility to 'Team', 'Organization', or 'Public' to share with others." },
    ],
  },
  {
    title: "Knowledge Collections",
    icon: BookOpen,
    content: [
      { q: "What are knowledge collections?", a: "Collections of documents that agents can search and reference. Upload files or add URLs to build a searchable knowledge base." },
      { q: "What file types are supported?", a: "PDF, DOCX, XLSX, CSV, TXT, MD, PPTX, code files, images, and more." },
      { q: "How does RAG work?", a: "When you query a collection, the system finds relevant document chunks and includes them as context for the AI response." },
    ],
  },
  {
    title: "Workspaces",
    icon: FolderKanban,
    content: [
      { q: "What are workspaces?", a: "Workspaces are project containers that group conversations, files, and team members together." },
      { q: "Can I invite team members?", a: "Yes, go to the workspace Members tab and invite users by email." },
    ],
  },
  {
    title: "Settings & Admin",
    icon: Settings,
    content: [
      { q: "How do I change my theme?", a: "Go to Settings > Appearance. Choose between Light, Dark, or System theme." },
      { q: "How do I manage API keys?", a: "Go to Settings > API Keys. You can create, rotate, and revoke API keys." },
      { q: "How do I configure SSO?", a: "Admins can go to Admin > SSO to add and configure SSO providers like Azure AD, Google, or GitHub." },
    ],
  },
];

const SHORTCUTS = [
  { keys: ["Cmd", "K"], description: "Open command palette" },
  { keys: ["Cmd", "N"], description: "New conversation" },
  { keys: ["Cmd", "/"], description: "Show keyboard shortcuts" },
  { keys: ["Cmd", ","], description: "Open settings" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in message" },
  { keys: ["Esc"], description: "Close dialog / Stop streaming" },
];

function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>("Getting Started");

  const filteredSections = searchQuery
    ? SECTIONS.map((s) => ({
        ...s,
        content: s.content.filter(
          (item) =>
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.a.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      })).filter((s) => s.content.length > 0)
    : SECTIONS;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-text">Help Center</h1>
        </div>
        <p className="text-sm text-text-secondary">Find answers to common questions about NOVA.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help topics..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-text placeholder:text-text-tertiary text-sm"
        />
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-3">
        {filteredSections.map((section) => (
          <div key={section.title} className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === section.title ? null : section.title)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <section.icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-text">{section.title}</span>
                <span className="text-xs text-text-tertiary">({section.content.length})</span>
              </div>
              {expandedSection === section.title ? (
                <ChevronUp className="h-4 w-4 text-text-tertiary" />
              ) : (
                <ChevronDown className="h-4 w-4 text-text-tertiary" />
              )}
            </button>
            {expandedSection === section.title && (
              <div className="border-t border-border">
                {section.content.map((item, i) => (
                  <div key={i} className="p-4 border-b border-border last:border-b-0">
                    <p className="text-sm font-medium text-text mb-1">{item.q}</p>
                    <p className="text-sm text-text-secondary">{item.a}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Keyboard Shortcuts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Keyboard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium text-text">Keyboard Shortcuts</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SHORTCUTS.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-secondary border border-border">
              <span className="text-xs text-text-secondary">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, j) => (
                  <kbd key={j} className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded text-text-secondary">
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
