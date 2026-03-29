import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.get<{ data: any[] }>("/admin-api/settings"),
  });

  const settings = data?.data ?? [];
  const settingsMap = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure platform-wide defaults and feature flags</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Current Settings</h3>
        {settings.length === 0 ? (
          <p className="text-xs text-gray-500">No platform settings configured yet</p>
        ) : (
          <div className="space-y-2">
            {settings.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800/50">
                <span className="text-sm text-gray-300 font-mono">{s.key}</span>
                <span className="text-sm text-gray-500">{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
