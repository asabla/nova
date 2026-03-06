import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Settings2, Trash2, UserPlus, Crown } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/groups")({
  component: AdminGroupsPage,
});

function AdminGroupsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: "", description: "", monthlyTokenLimit: 0, monthlyCostLimitCents: 0 });

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.get<any>("/api/groups"),
  });

  const { data: groupDetail } = useQuery({
    queryKey: ["groups", selectedGroup],
    queryFn: () => api.get<any>(`/api/groups/${selectedGroup}`),
    enabled: !!selectedGroup,
  });

  const { data: membersData } = useQuery({
    queryKey: ["groups", selectedGroup, "members"],
    queryFn: () => api.get<any>(`/api/groups/${selectedGroup}/members`),
    enabled: !!selectedGroup,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newGroup) => api.post("/api/groups", data),
    onSuccess: () => {
      toast.success("Group created");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setShowCreate(false);
      setNewGroup({ name: "", description: "", monthlyTokenLimit: 0, monthlyCostLimitCents: 0 });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to create group"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/groups/${id}`),
    onSuccess: () => {
      toast.success("Group deleted");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSelectedGroup(null);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      api.delete(`/api/groups/${groupId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", selectedGroup, "members"] });
      toast.success("Member removed");
    },
  });

  const groups = (groupsData as any)?.data ?? [];
  const members = (membersData as any)?.data ?? [];
  const detail = groupDetail as any;

  return (
    <div className="flex gap-6 h-full">
      {/* Groups list */}
      <div className="w-80 flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-text">Groups ({groups.length})</h2>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> New Group
          </Button>
        </div>

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
                <Users className="h-4 w-4 text-text-secondary" />
                <span className="text-sm font-medium text-text">{group.name}</span>
              </div>
              {group.description && (
                <p className="text-xs text-text-tertiary mt-1 line-clamp-1">{group.description}</p>
              )}
            </button>
          ))}

          {groups.length === 0 && (
            <div className="text-center py-8 text-sm text-text-tertiary">
              No groups yet. Create one to organize users.
            </div>
          )}
        </div>
      </div>

      {/* Group detail */}
      <div className="flex-1 min-w-0">
        {selectedGroup && detail ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text">{detail.name}</h2>
                {detail.description && <p className="text-sm text-text-secondary">{detail.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => {
                    if (confirm("Delete this group?")) deleteMutation.mutate(selectedGroup);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                <p className="text-xs text-text-tertiary">Members</p>
                <p className="text-lg font-semibold text-text">{detail.memberCount ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                <p className="text-xs text-text-tertiary">Token Limit</p>
                <p className="text-lg font-semibold text-text">
                  {detail.monthlyTokenLimit ? `${(detail.monthlyTokenLimit / 1_000_000).toFixed(1)}M` : "Unlimited"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-secondary border border-border">
                <p className="text-xs text-text-tertiary">Cost Limit</p>
                <p className="text-lg font-semibold text-text">
                  {detail.monthlyCostLimitCents ? `$${(detail.monthlyCostLimitCents / 100).toFixed(2)}` : "Unlimited"}
                </p>
              </div>
            </div>

            {/* Members */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-text">Members</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddMember(true)}>
                  <UserPlus className="h-3.5 w-3.5" /> Add Member
                </Button>
              </div>
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
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-sm text-text-tertiary text-center py-4">No members in this group yet.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a group to manage</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Create Group">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(newGroup);
          }}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            required
            autoFocus
          />
          <Input
            label="Description"
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monthly Token Limit"
              type="number"
              value={newGroup.monthlyTokenLimit || ""}
              onChange={(e) => setNewGroup({ ...newGroup, monthlyTokenLimit: Number(e.target.value) })}
              placeholder="0 = unlimited"
            />
            <Input
              label="Monthly Cost Limit (cents)"
              type="number"
              value={newGroup.monthlyCostLimitCents || ""}
              onChange={(e) => setNewGroup({ ...newGroup, monthlyCostLimitCents: Number(e.target.value) })}
              placeholder="0 = unlimited"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={createMutation.isPending}>Create Group</Button>
          </div>
        </form>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Member to Group">
        <AddMemberForm
          groupId={selectedGroup!}
          onDone={() => {
            setShowAddMember(false);
            queryClient.invalidateQueries({ queryKey: ["groups", selectedGroup, "members"] });
          }}
        />
      </Dialog>
    </div>
  );
}

function AddMemberForm({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const { data: searchResults } = useQuery({
    queryKey: ["org-members-search", search],
    queryFn: () => api.get<any>(`/api/org/members?search=${search}`),
    enabled: search.length >= 2,
  });

  const addMember = useMutation({
    mutationFn: (userId: string) => api.post(`/api/groups/${groupId}/members`, { userId }),
    onSuccess: () => {
      toast.success("Member added");
      onDone();
    },
    onError: (err: any) => toast.error(err.message ?? "Failed"),
  });

  const results = (searchResults as any)?.data ?? [];

  return (
    <div className="space-y-4">
      <Input
        label="Search members"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type a name or email..."
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
            <Plus className="h-4 w-4 text-text-tertiary" />
          </button>
        ))}
      </div>
    </div>
  );
}
