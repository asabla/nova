import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  Users, BarChart3, Shield, Settings, Activity, Heart, Gauge, AlertTriangle,
  Database, CreditCard, Palette, Link2, FileSearch, UserCog,
  Search, MoreHorizontal, Plus, Check, X, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";

const meta: Meta = {
  title: "Layouts/AdminPanel",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Sidebar Nav ──────────────────────────────────────────────────────────

interface TabGroup {
  label: string;
  tabs: { icon: typeof Users; label: string; active?: boolean }[];
}

const tabGroups: TabGroup[] = [
  {
    label: "Overview",
    tabs: [
      { icon: Heart, label: "Health" },
      { icon: BarChart3, label: "Analytics" },
      { icon: FileSearch, label: "Audit Log" },
    ],
  },
  {
    label: "People",
    tabs: [
      { icon: Users, label: "Members", active: true },
      { icon: UserCog, label: "Groups" },
    ],
  },
  {
    label: "AI & Limits",
    tabs: [
      { icon: Activity, label: "Models" },
      { icon: AlertTriangle, label: "Content Safety" },
      { icon: Gauge, label: "Rate Limits" },
    ],
  },
  {
    label: "Security",
    tabs: [
      { icon: Shield, label: "Security" },
      { icon: Shield, label: "SSO" },
    ],
  },
  {
    label: "Organization",
    tabs: [
      { icon: Settings, label: "Settings" },
      { icon: Palette, label: "Branding" },
      { icon: CreditCard, label: "Billing" },
      { icon: Link2, label: "Integrations" },
      { icon: Database, label: "Data Retention" },
    ],
  },
];

function AdminNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  return (
    <nav className="w-52 shrink-0 space-y-4">
      {tabGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.label}
                  onClick={() => onTabChange(tab.label)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                    activeTab === tab.label
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-text-secondary hover:bg-surface-tertiary hover:text-text",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ── Mock Members Data ────────────────────────────────────────────────────

const members = [
  { id: "1", name: "Sarah Chen", email: "sarah@acme.com", role: "Admin", status: "active", lastSeen: "2 min ago" },
  { id: "2", name: "Marcus Rivera", email: "marcus@acme.com", role: "Member", status: "active", lastSeen: "1 hour ago" },
  { id: "3", name: "Emily Watson", email: "emily@acme.com", role: "Member", status: "active", lastSeen: "3 hours ago" },
  { id: "4", name: "James Park", email: "james@acme.com", role: "Admin", status: "active", lastSeen: "Yesterday" },
  { id: "5", name: "Priya Sharma", email: "priya@acme.com", role: "Member", status: "invited", lastSeen: "—" },
  { id: "6", name: "Alex Müller", email: "alex@acme.com", role: "Member", status: "disabled", lastSeen: "2 weeks ago" },
];

// ── Stories ───────────────────────────────────────────────────────────────

/** Full admin panel with sidebar navigation and member management */
export const MemberManagement: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState("Members");
    const [search, setSearch] = useState("");

    const filtered = search
      ? members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()) || m.email.includes(search.toLowerCase()))
      : members;

    return (
      <div className="max-w-5xl">
        <h1 className="text-xl font-bold text-text mb-6">Administration</h1>

        <div className="flex gap-8">
          <AdminNav activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-text">Members</h2>
                <p className="text-xs text-text-tertiary">{members.length} members in your organization</p>
              </div>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Invite Member
              </Button>
            </div>

            <div className="relative max-w-xs mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-3 text-xs rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary focus:outline-2 focus:outline-primary"
              />
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-tertiary/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">Member</th>
                    <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">Role</th>
                    <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-text-tertiary">Last Seen</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.name} size="sm" />
                          <div>
                            <p className="text-text font-medium">{m.name}</p>
                            <p className="text-text-tertiary">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={m.role === "Admin" ? "primary" : "default"}>{m.role}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={m.status === "active" ? "success" : m.status === "invited" ? "warning" : "danger"}>
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-text-tertiary">{m.lastSeen}</td>
                      <td className="px-2 py-2.5">
                        <button className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text transition-colors">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

/** Settings form with sections */
export const SettingsForm: Story = {
  render: () => {
    const [orgName, setOrgName] = useState("Acme Corp");

    return (
      <div className="max-w-5xl">
        <h1 className="text-xl font-bold text-text mb-6">Administration</h1>

        <div className="flex gap-8">
          <AdminNav activeTab="Settings" onTabChange={() => {}} />

          <div className="flex-1 min-w-0 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-text mb-1">Organization Settings</h2>
              <p className="text-xs text-text-tertiary">Manage your organization profile and preferences</p>
            </div>

            {/* General section */}
            <section className="rounded-xl border border-border bg-surface-secondary p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text">General</h3>
              <Input
                label="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <div>
                <Input
                  label="Slug"
                  value="acme-corp"
                  disabled
                />
                <p className="text-[10px] text-text-tertiary mt-1">Used in URLs — cannot be changed</p>
              </div>
              <Input
                label="Support Email"
                type="email"
                value="support@acme.com"
                readOnly
              />
            </section>

            {/* Features section */}
            <section className="rounded-xl border border-border bg-surface-secondary p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text">Features</h3>
              <div className="space-y-3">
                {[
                  { label: "Knowledge Base", description: "Allow members to upload and query documents", checked: true },
                  { label: "Agent Marketplace", description: "Enable access to shared agent directory", checked: true },
                  { label: "Voice Input", description: "Allow speech-to-text in conversations", checked: false },
                  { label: "File Attachments", description: "Allow file uploads in conversations", checked: true },
                ].map((feature) => (
                  <div key={feature.label} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm text-text">{feature.label}</p>
                      <p className="text-xs text-text-tertiary">{feature.description}</p>
                    </div>
                    <Switch checked={feature.checked} />
                  </div>
                ))}
              </div>
            </section>

            {/* Danger zone */}
            <section className="rounded-xl border border-danger/30 bg-danger/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-danger">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text">Delete Organization</p>
                  <p className="text-xs text-text-tertiary">Permanently delete this organization and all data</p>
                </div>
                <Button variant="danger" size="sm">Delete Organization</Button>
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost">Cancel</Button>
              <Button>Save Changes</Button>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

/** Security settings page */
export const SecuritySettings: Story = {
  render: () => (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-text mb-6">Administration</h1>

      <div className="flex gap-8">
        <AdminNav activeTab="Security" onTabChange={() => {}} />

        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-text mb-1">Security</h2>
            <p className="text-xs text-text-tertiary">Configure authentication and access policies</p>
          </div>

          <section className="rounded-xl border border-border bg-surface-secondary p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text">Authentication</h3>
            {[
              { label: "Require MFA", description: "All members must enable two-factor authentication", checked: true },
              { label: "Password Complexity", description: "Enforce minimum 12 characters with mixed case", checked: true },
              { label: "Session Timeout", description: "Auto-logout after 8 hours of inactivity", checked: false },
              { label: "IP Allowlist", description: "Restrict access to approved IP ranges", checked: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-text">{item.label}</p>
                  <p className="text-xs text-text-tertiary">{item.description}</p>
                </div>
                <Switch checked={item.checked} />
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-border bg-surface-secondary p-5">
            <h3 className="text-sm font-semibold text-text mb-3">Active Sessions</h3>
            <div className="space-y-2">
              {[
                { device: "Chrome on macOS", ip: "192.168.1.42", current: true },
                { device: "Safari on iPhone", ip: "10.0.0.15", current: false },
                { device: "Firefox on Linux", ip: "172.16.0.8", current: false },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface">
                  <div>
                    <p className="text-xs text-text font-medium">{s.device}</p>
                    <p className="text-[10px] text-text-tertiary">{s.ip}</p>
                  </div>
                  {s.current ? (
                    <Badge variant="success">Current</Badge>
                  ) : (
                    <Button variant="ghost" size="sm">Revoke</Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  ),
};
