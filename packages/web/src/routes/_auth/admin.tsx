import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Users, BarChart3, Shield, Settings, Activity, Heart, Gauge, AlertTriangle,
  Database, CreditCard, Palette, Link2, FileSearch, ClipboardCheck, UserCog,
} from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_auth/admin")({
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", icon: Heart, label: "admin.health", exact: true },
  { to: "/admin/members", icon: Users, label: "admin.members" },
  { to: "/admin/groups", icon: UserCog, label: "admin.groups" },
  { to: "/admin/analytics", icon: BarChart3, label: "admin.analytics" },
  { to: "/admin/models", icon: Activity, label: "admin.models" },
  { to: "/admin/security", icon: Shield, label: "admin.security" },
  { to: "/admin/sso", icon: Shield, label: "admin.sso" },
  { to: "/admin/content-filter", icon: AlertTriangle, label: "admin.contentSafety" },
  { to: "/admin/rate-limits", icon: Gauge, label: "admin.rateLimits" },
  { to: "/admin/integrations", icon: Link2, label: "admin.integrations" },
  { to: "/admin/audit", icon: FileSearch, label: "admin.audit" },
  { to: "/admin/data-retention", icon: Database, label: "admin.dataRetention" },
  { to: "/admin/branding", icon: Palette, label: "admin.branding" },
  { to: "/admin/billing", icon: CreditCard, label: "admin.billing" },
  { to: "/admin/org-settings", icon: Settings, label: "admin.orgSettings" },
] as const;

function AdminLayout() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-6">{t("admin.title")}</h1>

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
                {t(label)}
              </Link>
            );
          })}
        </div>

        <Outlet />
      </div>
    </div>
  );
}
