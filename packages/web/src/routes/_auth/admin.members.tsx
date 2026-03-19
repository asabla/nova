import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, MoreHorizontal, Mail, Shield, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Dialog } from "../../components/ui/Dialog";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Avatar } from "../../components/ui/Avatar";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

interface OrgMember {
  id: string;
  user?: { id: string; name?: string; displayName?: string; email: string };
  profile?: { userId: string; displayName?: string; role: string };
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export const Route = createFileRoute("/_auth/admin/members")({
  component: MembersPage,
});

function MembersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [elevateTarget, setElevateTarget] = useState<{ userId: string; name: string } | null>(null);

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["org-members"],
    queryFn: () => api.get<{ data: OrgMember[] }>("/api/org/members"),
    staleTime: 30_000,
  });

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ["org-invitations"],
    queryFn: () => api.get<{ data: Invitation[] }>("/api/org/invitations"),
    staleTime: 30_000,
  });

  const invite = useMutation({
    mutationFn: (data: { email: string; role: string }) => api.post("/api/org/invitations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invitations"] });
      setShowInvite(false);
      setInviteEmail("");
      toast(t("admin.inviteSent", { defaultValue: "Invitation sent" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.inviteFailed", { defaultValue: "Failed to send invitation" }), "error"),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/api/org/members/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
      toast(t("admin.roleUpdated", { defaultValue: "Role updated successfully" }), "success");
    },
    onError: (err: any) => toast(err.message ?? t("admin.roleUpdateFailed", { defaultValue: "Failed to update role" }), "error"),
  });

  const members = membersData?.data ?? [];
  const invitations = invitationsData?.data ?? [];

  const filteredMembers = members.filter((member: any) => {
    const user = member.user ?? member;
    const profile = member.profile ?? member;
    const name = (user.name ?? user.displayName ?? profile.displayName ?? "").toLowerCase();
    const email = (user.email ?? "").toLowerCase();
    const role = profile.role ?? member.role ?? "member";
    if (searchQuery && !name.includes(searchQuery.toLowerCase()) && !email.includes(searchQuery.toLowerCase())) return false;
    if (roleFilter && role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">{t("admin.teamMembers", { defaultValue: "Team Members" })} ({members.length})</h2>
          <p className="text-sm text-text-secondary mt-1">{t("admin.teamMembersDescription", { defaultValue: "Manage your organization's team members and roles." })}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("admin.invite", { defaultValue: "Invite" })}
        </Button>
      </div>

      {/* Search and filter */}
      <div className="flex items-center gap-3">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("admin.searchMembers", { defaultValue: "Search by name or email..." })}
          className="flex-1"
        />
        <Select
          value={roleFilter}
          onChange={(value) => setRoleFilter(value)}
          options={[
            { value: "", label: t("admin.allRoles", { defaultValue: "All Roles" }) },
            { value: "org-admin", label: t("admin.roleAdmin", { defaultValue: "Admin" }) },
            { value: "power-user", label: t("admin.rolePowerUser", { defaultValue: "Power User" }) },
            { value: "member", label: t("admin.roleMember", { defaultValue: "Member" }) },
            { value: "viewer", label: t("admin.roleViewer", { defaultValue: "Viewer" }) },
          ]}
          size="sm"
        />
      </div>

      {membersLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member: any) => {
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
                  <Select
                    value={role}
                    onChange={(newRole) => {
                      if (newRole === "org-admin" && role !== "org-admin") {
                        setElevateTarget({ userId, name });
                        return;
                      }
                      updateRole.mutate({ userId, role: newRole });
                    }}
                    options={[
                      { value: "viewer", label: t("admin.roleViewer", { defaultValue: "Viewer" }) },
                      { value: "member", label: t("admin.roleMember", { defaultValue: "Member" }) },
                      { value: "power-user", label: t("admin.rolePowerUser", { defaultValue: "Power User" }) },
                      { value: "org-admin", label: t("admin.roleAdmin", { defaultValue: "Admin" }) },
                    ]}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {invitationsLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : invitations.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-text mb-3">{t("admin.pendingInvitations", { defaultValue: "Pending Invitations" })}</h3>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary border border-border">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-text">{inv.email}</p>
                    <p className="text-xs text-text-tertiary">
                      {t("admin.invited", { defaultValue: "Invited {{time}}", time: formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true }) })}
                    </p>
                  </div>
                </div>
                <Badge variant="warning">{inv.role}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={showInvite} onClose={() => setShowInvite(false)} title={t("admin.inviteTeamMember", { defaultValue: "Invite Team Member" })}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate({ email: inviteEmail, role: inviteRole });
          }}
          className="space-y-4"
        >
          <Input
            label={t("admin.email", { defaultValue: "Email" })}
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            autoFocus
            required
          />
          <Select
            label={t("admin.role", { defaultValue: "Role" })}
            value={inviteRole}
            onChange={(value) => setInviteRole(value)}
            options={[
              { value: "viewer", label: t("admin.roleViewer", { defaultValue: "Viewer" }) },
              { value: "member", label: t("admin.roleMember", { defaultValue: "Member" }) },
              { value: "power-user", label: t("admin.rolePowerUser", { defaultValue: "Power User" }) },
              { value: "org-admin", label: t("admin.roleAdmin", { defaultValue: "Admin" }) },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowInvite(false)}>{t("admin.cancel", { defaultValue: "Cancel" })}</Button>
            <Button type="submit" variant="primary" loading={invite.isPending}>{t("admin.sendInvite", { defaultValue: "Send Invite" })}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!elevateTarget}
        onClose={() => setElevateTarget(null)}
        onConfirm={() => {
          if (elevateTarget) updateRole.mutate({ userId: elevateTarget.userId, role: "org-admin" });
          setElevateTarget(null);
        }}
        title={t("admin.confirmRoleElevationTitle", { defaultValue: "Grant Admin Privileges" })}
        description={t("admin.confirmRoleElevation", { defaultValue: "Are you sure you want to grant admin privileges to {{name}}?", name: elevateTarget?.name ?? "" })}
        confirmLabel={t("admin.grantAdmin", { defaultValue: "Grant Admin" })}
        confirmVariant="danger"
        isLoading={updateRole.isPending}
      />
    </div>
  );
}
