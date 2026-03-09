import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  // Chat & messaging
  MessageSquare, Send, Paperclip, Mic, MicOff, Volume2, VolumeX, AudioLines,
  // Navigation & layout
  Menu, X, ChevronDown, ChevronRight, ChevronUp, ChevronLeft, ArrowRight, ArrowLeft,
  // Actions
  Plus, Pencil, Trash2, Copy, Check, Download, Upload, RefreshCw, RotateCcw,
  Search, Settings, MoreHorizontal, ExternalLink, Share, Save,
  // Status & feedback
  AlertTriangle, Info, CheckCircle, XCircle, Loader2, Clock,
  // Content types
  FileText, FileCode, FileJson, FileSpreadsheet, Image, Code, Globe,
  // AI & agents
  Bot, Brain, Wrench, Cpu, Sparkles, GitBranch, Blocks, Zap,
  // User & auth
  User, Users, Shield, Key, Lock, LogOut,
  // Data & charts
  BarChart, Table2, Database, Server, Radio,
  // UI elements
  Sun, Moon, Monitor, Eye, EyeOff, Pin, PinOff, Archive,
  Maximize2, Minimize2, Play, Pause, Square, StickyNote,
  Keyboard, Hash, BookOpen, FolderKanban, HelpCircle,
  ThumbsUp, ThumbsDown, WifiOff, Wifi, ServerCrash,
} from "lucide-react";
import { clsx } from "clsx";

