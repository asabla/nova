import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Users, BarChart3, Shield, Settings, Activity, Heart, Gauge, AlertTriangle,
  Database, CreditCard, Palette, Link2, FileSearch, UserCog,
} from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_auth/admin")({
  component: AdminLayout,
});

interface TabGroup {
  label: string;
  tabs: readonly { to: string; icon: any; label: string }[];
}

const tabGroups: TabGroup[] = [
  {
    label: "Overview",
    tabs: [
      { to: "/admin/health", icon: Heart, label: "admin.health" },
      { to: "/admin/analytics", icon: BarChart3, label: "admin.analytics" },
      { to: "/admin/audit", icon: FileSearch, label: "admin.audit" },
    ],
  },
  {
    label: "People",
    tabs: [
      { to: "/admin/members", icon: Users, label: "admin.members" },
      { to: "/admin/groups", icon: UserCog, label: "admin.groups" },
    ],
  },
  {
    label: "AI & Limits",
    tabs: [
      { to: "/admin/models", icon: Activity, label: "admin.models" },
      { to: "/admin/content-filter", icon: AlertTriangle, label: "admin.contentSafety" },
      { to: "/admin/rate-limits", icon: Gauge, label: "admin.rateLimits" },
    ],
  },
  {
    label: "Security",
    tabs: [
      { to: "/admin/security", icon: Shield, label: "admin.security" },
      { to: "/admin/sso", icon: Shield, label: "admin.sso" },
    ],
  },
  {
    label: "Organization",
    tabs: [
      { to: "/admin/org-settings", icon: Settings, label: "admin.orgSettings" },
      { to: "/admin/branding", icon: Palette, label: "admin.branding" },
      { to: "/admin/billing", icon: CreditCard, label: "admin.billing" },
      { to: "/admin/integrations", icon: Link2, label: "admin.integrations" },
      { to: "/admin/data-retention", icon: Database, label: "admin.dataRetention" },
    ],
  },
];

function AdminLayout() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-6">{t("admin.title")}</h1>

        <div className="flex gap-6">
          {/* Sidebar navigation */}
          <nav className="w-52 shrink-0 space-y-4">
            {tabGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary px-3 mb-1">
                  {group.label}
                </h3>
                <div className="space-y-0.5">
                  {group.tabs.map(({ to, icon: Icon, label }) => {
                    const isActive = matchRoute({ to });
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={clsx(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-text-secondary hover:bg-surface-secondary hover:text-text",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {t(label)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
