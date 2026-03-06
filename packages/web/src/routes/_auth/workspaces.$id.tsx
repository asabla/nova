import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FolderOpen,
  MessageSquare,
  FileText,
  Users,
  Settings2,
  Activity,
  Plus,
  Upload,
  UserPlus,
  Archive,
  Trash2,
  Save,
  MoreVertical,
  Search,
  Clock,
  Bot,
  Shield,
  Mail,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";
import { api } from "../../lib/api";

export const Route = createFileRoute("/_auth/workspaces/$id")({
  component: WorkspaceDetailPage,
});

type TabId = "conversations" | "files" | "members" | "settings" | "activity";

function WorkspaceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("conversations");

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspaces", id],
    queryFn: () => api.get<any>(`/api/workspaces/${id}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-text-secondary">Loading workspace...</div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Workspace not found</div>
      </div>
    );
  }

  const tabs = [
    { id: "conversations" as const, label: "Conversations", icon: MessageSquare },
    { id: "files" as const, label: "Files", icon: FileText },
    { id: "members" as const, label: "Members", icon: Users },
    { id: "settings" as const, label: "Settings", icon: Settings2 },
    { id: "activity" as const, label: "Activity", icon: Activity },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/workspaces" })}
            className="p-1 hover:bg-surface-secondary rounded"
          >
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text">{workspace.name}</h1>
            {workspace.description && (
              <p className="text-sm text-text-secondary">{workspace.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workspace.archived && <Badge variant="warning">Archived</Badge>}
          <Badge variant="default">{workspace.memberCount ?? 0} members</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-text-secondary hover:text-text hover:bg-surface-secondary"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "conversations" && <ConversationsTab workspaceId={id} />}
        {activeTab === "files" && <FilesTab workspaceId={id} />}
        {activeTab === "members" && <MembersTab workspaceId={id} />}
        {activeTab === "settings" && <SettingsTab workspaceId={id} workspace={workspace} />}
        {activeTab === "activity" && <ActivityTab workspaceId={id} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Conversations Tab                                                          */
/* -------------------------------------------------------------------------- */

function ConversationsTab({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["workspaces", workspaceId, "conversations"],
    queryFn: () => api.get<any[]>(`/api/workspaces/${workspaceId}/conversations`),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<any>(`/api/workspaces/${workspaceId}/conversations`, {
        title: "New Conversation",
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "conversations"] });
      toast.success("Conversation created");
      navigate({ to: "/chat/$id", params: { id: data.id } });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to create conversation"),
  });

  const filtered = (conversations ?? []).filter((c: any) =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-surface text-text text-sm placeholder:text-text-tertiary"
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => createMutation.mutate()}
          loading={createMutation.isPending}
        >
          <Plus className="h-3.5 w-3.5" /> New Conversation
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-secondary animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
          <h3 className="text-lg font-medium text-text mb-1">No conversations yet</h3>
          <p className="text-sm text-text-secondary mb-4">
            Start a conversation scoped to this workspace.
          </p>
          <Button variant="primary" size="sm" onClick={() => createMutation.mutate()}>
            <Plus className="h-3.5 w-3.5" /> New Conversation
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((conversation: any) => (
            <button
              key={conversation.id}
              onClick={() => navigate({ to: "/chat/$id", params: { id: conversation.id } })}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:bg-surface-secondary transition-colors text-left"
            >
              <MessageSquare className="h-5 w-5 text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">
                  {conversation.title ?? "Untitled"}
                </p>
                <p className="text-xs text-text-tertiary">
                  {conversation.messageCount ?? 0} messages
                  {conversation.updatedAt && (
                    <> &middot; {new Date(conversation.updatedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              {conversation.agentName && (
                <Badge variant="primary">{conversation.agentName}</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Files Tab                                                                  */
/* -------------------------------------------------------------------------- */

function FilesTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ["workspaces", workspaceId, "files"],
    queryFn: () => api.get<any[]>(`/api/workspaces/${workspaceId}/files`),
  });

  const uploadMutation = useMutation({
    mutationFn: async (fileList: FileList) => {
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));

      const BASE_URL = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${BASE_URL}/api/workspaces/${workspaceId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ title: "Upload failed" }));
        throw new Error(err.title ?? "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "files"] });
      toast.success("Files uploaded");
    },
    onError: (err: any) => toast.error(err.message ?? "Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) =>
      api.delete(`/api/workspaces/${workspaceId}/files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "files"] });
      toast.success("File deleted");
    },
    onError: (err: any) => toast.error(err.message ?? "Delete failed"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMutation.mutate(e.target.files);
      e.target.value = "";
    }
  };

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">
          {(files ?? []).length} file{(files ?? []).length !== 1 ? "s" : ""}
        </h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadMutation.isPending}
          >
            <Upload className="h-3.5 w-3.5" /> Upload Files
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-secondary animate-pulse" />
          ))}
        </div>
      ) : (files ?? []).length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
          <h3 className="text-lg font-medium text-text mb-1">No files uploaded</h3>
          <p className="text-sm text-text-secondary mb-4">
            Upload files to share with workspace members and conversations.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> Upload Files
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {(files ?? []).map((file: any) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface"
            >
              <FileText className="h-5 w-5 text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{file.name}</p>
                <p className="text-xs text-text-tertiary">
                  {file.size != null && formatFileSize(file.size)}
                  {file.uploadedAt && (
                    <> &middot; {new Date(file.uploadedAt).toLocaleDateString()}</>
                  )}
                  {file.uploadedBy && <> &middot; {file.uploadedBy}</>}
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm("Delete this file?")) deleteMutation.mutate(file.id);
                }}
                className="p-1.5 rounded hover:bg-surface-secondary text-text-tertiary hover:text-danger transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Members Tab                                                                */