const meta: Meta = {
  title: "NOVA/IconLibrary",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// Group icons by usage context
const iconGroups = [
  {
    label: "Chat & Messaging",
    icons: [
      { name: "MessageSquare", icon: MessageSquare, usage: "Conversations, chat" },
      { name: "Send", icon: Send, usage: "Send message" },
      { name: "Paperclip", icon: Paperclip, usage: "Attach file" },
      { name: "Mic", icon: Mic, usage: "Voice input" },
      { name: "MicOff", icon: MicOff, usage: "Voice unavailable" },
      { name: "Volume2", icon: Volume2, usage: "Text-to-speech" },
      { name: "VolumeX", icon: VolumeX, usage: "Stop TTS" },
      { name: "AudioLines", icon: AudioLines, usage: "Audio mode toggle" },
    ],
  },
  {
    label: "AI & Agents",
    icons: [
      { name: "Bot", icon: Bot, usage: "Agent avatar" },
      { name: "Brain", icon: Brain, usage: "Reasoning trace" },
      { name: "Wrench", icon: Wrench, usage: "Tool calls" },
      { name: "Cpu", icon: Cpu, usage: "Processing" },
      { name: "Sparkles", icon: Sparkles, usage: "AI generated" },
      { name: "GitBranch", icon: GitBranch, usage: "Fork, branch" },
      { name: "Blocks", icon: Blocks, usage: "Widgets" },
      { name: "Zap", icon: Zap, usage: "Output, fast action" },
    ],
  },
  {
    label: "Navigation",
    icons: [
      { name: "Menu", icon: Menu, usage: "Hamburger menu" },
      { name: "X", icon: X, usage: "Close, dismiss" },
      { name: "ChevronDown", icon: ChevronDown, usage: "Expand" },
      { name: "ChevronRight", icon: ChevronRight, usage: "Collapsed" },
      { name: "ChevronUp", icon: ChevronUp, usage: "Collapse" },
      { name: "ChevronLeft", icon: ChevronLeft, usage: "Back" },
      { name: "ArrowRight", icon: ArrowRight, usage: "Forward" },
      { name: "ArrowLeft", icon: ArrowLeft, usage: "Back" },
    ],
  },
  {
    label: "Actions",
    icons: [
      { name: "Plus", icon: Plus, usage: "Create new" },
      { name: "Pencil", icon: Pencil, usage: "Edit" },
      { name: "Trash2", icon: Trash2, usage: "Delete" },
      { name: "Copy", icon: Copy, usage: "Copy to clipboard" },
      { name: "Check", icon: Check, usage: "Confirm, success" },
      { name: "Download", icon: Download, usage: "Download, export" },
      { name: "Upload", icon: Upload, usage: "Upload" },
      { name: "RefreshCw", icon: RefreshCw, usage: "Refresh, retry" },
      { name: "RotateCcw", icon: RotateCcw, usage: "Rerun" },
      { name: "Search", icon: Search, usage: "Search" },
      { name: "Settings", icon: Settings, usage: "Settings" },
      { name: "MoreHorizontal", icon: MoreHorizontal, usage: "More actions" },
      { name: "ExternalLink", icon: ExternalLink, usage: "Open external" },
      { name: "Share", icon: Share, usage: "Share" },
      { name: "Save", icon: Save, usage: "Save" },
    ],
  },
  {
    label: "Status & Feedback",
    icons: [
      { name: "AlertTriangle", icon: AlertTriangle, usage: "Warning, error" },
      { name: "Info", icon: Info, usage: "Information" },
      { name: "CheckCircle", icon: CheckCircle, usage: "Success" },
      { name: "XCircle", icon: XCircle, usage: "Error, failure" },
      { name: "Loader2", icon: Loader2, usage: "Loading spinner" },
      { name: "Clock", icon: Clock, usage: "Timing, countdown" },
      { name: "ThumbsUp", icon: ThumbsUp, usage: "Rate positive" },
      { name: "ThumbsDown", icon: ThumbsDown, usage: "Rate negative" },
    ],
  },
  {
    label: "Content Types",
    icons: [
      { name: "FileText", icon: FileText, usage: "Document, PDF" },
      { name: "FileCode", icon: FileCode, usage: "Source code file" },
      { name: "FileJson", icon: FileJson, usage: "JSON export" },
      { name: "FileSpreadsheet", icon: FileSpreadsheet, usage: "CSV export" },
      { name: "Image", icon: Image, usage: "Image file" },
      { name: "Code", icon: Code, usage: "Code artifact" },
      { name: "Globe", icon: Globe, usage: "Web, HTML" },
      { name: "BarChart", icon: BarChart, usage: "Charts" },
      { name: "Table2", icon: Table2, usage: "Tables" },
    ],
  },
  {
    label: "User & Auth",
    icons: [
      { name: "User", icon: User, usage: "User profile" },
      { name: "Users", icon: Users, usage: "Team, members" },
      { name: "Shield", icon: Shield, usage: "Security, admin" },
      { name: "Key", icon: Key, usage: "API key, auth" },
      { name: "Lock", icon: Lock, usage: "Protected" },
      { name: "LogOut", icon: LogOut, usage: "Sign out" },
    ],
  },
  {
    label: "Theme & Display",
    icons: [
      { name: "Sun", icon: Sun, usage: "Light mode" },
      { name: "Moon", icon: Moon, usage: "Dark mode" },
      { name: "Monitor", icon: Monitor, usage: "System theme" },
      { name: "Eye", icon: Eye, usage: "Show" },
      { name: "EyeOff", icon: EyeOff, usage: "Hide" },
      { name: "Maximize2", icon: Maximize2, usage: "Fullscreen" },
      { name: "Minimize2", icon: Minimize2, usage: "Exit fullscreen" },
    ],
  },
  {
    label: "Infrastructure",
    icons: [
      { name: "Database", icon: Database, usage: "Database" },
      { name: "Server", icon: Server, usage: "Server, API" },
      { name: "Radio", icon: Radio, usage: "WebSocket" },
      { name: "Wifi", icon: Wifi, usage: "Connected" },
      { name: "WifiOff", icon: WifiOff, usage: "Disconnected" },
      { name: "ServerCrash", icon: ServerCrash, usage: "Server error" },
    ],
  },
];

function IconCard({
  name,
  Icon,
  usage,
}: {
  name: string;
  Icon: typeof MessageSquare;
  usage: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(name);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={clsx(
        "flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border",
        "hover:bg-surface-secondary transition-colors cursor-pointer text-center",
        copied && "border-success bg-success/5",
      )}
      title={`${name} — ${usage}. Click to copy name.`}
    >
      <Icon className="h-5 w-5 text-text" />
      <span className="text-[10px] font-mono text-text-secondary truncate w-full">{name}</span>
      {copied && <span className="text-[9px] text-success">Copied!</span>}
    </button>
  );
}

/** Full icon library — all lucide-react icons used in NOVA, grouped by category */
export const Default: Story = {
  render: () => {
    const [filter, setFilter] = useState("");

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-1">NOVA Icon Library</h2>
        <p className="text-sm text-text-secondary mb-4">
          All lucide-react icons used across the application. Click to copy the import name.
        </p>

        <input
          type="text"
          placeholder="Filter icons..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-sm h-9 px-3 mb-6 text-sm rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary field-glow"
        />

        <div className="space-y-8">
          {iconGroups.map((group) => {
            const filtered = filter
              ? group.icons.filter(
                  (i) =>
                    i.name.toLowerCase().includes(filter.toLowerCase()) ||
                    i.usage.toLowerCase().includes(filter.toLowerCase()),
                )
              : group.icons;

            if (filtered.length === 0) return null;

            return (
              <div key={group.label}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-3">
                  {group.label} ({filtered.length})
                </h3>
                <div className="grid grid-cols-6 gap-2">
                  {filtered.map((item) => (
                    <IconCard
                      key={item.name}
                      name={item.name}
                      Icon={item.icon}
                      usage={item.usage}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
};
