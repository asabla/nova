import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Users, Plus, Settings2, Trash2, UserPlus, Crown } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

interface Group {
  id: string;
  name: string;
  description?: string;
  monthlyTokenLimit?: number;
  monthlyCostLimitCents?: number;
  memberCount?: number;
}

interface GroupMember {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
}

interface OrgMember {
  id: string;
  name: string;
  email: string;
}

export const Route = createFileRoute("/_auth/admin/groups")({
  component: AdminGroupsPage,
});

function AdminGroupsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", monthlyTokenLimit: 0, monthlyCostLimitCents: 0 });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<{ data: Group[] }>("/api/groups"),
  });

  const { data: groupDetail } = useQuery({
    queryKey: ["groups", selectedGroup],
    queryFn: () => api.get<Group>(`/api/groups/${selectedGroup}`),
    enabled: !!selectedGroup,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["groups", selectedGroup, "members"],
    queryFn: () => api.get<{ data: GroupMember[] }>(`/api/groups/${selectedGroup}/members`),
    enabled: !!selectedGroup,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newGroup) => api.post("/api/groups", data),
    onSuccess: () => {
      toast(t("admin.groupCreated", { defaultValue: "Group created" }), "success");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setShowCreate(false);
      setNewGroup({ name: "", description: "", monthlyTokenLimit: 0, monthlyCostLimitCents: 0 });
    },
    onError: (err: any) => toast(err.message ?? t("admin.groupCreateFailed", { defaultValue: "Failed to create group" }), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/groups/${id}`),
    onSuccess: () => {
      toast(t("admin.groupDeleted", { defaultValue: "Group deleted" }), "success");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSelectedGroup(null);
    },
    onError: (err: any) => toast(err.message ?? t("admin.groupDeleteFailed", { defaultValue: "Failed to delete group" }), "error"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      api.delete(`/api/groups/${groupId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", selectedGroup, "members"] });
      toast(t("admin.memberRemoved", { defaultValue: "Member removed" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.memberRemoveFailed", { defaultValue: "Failed to remove member" }), "error"),
  });

  const groups = groupsData?.data ?? [];
  const members = membersData?.data ?? [];
  const detail = groupDetail;

  return (
    <div className="flex gap-6 h-full">
      {/* Groups list */}
      <div className="w-80 flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">{t("admin.groups", { defaultValue: "Groups" })} ({groups.length})</h2>
            <p className="text-sm text-text-secondary mt-1">{t("admin.groupsDescription", { defaultValue: "Organize users into groups with shared limits." })}</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.newGroup", { defaultValue: "New Group" })}
          </Button>
        </div>

        {groupsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group: any) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedGroup === group.id
                    ? "bg-primary/10 border-primary/30"
                    : "bg-surface-secondary border-border hover:bg-surface-secondary/80"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                  <span className="text-sm font-medium text-text">{group.name}</span>
                </div>
                {group.description && (
                  <p className="text-xs text-text-tertiary mt-1 line-clamp-1">{group.description}</p>
                )}
              </button>
            ))}

            {groups.length === 0 && (
              <div className="text-center py-8 text-sm text-text-tertiary">
                {t("admin.noGroups", { defaultValue: "No groups yet. Create one to organize users." })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Group detail */}
      <div className="flex-1 min-w-0">
        {selectedGroup && detail ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text">{detail.name}</h2>
                {detail.description && <p className="text-sm text-text-secondary mt-1">{detail.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => setDeleteTarget(selectedGroup)}
                  aria-label={t("admin.deleteGroup", { defaultValue: "Delete group" })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.delete", { defaultValue: "Delete" })}
                </Button>
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                <p className="text-xs text-text-tertiary">{t("admin.membersCount", { defaultValue: "Members" })}</p>
                <p className="text-lg font-semibold text-text">{detail.memberCount ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                <p className="text-xs text-text-tertiary">{t("admin.tokenLimit", { defaultValue: "Token Limit" })}</p>
                <p className="text-lg font-semibold text-text">
                  {detail.monthlyTokenLimit ? `${(detail.monthlyTokenLimit / 1_000_000).toFixed(1)}M` : t("admin.unlimited", { defaultValue: "Unlimited" })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                <p className="text-xs text-text-tertiary">{t("admin.costLimit", { defaultValue: "Cost Limit" })}</p>
                <p className="text-lg font-semibold text-text">
                  {detail.monthlyCostLimitCents ? `$${(detail.monthlyCostLimitCents / 100).toFixed(2)}` : t("admin.unlimited", { defaultValue: "Unlimited" })}
                </p>
              </div>
            </div>

            {/* Members */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-text">{t("admin.membersCount", { defaultValue: "Members" })}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddMember(true)}>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {t("admin.addMember", { defaultValue: "Add Member" })}
                </Button>
              </div>
              {membersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
                      <div>
                        <p className="text-sm font-medium text-text">{member.userName}</p>
                        <p className="text-xs text-text-tertiary">{member.userEmail}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => removeMemberMutation.mutate({ groupId: selectedGroup, userId: member.userId })}
                        aria-label={t("admin.removeMember", { defaultValue: "Remove member {{name}}", name: member.userName })}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-sm text-text-tertiary text-center py-4">{t("admin.noMembers", { defaultValue: "No members in this group yet." })}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p className="text-sm">{t("admin.selectGroup", { defaultValue: "Select a group to manage" })}</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title={t("admin.createGroup", { defaultValue: "Create Group" })}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(newGroup);
          }}
          className="space-y-4"
        >
          <Input
            label={t("admin.name", { defaultValue: "Name" })}
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            required
            autoFocus
          />
          <Input
            label={t("admin.description", { defaultValue: "Description" })}
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("admin.monthlyTokenLimit", { defaultValue: "Monthly Token Limit" })}
              type="number"
              value={newGroup.monthlyTokenLimit || ""}
              onChange={(e) => setNewGroup({ ...newGroup, monthlyTokenLimit: Number(e.target.value) })}
              placeholder="0 = unlimited"
            />
            <Input
              label={t("admin.monthlyCostLimit", { defaultValue: "Monthly Cost Limit (cents)" })}
              type="number"
              value={newGroup.monthlyCostLimitCents || ""}
              onChange={(e) => setNewGroup({ ...newGroup, monthlyCostLimitCents: Number(e.target.value) })}
              placeholder="0 = unlimited"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>{t("admin.cancel", { defaultValue: "Cancel" })}</Button>
            <Button type="submit" variant="primary" loading={createMutation.isPending}>{t("admin.createGroup", { defaultValue: "Create Group" })}</Button>
          </div>
        </form>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onClose={() => setShowAddMember(false)} title={t("admin.addMemberToGroup", { defaultValue: "Add Member to Group" })}>
        <AddMemberForm
          groupId={selectedGroup!}
          onDone={() => {
            setShowAddMember(false);
            queryClient.invalidateQueries({ queryKey: ["groups", selectedGroup, "members"] });
          }}
        />
      </Dialog>

      {/* Delete Group Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        title={t("admin.confirmDelete", { defaultValue: "Confirm Delete" })}
        description={t("admin.deleteGroupConfirm", { defaultValue: "Are you sure you want to delete this group? This action cannot be undone." })}
        confirmLabel={t("admin.delete", { defaultValue: "Delete" })}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

function AddMemberForm({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data: searchResults } = useQuery({
    queryKey: ["org-members-search", search],
    queryFn: () => api.get<{ data: OrgMember[] }>(`/api/org/members?search=${search}`),
    enabled: search.length >= 2,
  });

  const addMember = useMutation({
    mutationFn: (userId: string) => api.post(`/api/groups/${groupId}/members`, { userId }),
    onSuccess: () => {
      toast(t("admin.memberAdded", { defaultValue: "Member added" }), "success");
      onDone();
    },
    onError: (err: any) => toast(err.message ?? t("admin.memberAddFailed", { defaultValue: "Failed to add member" }), "error"),
  });

  const results = searchResults?.data ?? [];

  return (
    <div className="space-y-4">
      <Input
        label={t("admin.searchMembers", { defaultValue: "Search members" })}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("admin.searchPlaceholder", { defaultValue: "Type a name or email..." })}
        autoFocus
      />
      <div className="max-h-60 overflow-y-auto space-y-1">
        {results.map((u: any) => (
          <button
            key={u.id}
            onClick={() => addMember.mutate(u.id)}
            className="w-full text-left p-2 rounded-lg hover:bg-surface-secondary flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-text">{u.name}</p>
              <p className="text-xs text-text-tertiary">{u.email}</p>
            </div>
            <Plus className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
