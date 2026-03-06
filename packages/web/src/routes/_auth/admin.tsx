import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import { Users, BarChart3, Shield, Settings, Activity } from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_auth/admin")({
  component: AdminLayout,
});

const tabs = [
  { to: "/admin/members", icon: Users, label: "Members" },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin/security", icon: Shield, label: "Security" },
  { to: "/admin/models", icon: Activity, label: "Models" },
  { to: "/admin/org-settings", icon: Settings, label: "Organization" },
] as const;

function AdminLayout() {
  const matchRoute = useMatchRoute();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-6">Admin</h1>

        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
          {tabs.map(({ to, icon: Icon, label }) => {
            const isActive = matchRoute({ to });
            return (
              <Link
                key={to}
                to={to}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 text-sm border-b-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-text-secondary hover:text-text",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <Outlet />
      </div>
    </div>
  );
}
