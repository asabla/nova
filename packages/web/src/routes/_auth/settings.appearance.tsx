import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor } from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "../../hooks/useTheme";

export const Route = createFileRoute("/_auth/settings/appearance")({
  component: AppearanceSettings,
});

function AppearanceSettings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const options = [
    { value: "light" as const, icon: Sun, label: t("settings.light") },
    { value: "dark" as const, icon: Moon, label: t("settings.dark") },
    { value: "system" as const, icon: Monitor, label: t("settings.system") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text mb-3">{t("settings.theme")}</h3>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {options.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={clsx(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors",
                theme === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border-strong bg-surface-secondary",
              )}
            >
              <Icon className={clsx("h-5 w-5", theme === value ? "text-primary" : "text-text-secondary")} />
              <span className={clsx("text-sm", theme === value ? "text-primary font-medium" : "text-text-secondary")}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
