import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { User, Palette, Bell, Shield, Key, Keyboard, Download } from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsLayout,
});

const tabs = [
  { to: "/settings/profile", icon: User, label: "settings.profile", labelDefault: "Profile" },
  { to: "/settings/appearance", icon: Palette, label: "settings.appearance", labelDefault: "Appearance" },
  { to: "/settings/notifications", icon: Bell, label: "settings.notifications", labelDefault: "Notifications" },
  { to: "/settings/security", icon: Shield, label: "settings.security", labelDefault: "Security" },
  { to: "/settings/api-keys", icon: Key, label: "settings.apiKeys", labelDefault: "API Keys" },
  { to: "/settings/shortcuts", icon: Keyboard, label: "settings.shortcuts", labelDefault: "Shortcuts" },
  { to: "/settings/import-export", icon: Download, label: "settings.importExport", labelDefault: "Import / Export" },
] as const;

function SettingsLayout() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-6">{t("app.settings", "Settings")}</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar navigation */}
          <nav
            aria-label="Settings navigation"
            className="md:w-44 shrink-0 flex md:flex-col overflow-x-auto md:overflow-visible gap-0.5"
          >
            {tabs.map(({ to, icon: Icon, label, labelDefault }) => {
              const isActive = matchRoute({ to });
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-text-secondary hover:bg-surface-secondary hover:text-text",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(label, labelDefault)}
                </Link>
              );
            })}
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
