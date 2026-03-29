import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Shield, Users as UsersIcon, ExternalLink } from "lucide-react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminApi.get<{ data: any[]; total: number }>(`/admin-api/users?search=${search}`),
  });

  const users = data?.data ?? [];

  return (
    <div className="space-y-6">
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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="bg-transparent border-none text-sm flex-1 outline-none"
          style={{ color: "var(--color-text-primary)" }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <UsersIcon className="h-8 w-8 mx-auto mb-4" style={{ color: "var(--color-text-muted)" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text-primary)" }}>
            {search ? "No users found" : "No users yet"}
          </h3>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {search ? "Try a different search term." : "Users will appear here as people sign up to the platform."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                {["User", "Organisations", "Joined", "Status"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider font-mono" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.id} className="row-hover transition-colors" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>{user.name ?? user.email?.split("@")[0]}</p>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{user.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-mono" style={{ color: "var(--color-text-secondary)" }}>{user.orgCount}</span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {user.isSuperAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "var(--color-accent-red-dim)", color: "var(--color-accent-red)" }}>
                        <Shield className="h-3 w-3" /> Super Admin
                      </span>
                    )}
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
  );
}
