import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Search, Shield, Users as UsersIcon, UserCheck, UserX, Eye, ChevronDown,
  ShieldCheck, ShieldOff, Building2, ArrowLeft, Mail, Clock,
} from "lucide-react";
import { adminApi } from "@/lib/api";
import { toast } from "@/components/Toast";

export const Route = createFileRoute("/_admin/users")({
  component: UsersPage,
});

const card = { background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" };

function UsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminApi.get<{ data: any[]; total: number }>(`/admin-api/users?search=${search}&limit=100`),
  });

  const users = data?.data ?? [];

  const toggleSuperAdmin = useMutation({
    mutationFn: ({ userId, isSuperAdmin }: { userId: string; isSuperAdmin: boolean }) =>
      adminApi.patch(`/admin-api/users/${userId}/super-admin`, { isSuperAdmin }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
      toast(vars.isSuperAdmin ? "Super-admin access granted" : "Super-admin access revoked", "success");
    },
    onError: () => toast("Failed to update super-admin status", "error"),
  });

  const deactivateUser = useMutation({
    mutationFn: (userId: string) => adminApi.post(`/admin-api/users/${userId}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast("User deactivated", "success");
    },
    onError: () => toast("Failed to deactivate user", "error"),
  });

  const reactivateUser = useMutation({
    mutationFn: (userId: string) => adminApi.post(`/admin-api/users/${userId}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast("User reactivated", "success");
    },
    onError: () => toast("Failed to reactivate user", "error"),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            Manage users across all organisations &middot; {data?.total ?? 0} total
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 h-10 rounded-lg border max-w-md" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-default)" }}>
        <Search className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..."
          className="bg-transparent border-none text-sm flex-1 outline-none" style={{ color: "var(--color-text-primary)" }} />
      </div>

      <div className="flex gap-6">
        {/* Users Table */}
        <div className={`flex-1 ${selectedUser ? "max-w-[55%]" : ""} transition-all`}>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}</div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border p-12 text-center" style={card}>
              <UsersIcon className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>{search ? "No users found" : "No users yet"}</h3>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{search ? "Try a different search term." : "Users appear here as people sign up."}</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={card}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    {["User", "Orgs", "Joined", "Status", ""].map((h) => (
                      <th key={h} className={`${h === "Orgs" ? "text-center" : "text-left"} px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono`} style={{ color: "var(--color-text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: any) => (
                    <tr key={user.id}
                      className={`row-hover transition-colors cursor-pointer ${selectedUser === user.id ? "" : ""}`}
                      style={{ borderBottom: "1px solid var(--color-border-subtle)", background: selectedUser === user.id ? "var(--color-surface-overlay)" : undefined }}
                      onClick={() => setSelectedUser(selectedUser === user.id ? null : user.id)}>
                      <td className="px-5 py-3">
                        <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{user.name ?? user.email?.split("@")[0]}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{user.email}</p>
                      </td>
                      <td className="px-5 py-3 text-center font-mono" style={{ color: "var(--color-text-secondary)" }}>{user.orgCount}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        {user.isSuperAdmin && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
                            <Shield className="h-3 w-3" /> Super Admin
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Eye className="h-3.5 w-3.5 inline" style={{ color: selectedUser === user.id ? "var(--color-accent-blue)" : "var(--color-text-muted)" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data?.total != null && (
                <div className="px-5 py-2.5 text-[11px] font-mono" style={{ borderTop: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)" }}>
                  Showing {users.length} of {data.total}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Detail Panel */}
        {selectedUser && (
          <UserDetailPanel
            userId={selectedUser}
            onClose={() => setSelectedUser(null)}
            onToggleSuperAdmin={(userId, isSuperAdmin) => toggleSuperAdmin.mutate({ userId, isSuperAdmin })}
            onDeactivate={(userId) => { if (confirm("Deactivate this user?")) deactivateUser.mutate(userId); }}
            onReactivate={(userId) => reactivateUser.mutate(userId)}
          />
        )}
      </div>
    </div>
  );
}

function UserDetailPanel({ userId, onClose, onToggleSuperAdmin, onDeactivate, onReactivate }: {
  userId: string;
  onClose: () => void;
  onToggleSuperAdmin: (userId: string, isSuperAdmin: boolean) => void;
  onDeactivate: (userId: string) => void;
  onReactivate: (userId: string) => void;
}) {
  const { data: user, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => adminApi.get<any>(`/admin-api/users/${userId}`),
  });

  if (isLoading) return <div className="w-[45%] space-y-3"><div className="h-40 rounded-xl skeleton" /></div>;
  if (!user) return null;

  const isDeactivated = !!user.deletedAt;

  return (
    <div className="w-[45%] space-y-4 animate-[slideIn_0.15s_ease-out]">
      {/* User Info Card */}
      <div className="rounded-xl border p-5" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>{user.name ?? user.email?.split("@")[0]}</h2>
            <p className="text-sm font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{user.email}</p>
          </div>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded" style={{ color: "var(--color-text-muted)" }}>Close</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>User ID</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{user.id.slice(0, 12)}...</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Joined</p>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
              <Clock className="h-3 w-3" /> {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-4">
          {isDeactivated ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
              <UserX className="h-3 w-3" /> Deactivated
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-green-dim)", color: "var(--color-accent-green)" }}>
              <UserCheck className="h-3 w-3" /> Active
            </span>
          )}
          {user.isSuperAdmin && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
              <Shield className="h-3 w-3" /> Super Admin
            </span>
          )}
        </div>

        {/* Org Memberships */}
        {user.memberships && user.memberships.length > 0 && (
          <div>
            <h3 className="text-[10px] font-mono font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
              Organisations ({user.memberships.length})
            </h3>
            <div className="space-y-1.5">
              {user.memberships.map((m: any) => (
                <Link key={m.orgId} to="/organisations/$orgId" params={{ orgId: m.orgId }}
                  className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors hover:bg-white/3"
                  style={{ background: "var(--color-surface-overlay)" }}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>{m.orgName}</p>
                      <p className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>{m.orgSlug}</p>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "var(--color-surface-raised)", color: "var(--color-text-secondary)" }}>{m.role}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions Card */}
      <div className="rounded-xl border p-5 space-y-3" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
        <h3 className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Actions</h3>

        {/* Toggle Super Admin */}
        <button
          onClick={() => onToggleSuperAdmin(user.id, !user.isSuperAdmin)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
          style={{ background: "var(--color-surface-overlay)", color: "var(--color-text-primary)" }}
        >
          {user.isSuperAdmin ? <ShieldOff className="h-4 w-4" style={{ color: "var(--color-accent-amber)" }} /> : <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-accent-blue)" }} />}
          <span className="flex-1">{user.isSuperAdmin ? "Revoke super-admin" : "Grant super-admin"}</span>
        </button>

        {/* Deactivate / Reactivate */}
        {isDeactivated ? (
          <button onClick={() => onReactivate(user.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
            style={{ background: "var(--color-accent-green-dim)", color: "var(--color-accent-green)" }}>
            <UserCheck className="h-4 w-4" /> Reactivate user
          </button>
        ) : (
          <button onClick={() => onDeactivate(user.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
            style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
            <UserX className="h-4 w-4" /> Deactivate user
          </button>
        )}
      </div>
    </div>
  );
}
