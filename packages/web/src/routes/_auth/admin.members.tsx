import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, MoreHorizontal, Mail, Shield, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { Avatar } from "../../components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_auth/admin/members")({
  component: MembersPage,
});

function MembersPage() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const { data: membersData } = useQuery({
    queryKey: ["org-members"],
    queryFn: () => api.get<any>("/api/org/members"),
  });

  const { data: invitationsData } = useQuery({
    queryKey: ["org-invitations"],
    queryFn: () => api.get<any>("/api/org/invitations"),
  });

  const invite = useMutation({
    mutationFn: (data: { email: string; role: string }) => api.post("/api/org/invitations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invitations"] });
      setShowInvite(false);
      setInviteEmail("");
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/api/org/members/${userId}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org-members"] }),
  });

  const members = (membersData as any)?.data ?? [];
  const invitations = (invitationsData as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text">Team Members ({members.length})</h2>
        <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </div>

      <div className="space-y-2">
        {members.map((member: any) => {
          const user = member.user ?? member;
          const profile = member.profile ?? member;
          const name = user.name ?? user.displayName ?? profile.displayName ?? "Unknown";
          const email = user.email ?? "";
          const role = profile.role ?? member.role ?? "member";
          const userId = user.id ?? profile.userId ?? member.id;
          return (
            <div key={userId} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
              <div className="flex items-center gap-3">
                <Avatar name={name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-text">{name}</p>
                  <p className="text-xs text-text-tertiary">{email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={role === "org-admin" ? "primary" : "default"}>
                  {role}
                </Badge>
                <select
                  value={role}
                  onChange={(e) => updateRole.mutate({ userId, role: e.target.value })}
                  className="text-xs bg-surface border border-border rounded px-2 py-1 text-text"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="power-user">Power User</option>
                  <option value="org-admin">Admin</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text mb-3">Pending Invitations</h3>
          <div className="space-y-2">
            {invitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-text-tertiary" />
                  <div>
                    <p className="text-sm text-text">{inv.email}</p>
                    <p className="text-xs text-text-tertiary">
                      Invited {formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <Badge variant="warning">{inv.role}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showInvite} onClose={() => setShowInvite(false)} title="Invite Team Member">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate({ email: inviteEmail, role: inviteRole });
          }}
          className="space-y-4"
        >
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            autoFocus
            required
          />
          <div>
            <label className="block text-sm font-medium text-text mb-1">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="power-user">Power User</option>
              <option value="org-admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={invite.isPending}>Send Invite</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
