import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  MessageSquare, Microscope, BookOpen, Compass, FolderKanban, HardDrive,
  Settings, HelpCircle, ChevronLeft, ChevronRight, Zap, Pin,
  Plus, Search, Bell, User, Moon, Sun, PanelLeftClose, PanelLeft,
  BarChart3, Users, Activity, Clock, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

const meta: Meta = {
  title: "Layouts/Dashboard",
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

// ── Shared Components ────────────────────────────────────────────────────

function NavLink({ icon: Icon, label, active, collapsed }: { icon: typeof MessageSquare; label: string; active?: boolean; collapsed?: boolean }) {
  return (
    <button
      className={clsx(
        "w-full flex items-center rounded-lg transition-all duration-150",
        collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-3 py-2 text-sm",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </button>
  );
}

const navItems = [
  { icon: MessageSquare, label: "Conversations" },
  { icon: Microscope, label: "Research" },
  { icon: BookOpen, label: "Knowledge" },
  { icon: Compass, label: "Explore" },
  { icon: FolderKanban, label: "Workspaces" },
  { icon: HardDrive, label: "Files" },
];

const recentConversations = [
  { id: "1", title: "RAG implementation guide", pinned: true },
  { id: "2", title: "Debug WebSocket issue", pinned: false },
  { id: "3", title: "API design review", pinned: false },
  { id: "4", title: "Migration plan v2→v3", pinned: false },
  { id: "5", title: "Performance optimization", pinned: false },
];

// ── Stat Card ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, trend, iconColor, iconBg }: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  trend?: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-surface-secondary border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className={clsx("h-9 w-9 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={clsx("h-4.5 w-4.5", iconColor)} />
        </div>
        {trend && (
          <span className="text-[10px] font-medium text-success flex items-center gap-0.5">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-text">{value}</p>
      <p className="text-xs text-text-tertiary mt-0.5">{label}</p>
    </div>
  );
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Full dashboard layout with sidebar, header, and content area */
export const Default: Story = {
  render: () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [activeNav, setActiveNav] = useState(0);

    return (
      <div className="flex h-[680px] bg-surface">
        {/* Sidebar */}
        <aside
          className={clsx(
            "flex flex-col bg-surface-secondary border-r border-border transition-all duration-200",
            sidebarOpen ? "w-[260px]" : "w-14",
          )}
        >
          {/* Brand */}
          <div className={clsx(
            "flex items-center border-b border-border",
            sidebarOpen ? "justify-between px-4 py-3.5" : "justify-center py-3.5",
          )}>
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              {sidebarOpen && <span className="font-bold text-sm tracking-tight text-text">NOVA</span>}
            </div>
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-text-tertiary hover:text-text p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className={clsx("pt-3 pb-2 space-y-0.5", sidebarOpen ? "px-2" : "px-1.5")}>
            {navItems.map((item, i) => (
              <div key={item.label} onClick={() => setActiveNav(i)}>
                <NavLink icon={item.icon} label={item.label} active={i === activeNav} collapsed={!sidebarOpen} />
              </div>
            ))}
          </nav>

          {sidebarOpen && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

              {/* Recent conversations */}
              <div className="flex-1 overflow-y-auto px-2 py-2">
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                  Recent
                </p>
                {recentConversations.map((c) => (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-xs text-text-secondary hover:bg-surface-tertiary hover:text-text transition-colors"
                  >
                    {c.pinned && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!sidebarOpen && <div className="flex-1" />}

          {/* Bottom */}
          <div className={clsx("border-t border-border py-2 space-y-0.5", sidebarOpen ? "px-2" : "px-1.5")}>
            <NavLink icon={Settings} label="Settings" collapsed={!sidebarOpen} />
            <NavLink icon={HelpCircle} label="Help" collapsed={!sidebarOpen} />
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-text-tertiary hover:text-text p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              )}
              <h1 className="text-lg font-semibold text-text">Dashboard</h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative max-w-xs hidden md:block input-glow rounded-lg">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search... (⌘K)"
                  className="h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-surface-secondary text-text placeholder:text-text-tertiary w-52"
                  readOnly
                />
              </div>
              <button className="relative p-2 rounded-lg text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
              </button>
              <Avatar name="Sarah Chen" size="sm" />
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon={MessageSquare} label="Total Conversations" value="1,247" trend="+12%" iconColor="text-primary" iconBg="bg-primary/10" />
                <StatCard icon={Users} label="Active Users" value="38" trend="+5%" iconColor="text-success" iconBg="bg-success/10" />
                <StatCard icon={Activity} label="API Calls Today" value="8,432" iconColor="text-warning" iconBg="bg-warning/10" />
                <StatCard icon={Clock} label="Avg Response Time" value="1.2s" trend="-8%" iconColor="text-blue-500" iconBg="bg-blue-500/10" />
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 mb-6">
                <Button>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Conversation
                </Button>
                <Button variant="secondary">
                  <BookOpen className="h-4 w-4 mr-1.5" />
                  Upload Documents
                </Button>
              </div>

              {/* Activity Feed placeholder */}
              <div className="rounded-xl border border-border bg-surface-secondary p-4">
                <h3 className="text-sm font-semibold text-text mb-3">Recent Activity</h3>
                <div className="space-y-3">
                  {[
                    { text: "Sarah created a new conversation", time: "2 min ago" },
                    { text: "3 documents indexed in Product Docs", time: "15 min ago" },
                    { text: "Code Reviewer agent installed", time: "1 hour ago" },
                    { text: "Knowledge base 'Engineering Wiki' updated", time: "3 hours ago" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-text-secondary">{item.text}</span>
                      <span className="text-text-tertiary ml-auto shrink-0">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  },
};

/** Layout with collapsed sidebar */
export const CollapsedSidebar: Story = {
  render: () => (
    <div className="flex h-[500px] bg-surface">
      <aside className="w-14 flex flex-col items-center bg-surface-secondary border-r border-border py-3 gap-1">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        {navItems.map((item, i) => (
          <NavLink key={item.label} icon={item.icon} label={item.label} active={i === 0} collapsed />
        ))}
        <div className="flex-1" />
        <NavLink icon={Settings} label="Settings" collapsed />
      </aside>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text mb-1">Content Area</h2>
          <p className="text-sm text-text-tertiary">Full width with collapsed sidebar</p>
        </div>
      </div>
    </div>
  ),
};

/** Mobile-first responsive layout hint */
export const MobileView: Story = {
  render: () => (
    <div className="w-[375px] h-[667px] bg-surface border border-border rounded-xl overflow-hidden mx-auto flex flex-col">
      {/* Mobile header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg text-text-tertiary hover:bg-surface-tertiary transition-colors">
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Zap className="h-3 w-3 text-primary" />
            </div>
            <span className="font-bold text-sm text-text">NOVA</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg text-text-tertiary">
            <Search className="h-4 w-4" />
          </button>
          <Avatar name="Sarah Chen" size="sm" />
        </div>
      </header>

      {/* Mobile content */}
      <main className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-semibold text-text mb-4">Dashboard</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-surface-secondary border border-border">
            <p className="text-lg font-bold text-text">1,247</p>
            <p className="text-[10px] text-text-tertiary">Conversations</p>
          </div>
          <div className="p-3 rounded-lg bg-surface-secondary border border-border">
            <p className="text-lg font-bold text-text">38</p>
            <p className="text-[10px] text-text-tertiary">Active Users</p>
          </div>
        </div>

        <Button className="w-full mb-4">
          <Plus className="h-4 w-4 mr-1.5" />
          New Conversation
        </Button>

        <h3 className="text-sm font-semibold text-text mb-2">Recent</h3>
        <div className="space-y-1">
          {recentConversations.slice(0, 4).map((c) => (
            <button
              key={c.id}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm text-text-secondary hover:bg-surface-tertiary transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="flex items-center justify-around px-2 py-2 border-t border-border bg-surface-secondary">
        {[MessageSquare, Microscope, Plus, BookOpen, Settings].map((Icon, i) => (
          <button
            key={i}
            className={clsx(
              "p-2.5 rounded-lg transition-colors",
              i === 0 ? "text-primary" : i === 2 ? "bg-primary text-white rounded-xl" : "text-text-tertiary",
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </nav>
    </div>
  ),
};
