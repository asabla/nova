import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  MessageSquare, Send, Paperclip, Plus, Search, Settings,
  Microscope, BookOpen, Compass, Zap, Menu, X, ArrowLeft,
  Bot, ChevronDown, MoreHorizontal, Pin, Star,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const meta: Meta = {
  title: "Patterns/ResponsivePatterns",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

// ── Shared ───────────────────────────────────────────────────────────────

function DeviceFrame({ width, label, children }: { width: number; label: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex flex-col items-center">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-2">
        {label} ({width}px)
      </p>
      <div
        className="border border-border rounded-xl overflow-hidden bg-surface shadow-lg"
        style={{ width, height: 568 }}
      >
        {children}
      </div>
    </div>
  );
}

const messages = [
  { id: "1", role: "user", text: "How do I implement RAG with embeddings?" },
  { id: "2", role: "assistant", text: "RAG (Retrieval-Augmented Generation) combines a retrieval system with an LLM. Here's a step-by-step approach:\n\n1. **Index your documents** — split into chunks, generate embeddings\n2. **Store in a vector DB** — pgvector, Pinecone, or Qdrant\n3. **At query time** — embed the question, find top-K similar chunks\n4. **Augment the prompt** — inject retrieved context before the question" },
  { id: "3", role: "user", text: "What embedding model should I use?" },
];

const conversations = [
  { id: "1", title: "RAG implementation guide", pinned: true, time: "2m" },
  { id: "2", title: "WebSocket reconnection", pinned: false, time: "1h" },
  { id: "3", title: "Tailwind v4 migration", pinned: false, time: "1d" },
  { id: "4", title: "Database schema review", pinned: false, time: "1d" },
  { id: "5", title: "Unit tests for auth", pinned: false, time: "2d" },
];

// ── Stories ───────────────────────────────────────────────────────────────

/** Mobile chat view — full-screen conversation with bottom input */
export const MobileChat: Story = {
  render: () => (
    <DeviceFrame width={375} label="Mobile">
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button className="p-1 text-text-tertiary"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text truncate">RAG implementation guide</p>
            <p className="text-[10px] text-text-tertiary">Claude Sonnet 4</p>
          </div>
          <button className="p-1 text-text-tertiary"><MoreHorizontal className="h-4 w-4" /></button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-surface-secondary border border-border text-text rounded-bl-md",
                )}
              >
                {m.text.split("\n").map((line, i) => (
                  <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-secondary px-3 py-2">
            <button className="text-text-tertiary"><Paperclip className="h-4 w-4" /></button>
            <input
              type="text"
              placeholder="Message..."
              className="flex-1 text-sm bg-transparent text-text placeholder:text-text-tertiary outline-none"
              readOnly
            />
            <button className="text-primary"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </DeviceFrame>
  ),
};

/** Desktop chat view — sidebar + conversation */
export const DesktopChat: Story = {
  render: () => (
    <DeviceFrame width={900} label="Desktop">
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col bg-surface-secondary border-r border-border">
          <div className="flex items-center justify-between px-3 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Zap className="h-3 w-3 text-primary" />
              </div>
              <span className="font-bold text-xs text-text">NOVA</span>
            </div>
            <button className="p-1 text-text-tertiary hover:text-text"><Plus className="h-3.5 w-3.5" /></button>
          </div>

          <div className="px-2 py-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary" />
              <input className="w-full h-7 pl-7 pr-2 text-[10px] rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary" placeholder="Search..." readOnly />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-1.5 space-y-0.5">
            {conversations.map((c, i) => (
              <button
                key={c.id}
                className={clsx(
                  "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-[10px] transition-colors",
                  i === 0 ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-tertiary",
                )}
              >
                {c.pinned && <Pin className="h-2.5 w-2.5 shrink-0" />}
                <span className="truncate flex-1">{c.title}</span>
                <span className="text-text-tertiary shrink-0">{c.time}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-border px-1.5 py-1.5 space-y-0.5">
            {[{ icon: Settings, label: "Settings" }].map((item) => (
              <button key={item.label} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] text-text-secondary hover:bg-surface-tertiary">
                <item.icon className="h-3 w-3" />
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main conversation */}
        <div className="flex-1 flex flex-col">
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div>
              <p className="text-xs font-semibold text-text">RAG implementation guide</p>
              <p className="text-[10px] text-text-tertiary">Claude Sonnet 4 · 12 messages</p>
            </div>
            <div className="flex gap-1">
              <Badge variant="primary">claude-sonnet-4</Badge>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-2.5">
                {m.role === "assistant" && <Avatar name="NOVA" size="sm" />}
                {m.role === "user" && <div className="w-7" />}
                <div className={clsx("flex-1 min-w-0", m.role === "user" && "text-right")}>
                  <div
                    className={clsx(
                      "inline-block text-left max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-secondary border border-border text-text",
                    )}
                  >
                    {m.text.split("\n").map((line, i) => (
                      <p key={i} className={i > 0 ? "mt-1" : ""}>{line}</p>
                    ))}
                  </div>
                </div>
                {m.role === "user" && <Avatar name="Sarah" size="sm" />}
              </div>
            ))}
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-secondary px-3 py-2.5">
              <button className="text-text-tertiary"><Paperclip className="h-4 w-4" /></button>
              <input
                type="text"
                placeholder="Send a message... (⌘ Enter)"
                className="flex-1 text-xs bg-transparent text-text placeholder:text-text-tertiary outline-none"
                readOnly
              />
              <button className="text-primary"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </DeviceFrame>
  ),
};

/** Mobile conversation list — full-screen list with bottom nav */
export const MobileConversationList: Story = {
  render: () => (
    <DeviceFrame width={375} label="Mobile">
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm text-text">NOVA</span>
          </div>
          <button className="p-2 text-text-tertiary"><Search className="h-4 w-4" /></button>
        </header>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Pinned</p>
          {conversations.filter((c) => c.pinned).map((c) => (
            <button key={c.id} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Pin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{c.title}</p>
                <p className="text-xs text-text-tertiary">Claude Sonnet 4 · {c.time} ago</p>
              </div>
            </button>
          ))}

          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Today</p>
          {conversations.filter((c) => !c.pinned).slice(0, 2).map((c) => (
            <button key={c.id} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
              <div className="h-9 w-9 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{c.title}</p>
                <p className="text-xs text-text-tertiary">{c.time} ago</p>
              </div>
            </button>
          ))}

          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">Yesterday</p>
          {conversations.filter((c) => !c.pinned).slice(2).map((c) => (
            <button key={c.id} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-secondary transition-colors">
              <div className="h-9 w-9 rounded-lg bg-surface-tertiary flex items-center justify-center shrink-0">
                <MessageSquare className="h-4 w-4 text-text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{c.title}</p>
                <p className="text-xs text-text-tertiary">{c.time} ago</p>
              </div>
            </button>
          ))}
        </div>

        {/* Bottom nav */}
        <nav className="flex items-center justify-around px-2 py-2 border-t border-border bg-surface-secondary">
          {[
            { icon: MessageSquare, label: "Chats", active: true },
            { icon: Microscope, label: "Research", active: false },
            { icon: Plus, label: "New", active: false, special: true },
            { icon: BookOpen, label: "Knowledge", active: false },
            { icon: Settings, label: "Settings", active: false },
          ].map((item) => (
            <button
              key={item.label}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors",
                item.special ? "bg-primary text-white rounded-xl px-3" : item.active ? "text-primary" : "text-text-tertiary",
              )}
            >
              <item.icon className={clsx("h-5 w-5", item.special && "h-5 w-5")} />
              {!item.special && <span className="text-[9px]">{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>
    </DeviceFrame>
  ),
};

/** Side-by-side comparison: mobile vs desktop */
export const SideBySide: Story = {
  render: () => (
    <div className="flex items-start gap-8 p-8 overflow-x-auto">
      <DeviceFrame width={375} label="Mobile (375px)">
        <div className="flex flex-col h-full">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <button className="p-1 text-text-tertiary"><Menu className="h-4 w-4" /></button>
            <span className="font-bold text-sm text-text">NOVA</span>
            <div className="flex-1" />
            <Avatar name="Sarah" size="sm" />
          </header>
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm font-medium text-text mb-1">Start a conversation</p>
              <p className="text-xs text-text-tertiary mb-3">Tap + to begin</p>
              <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Chat</Button>
            </div>
          </div>
          <nav className="flex items-center justify-around px-2 py-2 border-t border-border bg-surface-secondary">
            {[MessageSquare, Microscope, Plus, BookOpen, Settings].map((Icon, i) => (
              <button
                key={i}
                className={clsx(
                  "p-2 rounded-lg",
                  i === 0 ? "text-primary" : i === 2 ? "bg-primary text-white rounded-xl" : "text-text-tertiary",
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </nav>
        </div>
      </DeviceFrame>

      <DeviceFrame width={768} label="Tablet (768px)">
        <div className="flex h-full">
          <aside className="w-14 flex flex-col items-center bg-surface-secondary border-r border-border py-3 gap-1">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center mb-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            {[MessageSquare, Microscope, BookOpen, Compass, Settings].map((Icon, i) => (
              <button
                key={i}
                className={clsx(
                  "h-8 w-8 flex items-center justify-center rounded-lg",
                  i === 0 ? "bg-primary/10 text-primary" : "text-text-tertiary",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </aside>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-secondary">Select a conversation</p>
            </div>
          </div>
        </div>
      </DeviceFrame>
    </div>
  ),
  parameters: { layout: "padded" },
};