/* -------------------------------------------------------------------------- */

function MembersTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: members, isLoading } = useQuery({
    queryKey: ["workspaces", workspaceId, "members"],
    queryFn: () => api.get<any[]>(`/api/workspaces/${workspaceId}/members`),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      api.post(`/api/workspaces/${workspaceId}/members/invite`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] });
      toast.success("Invitation sent");
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to send invite"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.patch(`/api/workspaces/${workspaceId}/members/${memberId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] });
      toast.success("Role updated");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update role"),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/api/workspaces/${workspaceId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] });
      toast.success("Member removed");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to remove member"),
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner": return "Owner";
      case "admin": return "Admin";
      case "member": return "Member";
      case "viewer": return "Viewer";
      default: return role;
    }
  };

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner": return "warning" as const;
      case "admin": return "primary" as const;
      default: return "default" as const;
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">
          {(members ?? []).length} member{(members ?? []).length !== 1 ? "s" : ""}
        </h3>
        <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="h-3.5 w-3.5" /> Invite Member
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-secondary animate-pulse" />
          ))}
        </div>
      ) : (members ?? []).length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
          <h3 className="text-lg font-medium text-text mb-1">No members</h3>
          <p className="text-sm text-text-secondary mb-4">
            Invite team members to collaborate in this workspace.
          </p>
          <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Invite Member
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {(members ?? []).map((member: any) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium text-primary">
                  {(member.name ?? member.email ?? "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">
                  {member.name ?? member.email}
                </p>
                {member.name && member.email && (
                  <p className="text-xs text-text-tertiary truncate">{member.email}</p>
                )}
              </div>
              <Badge variant={roleBadgeVariant(member.role)}>
                {roleLabel(member.role)}
              </Badge>
              {member.role !== "owner" && (
                <div className="flex items-center gap-1">
                  <select
                    value={member.role}
                    onChange={(e) =>
                      updateRoleMutation.mutate({ memberId: member.id, role: e.target.value })
                    }
                    className="h-8 px-2 rounded border border-border bg-surface text-text text-xs"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${member.name ?? member.email}?`))
                        removeMutation.mutate(member.id);
                    }}
                    className="p-1.5 rounded hover:bg-surface-secondary text-text-tertiary hover:text-danger transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onClose={() => setShowInvite(false)} title="Invite Member">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inviteEmail.trim()) {
              inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
            }
          }}
          className="space-y-4"
        >
          <Input
            label="Email address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={inviteMutation.isPending}>
              <Mail className="h-4 w-4" /> Send Invite
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Settings Tab                                                               */
/* -------------------------------------------------------------------------- */

function SettingsTab({ workspaceId, workspace }: { workspaceId: string; workspace: any }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: workspace.name ?? "",
    description: workspace.description ?? "",
    defaultAgentId: workspace.defaultAgentId ?? "",
    defaultModel: workspace.defaultModel ?? "",
    defaultSystemPrompt: workspace.defaultSystemPrompt ?? "",
  });

  useEffect(() => {
    setForm({
      name: workspace.name ?? "",
      description: workspace.description ?? "",
      defaultAgentId: workspace.defaultAgentId ?? "",
      defaultModel: workspace.defaultModel ?? "",
      defaultSystemPrompt: workspace.defaultSystemPrompt ?? "",
    });
  }, [workspace]);

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<any[]>("/api/agents"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => api.patch(`/api/workspaces/${workspaceId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace updated");
    },
    onError: (err: any) => toast.error(err.message ?? "Update failed"),
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/api/workspaces/${workspaceId}`, { archived: !workspace.archived }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(workspace.archived ? "Workspace restored" : "Workspace archived");
    },
    onError: (err: any) => toast.error(err.message ?? "Action failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/workspaces/${workspaceId}`),
    onSuccess: () => {
      toast.success("Workspace deleted");
      navigate({ to: "/workspaces" });
    },
    onError: (err: any) => toast.error(err.message ?? "Delete failed"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      {/* General Settings */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wider">General</h3>
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Workspace name"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this workspace for?"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm"
          />
        </div>
      </section>

      {/* Defaults */}
      <section className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
          Workspace Defaults
        </h3>
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Default Agent</label>
          <select
            value={form.defaultAgentId}
            onChange={(e) => setForm({ ...form, defaultAgentId: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-text text-sm"
          >
            <option value="">None (use global default)</option>
            {(agents ?? []).map((agent: any) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">Default Model</label>
          <select
            value={form.defaultModel}
            onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
            className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-text text-sm"
          >
            <option value="">None (use global default)</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
            <option value="claude-3-opus">Claude 3 Opus</option>
            <option value="llama-3.1-70b">Llama 3.1 70B</option>
            <option value="mixtral-8x7b">Mixtral 8x7B</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1.5">
            Default System Prompt
          </label>
          <textarea
            value={form.defaultSystemPrompt}
            onChange={(e) => setForm({ ...form, defaultSystemPrompt: e.target.value })}
            placeholder="Applied to all new conversations in this workspace..."
            rows={5}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm font-mono"
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => updateMutation.mutate(form)}
          loading={updateMutation.isPending}
        >
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Danger Zone */}
      <section className="space-y-4 pt-4 border-t border-danger/30">
        <h3 className="text-sm font-semibold text-danger uppercase tracking-wider">
          Danger Zone
        </h3>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface">
          <div>
            <p className="text-sm font-medium text-text">
              {workspace.archived ? "Restore workspace" : "Archive workspace"}
            </p>
            <p className="text-xs text-text-secondary">
              {workspace.archived
                ? "Restore this workspace to make it active again."
                : "Archived workspaces are read-only and hidden from default views."}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => archiveMutation.mutate()}
            loading={archiveMutation.isPending}
          >
            <Archive className="h-3.5 w-3.5" />
            {workspace.archived ? "Restore" : "Archive"}
          </Button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-danger/30 bg-danger/5">
          <div>
            <p className="text-sm font-medium text-text">Delete workspace</p>
            <p className="text-xs text-text-secondary">
              Permanently delete this workspace and all its data. This cannot be undone.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (
                confirm(
                  "Are you sure you want to permanently delete this workspace? This action cannot be undone.",
                )
              ) {
                deleteMutation.mutate();
              }
            }}
            loading={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </section>

      {/* Meta info */}
      <div className="pt-4 border-t border-border text-xs text-text-tertiary space-y-1">
        <p>Created: {new Date(workspace.createdAt).toLocaleDateString()}</p>
        <p>Updated: {new Date(workspace.updatedAt).toLocaleDateString()}</p>
        <p>ID: {workspace.id}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Activity Tab                                                               */
/* -------------------------------------------------------------------------- */

function ActivityTab({ workspaceId }: { workspaceId: string }) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["workspaces", workspaceId, "activity"],
    queryFn: () => api.get<any[]>(`/api/workspaces/${workspaceId}/activity`),
  });

  const activityIcon = (type: string) => {
    switch (type) {
      case "conversation_created":
      case "conversation_updated":
        return MessageSquare;
      case "file_uploaded":
      case "file_deleted":
        return FileText;
      case "member_joined":
      case "member_invited":
      case "member_removed":
        return Users;
      case "settings_updated":
        return Settings2;
      case "workspace_archived":
      case "workspace_restored":
        return Archive;
      default:
        return Activity;
    }
  };

  const activityLabel = (entry: any) => {
    const actor = entry.actorName ?? "Someone";
    switch (entry.type) {
      case "conversation_created":
        return `${actor} created a conversation`;
      case "conversation_updated":
        return `${actor} updated a conversation`;
      case "file_uploaded":
        return `${actor} uploaded ${entry.targetName ?? "a file"}`;
      case "file_deleted":
        return `${actor} deleted ${entry.targetName ?? "a file"}`;
      case "member_joined":
        return `${entry.targetName ?? actor} joined the workspace`;
      case "member_invited":
        return `${actor} invited ${entry.targetName ?? "a member"}`;
      case "member_removed":
        return `${actor} removed ${entry.targetName ?? "a member"}`;
      case "settings_updated":
        return `${actor} updated workspace settings`;
      case "workspace_archived":
        return `${actor} archived the workspace`;
      case "workspace_restored":
        return `${actor} restored the workspace`;
      default:
        return `${actor} performed an action`;
    }
  };

  return (
    <div className="max-w-3xl">
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-surface-secondary animate-pulse" />
          ))}
        </div>
      ) : (activities ?? []).length === 0 ? (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
          <h3 className="text-lg font-medium text-text mb-1">No activity yet</h3>
          <p className="text-sm text-text-secondary">
            Recent workspace activity will appear here.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {(activities ?? []).map((entry: any, index: number) => {
              const Icon = activityIcon(entry.type);
              return (
                <div key={entry.id ?? index} className="flex items-start gap-3 relative">
                  <div className="h-10 w-10 rounded-full bg-surface border-2 border-border flex items-center justify-center shrink-0 z-10">
                    <Icon className="h-4 w-4 text-text-tertiary" />
                  </div>
                  <div className="flex-1 pt-1.5">
                    <p className="text-sm text-text">{activityLabel(entry)}</p>
                    <p className="text-xs text-text-tertiary flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {entry.createdAt
                        ? formatRelativeTime(new Date(entry.createdAt))
                        : "Unknown time"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
