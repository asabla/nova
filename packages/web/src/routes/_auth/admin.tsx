import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import {
  Users, BarChart3, Shield, Settings, Activity, Heart, Gauge, AlertTriangle,
  Database, CreditCard, Palette, Link2, FileSearch, ClipboardCheck, UserCog,
} from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_auth/admin")({
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", icon: Heart, label: "Health", exact: true },
  { to: "/admin/members", icon: Users, label: "Members" },
  { to: "/admin/groups", icon: UserCog, label: "Groups" },
  { to: "/admin/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/admin/models", icon: Activity, label: "Models" },
  { to: "/admin/security", icon: Shield, label: "Security" },
  { to: "/admin/sso", icon: Shield, label: "SSO" },
  { to: "/admin/content-filter", icon: AlertTriangle, label: "Content Safety" },
  { to: "/admin/rate-limits", icon: Gauge, label: "Rate Limits" },
  { to: "/admin/integrations", icon: Link2, label: "Integrations" },
  { to: "/admin/audit", icon: FileSearch, label: "Audit" },
  { to: "/admin/data-retention", icon: Database, label: "Retention" },
  { to: "/admin/branding", icon: Palette, label: "Branding" },
  { to: "/admin/billing", icon: CreditCard, label: "Billing" },
  { to: "/admin/org-settings", icon: Settings, label: "Organization" },
] as const;

function AdminLayout() {
  const matchRoute = useMatchRoute();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-6">Admin</h1>

        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto scrollbar-none">
          {tabs.map(({ to, icon: Icon, label }) => {
            const isActive = matchRoute({ to });
            return (
              <Link
                key={to}
                to={to}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-text-secondary hover:text-text",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
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
