import { createFileRoute, Outlet, Link, redirect, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Users, BarChart3, Shield, Settings, Activity, Heart, Gauge, AlertTriangle,
  Database, CreditCard, Palette, Link2, FileSearch, UserCog,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { clsx } from "clsx";
import { Select } from "../../components/ui/Select";

export const Route = createFileRoute("/_auth/admin")({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    const role = user?.role;
    if (role !== "org-admin" && role !== "super-admin") {
      throw redirect({ to: "/" });
    }
  },
  component: AdminLayout,
});

interface TabGroupDef {
  labelKey: string;
  labelDefault: string;
  tabs: readonly { to: string; icon: any; label: string }[];
}

const tabGroupDefs: TabGroupDef[] = [
  {
    labelKey: "admin.groupOverview",
    labelDefault: "Overview",
    tabs: [
      { to: "/admin/health", icon: Heart, label: "admin.health" },
      { to: "/admin/analytics", icon: BarChart3, label: "admin.analytics" },
      { to: "/admin/audit", icon: FileSearch, label: "admin.audit" },
    ],
  },
  {
    labelKey: "admin.groupPeople",
    labelDefault: "People",
    tabs: [
      { to: "/admin/members", icon: Users, label: "admin.members" },
      { to: "/admin/groups", icon: UserCog, label: "admin.groups" },
    ],
  },
  {
    labelKey: "admin.groupAiLimits",
    labelDefault: "AI & Limits",
    tabs: [
      { to: "/admin/models", icon: Activity, label: "admin.models" },
      { to: "/admin/content-filter", icon: AlertTriangle, label: "admin.contentSafety" },
      { to: "/admin/rate-limits", icon: Gauge, label: "admin.rateLimits" },
    ],
  },
  {
    labelKey: "admin.groupSecurity",
    labelDefault: "Security",
    tabs: [
      { to: "/admin/security", icon: Shield, label: "admin.security" },
      { to: "/admin/sso", icon: Shield, label: "admin.sso" },
    ],
  },
  {
    labelKey: "admin.groupOrganization",
    labelDefault: "Organization",
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
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-6">{t("admin.title")}</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar navigation - horizontal scrollable tabs on mobile, vertical sidebar on desktop */}
          <nav className="w-full md:w-52 shrink-0 md:space-y-4 overflow-x-auto md:overflow-x-visible">
            {/* Mobile: dropdown navigation */}
            <div className="md:hidden pb-2">
              <Select
                options={tabGroupDefs.flatMap((group) =>
                  group.tabs.map(({ to, label }) => ({
                    value: to,
                    label: `${t(group.labelKey, group.labelDefault)} - ${t(label)}`,
                  }))
                )}
                value={tabGroupDefs.flatMap((g) => g.tabs).find(({ to }) => matchRoute({ to }))?.to ?? ""}
                onChange={(val) => navigate({ to: val })}
              />
            </div>
            {/* Desktop: vertical sidebar */}
            <div className="hidden md:block space-y-4">
              {tabGroupDefs.map((group) => (
                <div key={group.labelKey}>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary px-3 mb-1">
                    {t(group.labelKey, group.labelDefault)}
                  </h3>
                  <div className="space-y-0.5">
                    {group.tabs.map(({ to, icon: Icon, label }) => {
                      const isActive = matchRoute({ to });
                      return (
                        <Link
                          key={to}
                          to={to}
                          aria-current={isActive ? "page" : undefined}
                          className={clsx(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-text-secondary hover:bg-surface-secondary hover:text-text",
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {t(label)}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
