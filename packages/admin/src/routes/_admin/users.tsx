import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Shield } from "lucide-react";
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
      <div>
        <h1 className="text-xl font-bold text-white">Users</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users across all organisations</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder:text-gray-500"
        />
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm animate-pulse">Loading users...</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">User</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Orgs</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Joined</th>
                <th className="px-4 py-3 text-xs text-gray-500 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user: any) => (
                <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{user.name ?? user.email}</p>
                    <p className="text-[10px] text-gray-500">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{user.orgCount}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {user.isSuperAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 rounded">
                        <Shield className="h-3 w-3" /> Super Admin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total != null && (
            <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-800">{data.total} total users</div>
          )}
        </div>
      )}
    </div>
  );
}
