import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Menu, Search, Sun, Moon, Monitor } from "lucide-react";
import { authClient } from "../../hooks/useAuth";
import { useUIStore } from "../../stores/ui.store";
import { Avatar } from "../ui/Avatar";
import { ConnectionStatus } from "./ConnectionStatus";
import { NotificationCenter } from "../notifications/NotificationCenter";

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button onClick={toggleSidebar} className="text-text-secondary hover:text-text p-1.5 rounded-lg hover:bg-surface-secondary">
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Connection status */}
        <ConnectionStatus />

        {/* Search / Command Palette */}
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 h-8 px-3 rounded-lg bg-surface-secondary border border-border text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline ml-2 text-[10px] font-mono bg-surface-tertiary px-1.5 py-0.5 rounded">
            {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl+"}K
          </kbd>
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => {
            const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
            setTheme(next);
          }}
          className="text-text-secondary hover:text-text p-2 rounded-lg hover:bg-surface-secondary"
          title={`Theme: ${theme}`}
        >
          {theme === "light" && <Sun className="h-4 w-4" />}
          {theme === "dark" && <Moon className="h-4 w-4" />}
          {theme === "system" && <Monitor className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <NotificationCenter />

        {/* User avatar */}
        <button
          onClick={() => navigate({ to: "/settings/profile" })}
          className="rounded-full hover:ring-2 hover:ring-primary/30 transition"
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
