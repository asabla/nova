import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { User, Palette, Bell, Shield, Key } from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsLayout,
});

const tabs = [
  { to: "/settings/profile", icon: User, label: "settings.profile" },
  { to: "/settings/appearance", icon: Palette, label: "settings.appearance" },
  { to: "/settings/notifications", icon: Bell, label: "settings.notifications" },
  { to: "/settings/security", icon: Shield, label: "settings.security" },
  { to: "/settings/api-keys", icon: Key, label: "settings.apiKeys" },
] as const;

function SettingsLayout() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-text mb-6">{t("app.settings")}</h1>

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
