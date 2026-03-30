import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import {
  Building2, Users, MessageSquare, Coins,
  ArrowUpDown, ArrowUp, ArrowDown,
  Pencil, Trash2, ToggleLeft,
  Search, CalendarDays, Download, Filter,
  ChevronLeft, ChevronRight, ChevronDown,
  Clock, Eye, UserPlus, Shield, AlertTriangle,
  Inbox, FolderOpen, Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";

const meta: Meta = {
  title: "Admin/DataPatterns",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Mock Data ────────────────────────────────────────────────────────────

const orgUsers = [
  { id: "1", name: "Sarah Chen", email: "sarah@acme.com", org: "Acme Corp", role: "Admin", status: "active" as const, lastActive: "2 min ago" },
  { id: "2", name: "Marcus Rivera", email: "marcus@acme.com", org: "Acme Corp", role: "Member", status: "active" as const, lastActive: "1 hour ago" },
  { id: "3", name: "Emily Watson", email: "emily@globex.io", org: "Globex", role: "Owner", status: "active" as const, lastActive: "3 hours ago" },
  { id: "4", name: "James Park", email: "james@initech.com", org: "Initech", role: "Member", status: "inactive" as const, lastActive: "2 weeks ago" },
  { id: "5", name: "Priya Sharma", email: "priya@acme.com", org: "Acme Corp", role: "Member", status: "pending" as const, lastActive: "—" },
  { id: "6", name: "Alex Muller", email: "alex@globex.io", org: "Globex", role: "Admin", status: "active" as const, lastActive: "Yesterday" },
  { id: "7", name: "Lena Kowalski", email: "lena@initech.com", org: "Initech", role: "Member", status: "inactive" as const, lastActive: "1 month ago" },
  { id: "8", name: "David Kim", email: "david@acme.com", org: "Acme Corp", role: "Member", status: "active" as const, lastActive: "5 min ago" },
];

const statusVariant = { active: "success", inactive: "danger", pending: "warning" } as const;

const auditEntries = [
  { id: "1", timestamp: "2026-03-30 14:23:01", action: "user.created", resource: "User: priya@acme.com", actor: "sarah@acme.com", details: "Invited via admin panel. Role: Member. Org: Acme Corp." },
  { id: "2", timestamp: "2026-03-30 13:45:22", action: "org.settings.updated", resource: "Org: Globex", actor: "emily@globex.io", details: "Changed MFA requirement from optional to required." },
  { id: "3", timestamp: "2026-03-30 12:10:05", action: "user.disabled", resource: "User: lena@initech.com", actor: "system", details: "Auto-disabled after 30 days of inactivity per data retention policy." },
  { id: "4", timestamp: "2026-03-30 11:02:44", action: "model.enabled", resource: "Model: claude-opus-4-20250514", actor: "sarah@acme.com", details: "Enabled for all orgs on the Enterprise plan." },
  { id: "5", timestamp: "2026-03-30 09:30:11", action: "org.created", resource: "Org: Nova Labs", actor: "admin@nova.ai", details: "New organization created. Plan: Pro. Seats: 25." },
];

const actionColors: Record<string, "primary" | "success" | "warning" | "danger" | "default"> = {
  "user.created": "success",
  "org.settings.updated": "primary",
  "user.disabled": "danger",
  "model.enabled": "success",
  "org.created": "primary",
};

// ── Stories ───────────────────────────────────────────────────────────────

/** Data table with sortable headers, row actions, status badges, selection, and pagination */
export const DataTableWithActions: Story = {
  render: () => {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sortCol, setSortCol] = useState<string>("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const allSelected = selected.size === orgUsers.length;
    const someSelected = selected.size > 0 && !allSelected;

    function toggleAll() {
      setSelected(allSelected ? new Set() : new Set(orgUsers.map((u) => u.id)));
    }

    function toggleOne(id: string) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }

    function handleSort(col: string) {
      if (sortCol === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(col);
        setSortDir("asc");
      }
    }

    function SortIcon({ col }: { col: string }) {
      if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
      return sortDir === "asc"
        ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
        : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
    }

    const sorted = [...orgUsers].sort((a, b) => {
      const key = sortCol as keyof typeof a;
      const cmp = String(a[key]).localeCompare(String(b[key]));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return (
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Users</h2>
          {selected.size > 0 && (
            <span className="text-xs text-text-tertiary">{selected.size} selected</span>
          )}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-surface-tertiary/50">
                <TableHead className="w-10 px-4 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="px-4 py-2.5">
                  <button onClick={() => handleSort("name")} className="flex items-center text-xs font-medium text-text-tertiary hover:text-text transition-colors">
                    Name <SortIcon col="name" />
                  </button>
                </TableHead>
                <TableHead className="px-4 py-2.5">
                  <button onClick={() => handleSort("org")} className="flex items-center text-xs font-medium text-text-tertiary hover:text-text transition-colors">
                    Organization <SortIcon col="org" />
                  </button>
                </TableHead>
                <TableHead className="px-4 py-2.5">
                  <button onClick={() => handleSort("role")} className="flex items-center text-xs font-medium text-text-tertiary hover:text-text transition-colors">
                    Role <SortIcon col="role" />
                  </button>
                </TableHead>
                <TableHead className="px-4 py-2.5">
                  <button onClick={() => handleSort("status")} className="flex items-center text-xs font-medium text-text-tertiary hover:text-text transition-colors">
                    Status <SortIcon col="status" />
                  </button>
                </TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Last Active</TableHead>
                <TableHead className="w-28 px-4 py-2.5 text-xs font-medium text-text-tertiary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {sorted.map((u) => (
                <TableRow key={u.id} className={clsx(selected.has(u.id) && "bg-primary/5")}>
                  <TableCell className="px-4 py-2.5">
                    <Checkbox checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} />
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div>
                      <p className="text-text font-medium">{u.name}</p>
                      <p className="text-text-tertiary">{u.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-text-secondary">{u.org}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Badge variant={u.role === "Owner" ? "primary" : u.role === "Admin" ? "warning" : "default"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Badge variant={statusVariant[u.status]}>{u.status}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-text-tertiary">{u.lastActive}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text transition-colors" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text transition-colors" title="Toggle status">
                        <ToggleLeft className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger transition-colors" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-tertiary/30">
            <p className="text-xs text-text-tertiary">Showing 1–20 of 143</p>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg border border-border bg-surface text-text-tertiary hover:text-text hover:border-border-strong transition-colors disabled:opacity-40" disabled>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={clsx(
                    "h-7 w-7 rounded-lg text-xs font-medium transition-colors",
                    n === 1 ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-surface-tertiary",
                  )}
                >
                  {n}
                </button>
              ))}
              <span className="text-xs text-text-tertiary px-1">...</span>
              <button className="h-7 w-7 rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-tertiary transition-colors">8</button>
              <button className="p-1.5 rounded-lg border border-border bg-surface text-text-tertiary hover:text-text hover:border-border-strong transition-colors">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

/** Metric stat cards for the admin dashboard overview */
export const StatCards: Story = {
  render: () => {
    const stats = [
      { icon: Building2, label: "Organizations", value: "48", subtitle: "+3 this month", color: "text-primary" },
      { icon: Users, label: "Users", value: "1,247", subtitle: "+89 this month", color: "text-success" },
      { icon: MessageSquare, label: "Messages", value: "324K", subtitle: "12.4K today", color: "text-warning" },
      { icon: Coins, label: "Tokens", value: "18.2M", subtitle: "$2,340 estimated", color: "text-danger" },
    ];

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-4">Dashboard</h2>
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-border bg-[var(--color-surface-raised,var(--color-surface-secondary))] p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">{stat.label}</span>
                  <div className={clsx("h-8 w-8 rounded-lg flex items-center justify-center bg-surface-tertiary", stat.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-text">{stat.value}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{stat.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
};

/** Filter bar with search, date range, dropdown, export button, and active filter badge */
export const FilterBar: Story = {
  render: () => {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [dateFrom, setDateFrom] = useState("2026-03-01");
    const [dateTo, setDateTo] = useState("2026-03-30");

    const activeFilters = [search, status, dateFrom, dateTo].filter(Boolean).length;

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-4">Users</h2>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary z-10" />
            <Input
              type="text"
              placeholder="Search users, orgs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-9 pr-3 text-xs"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary z-10 pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 pl-8 pr-2 text-xs rounded-lg border border-border bg-surface text-text hover:border-border-strong transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <span className="text-xs text-text-tertiary">to</span>
            <div className="relative">
              <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary z-10 pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 pl-8 pr-2 text-xs rounded-lg border border-border bg-surface text-text hover:border-border-strong transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Status dropdown */}
          <div className="w-36">
            <Select
              options={[
                { value: "", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "pending", label: "Pending" },
              ]}
              value={status}
              onChange={setStatus}
              placeholder="Status"
              size="sm"
            />
          </div>

          {/* Active filter count */}
          {activeFilters > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-text-tertiary" />
              <Badge variant="primary">{activeFilters} active</Badge>
            </div>
          )}

          {/* Spacer + Export */}
          <div className="ml-auto">
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
          </div>
        </div>
      </div>
    );
  },
};

/** Audit log with color-coded action badges and expandable detail rows */
export const AuditLogEntry: Story = {
  render: () => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    function toggle(id: string) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-4">Audit Log</h2>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-surface-tertiary/50">
                <TableHead className="w-8" />
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Timestamp</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Action</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Resource</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {auditEntries.map((entry) => {
                const isOpen = expanded.has(entry.id);
                return (
                  <>
                    <TableRow
                      key={entry.id}
                      className={clsx("cursor-pointer hover:bg-surface-tertiary/30 transition-colors", isOpen && "bg-surface-tertiary/20")}
                      onClick={() => toggle(entry.id)}
                    >
                      <TableCell className="px-3 py-2.5">
                        <ChevronDown
                          className={clsx(
                            "h-3.5 w-3.5 text-text-tertiary transition-transform duration-200",
                            isOpen && "rotate-180",
                          )}
                        />
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-text-tertiary">
                          <Clock className="h-3 w-3" />
                          <span className="font-mono">{entry.timestamp}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <Badge variant={actionColors[entry.action] ?? "default"}>
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-text-secondary">{entry.resource}</TableCell>
                      <TableCell className="px-4 py-2.5 text-text-tertiary">{entry.actor}</TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${entry.id}-details`}>
                        <TableCell className="px-4 py-3 bg-surface-tertiary/10" colSpan={5}>
                          <div className="pl-7">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1">Details</p>
                            <p className="text-xs text-text-secondary">{entry.details}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  },
};

/** Empty state for admin pages with icon, title, description, and action */
export const EmptyAdminState: Story = {
  render: () => (
    <div className="max-w-4xl space-y-8">
      {/* Primary empty state */}
      <div className="rounded-xl border border-border bg-[var(--color-surface-raised,var(--color-surface-secondary))]">
        <EmptyState
          icon={<Inbox className="h-7 w-7" />}
          title="No organizations yet"
          description="Organizations will appear here once they sign up or are created by an admin."
          action={
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Organization
            </Button>
          }
        />
      </div>

      {/* Secondary empty states */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-[var(--color-surface-raised,var(--color-surface-secondary))]">
          <EmptyState
            icon={<FolderOpen className="h-7 w-7" />}
            title="No audit logs"
            description="Activity logs will be recorded as users interact with the platform."
          />
        </div>
        <div className="rounded-xl border border-border bg-[var(--color-surface-raised,var(--color-surface-secondary))]">
          <EmptyState
            icon={<AlertTriangle className="h-7 w-7" />}
            title="No flagged content"
            description="Content flagged by safety filters will appear here for review."
            action={
              <Button variant="outline" size="sm">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Configure Filters
              </Button>
            }
          />
        </div>
      </div>
    </div>
  ),
};
