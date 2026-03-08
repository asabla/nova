import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Pencil, Trash2, Download, ArrowUpDown } from "lucide-react";

/** Data table with sortable columns, selection, and pagination. */
const meta: Meta<typeof Table> = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Table>;

const simpleData = [
  { id: 1, name: "Claude 4 Opus", provider: "Anthropic", context: "200K" },
  { id: 2, name: "Claude 4 Sonnet", provider: "Anthropic", context: "200K" },
  { id: 3, name: "GPT-4o", provider: "OpenAI", context: "128K" },
  { id: 4, name: "Gemini 2.0", provider: "Google", context: "1M" },
];

export const Simple: Story = {
  render: () => (
    <div className="w-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Context</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {simpleData.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-text-secondary">{row.provider}</TableCell>
              <TableCell className="text-text-secondary">{row.context}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

export const WithActions: Story = {
  render: () => (
    <div className="w-[600px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { name: "Sarah Chen", email: "sarah@nova.ai", role: "Admin", status: "Active" },
            { name: "Alex Rivera", email: "alex@nova.ai", role: "Editor", status: "Active" },
            { name: "Mika Tanaka", email: "mika@nova.ai", role: "Viewer", status: "Invited" },
          ].map((user) => (
            <TableRow key={user.email}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} size="sm" />
                  <div>
                    <p className="font-medium text-text">{user.name}</p>
                    <p className="text-xs text-text-tertiary">{user.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={user.role === "Admin" ? "primary" : "default"}>
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.status === "Active" ? "success" : "warning"}>
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button className="p-1.5 rounded-md text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

export const AuditLog: Story = {
  render: () => (
    <div className="w-[720px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead className="text-right">
              <button className="inline-flex items-center gap-1 hover:text-text transition-colors">
                <Download className="h-3 w-3" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { time: "2026-03-08 14:32", user: "Sarah Chen", action: "create", resource: "Agent: Research Analyst", detail: "agent" },
            { time: "2026-03-08 14:28", user: "Alex Rivera", action: "update", resource: "Model: Claude 4 Opus", detail: "model" },
            { time: "2026-03-08 14:15", user: "Sarah Chen", action: "delete", resource: "Conversation #1842", detail: "conversation" },
            { time: "2026-03-08 13:50", user: "System", action: "auth", resource: "Login from 192.168.1.42", detail: "auth" },
            { time: "2026-03-08 13:30", user: "Mika Tanaka", action: "create", resource: "Knowledge: API Docs", detail: "knowledge" },
          ].map((entry, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs text-text-tertiary whitespace-nowrap">
                {entry.time}
              </TableCell>
              <TableCell className="font-medium">{entry.user}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    entry.action === "create" ? "success"
                    : entry.action === "delete" ? "danger"
                    : entry.action === "auth" ? "warning"
                    : "primary"
                  }
                >
                  {entry.action}
                </Badge>
              </TableCell>
              <TableCell className="text-text-secondary">{entry.resource}</TableCell>
              <TableCell />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

export const SortableHeaders: Story = {
  render: () => (
    <div className="w-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            {["Name", "Conversations", "Tokens", "Last Active"].map((col) => (
              <TableHead key={col}>
                <button className="inline-flex items-center gap-1 hover:text-text transition-colors group">
                  {col}
                  <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { name: "Research Analyst", convos: "1,240", tokens: "4.2M", lastActive: "2 min ago" },
            { name: "Code Assistant", convos: "890", tokens: "2.8M", lastActive: "15 min ago" },
            { name: "Writing Helper", convos: "456", tokens: "1.1M", lastActive: "1 hour ago" },
          ].map((row) => (
            <TableRow key={row.name}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-text-secondary tabular-nums">{row.convos}</TableCell>
              <TableCell className="text-text-secondary tabular-nums">{row.tokens}</TableCell>
              <TableCell className="text-text-tertiary">{row.lastActive}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

/** Showcases all table patterns */
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Simple Data Table</p>
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: "Claude 4 Opus", provider: "Anthropic", context: "200K", active: true },
                { name: "Claude 4 Sonnet", provider: "Anthropic", context: "200K", active: true },
                { name: "GPT-4o", provider: "OpenAI", context: "128K", active: false },
                { name: "Gemini 2.0", provider: "Google", context: "1M", active: true },
              ].map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-text-secondary">{row.provider}</TableCell>
                  <TableCell className="text-text-secondary tabular-nums">{row.context}</TableCell>
                  <TableCell>
                    <Badge variant={row.active ? "success" : "default"}>
                      {row.active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">With User Avatars & Actions</p>
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: "Sarah Chen", email: "sarah@nova.ai", role: "Admin" },
                { name: "Alex Rivera", email: "alex@nova.ai", role: "Editor" },
              ].map((user) => (
                <TableRow key={user.email}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size="sm" />
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-text-tertiary">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "Admin" ? "primary" : "default"}>{user.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">Compact Audit Log</p>
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { time: "14:32", action: "create", resource: "Agent created" },
                { time: "14:28", action: "update", resource: "Model updated" },
                { time: "14:15", action: "delete", resource: "Conversation removed" },
              ].map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs text-text-tertiary">{e.time}</TableCell>
                  <TableCell>
                    <Badge variant={e.action === "create" ? "success" : e.action === "delete" ? "danger" : "primary"}>
                      {e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary">{e.resource}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  ),
  parameters: { layout: "padded" },
};
