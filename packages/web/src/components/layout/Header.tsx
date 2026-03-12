import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor } from "lucide-react";
import { authClient } from "../../hooks/useAuth";
import { useUIStore } from "../../stores/ui.store";
import { Avatar } from "../ui/Avatar";
import { ConnectionStatus } from "./ConnectionStatus";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { OmniBarTrigger } from "./OmniBar";

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const themeLabel = t(`theme.${theme}`, { defaultValue: theme });
  const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center gap-3 px-4 shrink-0">
      {/* Skip to main content link (visible on focus only) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:text-sm focus:font-medium"
      >
        {t("nav.skipToContent", { defaultValue: "Skip to content" })}
      </a>

      {/* Center: OmniBar search */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <OmniBarTrigger />
      </div>

      {/* Right: Utilities */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ConnectionStatus />

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(nextTheme)}
          className="text-text-secondary hover:text-text p-2 rounded-lg hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={t("theme.toggle", { current: themeLabel, next: nextTheme })}
        >
          {theme === "light" && <Sun className="h-4 w-4" aria-hidden="true" />}
          {theme === "dark" && <Moon className="h-4 w-4" aria-hidden="true" />}
          {theme === "system" && <Monitor className="h-4 w-4" aria-hidden="true" />}
        </button>

        <NotificationCenter />

        {/* User avatar */}
        <button
          onClick={() => navigate({ to: "/settings/profile" })}
          aria-label={t("nav.profile", { defaultValue: "Profile settings" })}
          className="rounded-full hover:ring-2 hover:ring-primary/30 transition focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Avatar
            name={session?.user?.name}
            src={session?.user?.image}
            size="sm"
          />
        </button>
      </div>
    </header>
  );
}
