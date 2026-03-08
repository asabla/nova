import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useUIStore } from "../stores/ui.store";
import { useGlobalShortcuts } from "../hooks/useKeyboardShortcuts";

/**
 * Registers all global keyboard shortcuts for the app.
 * Renders nothing — this is a side-effect-only component
 * mounted once in the root layout.
 */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const toggleOmniBar = useUIStore((s) => s.toggleOmniBar);
  const toggleShortcutsHelp = useUIStore((s) => s.toggleShortcutsHelp);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const onCommandPalette = useCallback(() => toggleOmniBar(), [toggleOmniBar]);
  const onNewChat = useCallback(() => navigate({ to: "/conversations/new" }), [navigate]);
  const onShortcutsHelp = useCallback(() => toggleShortcutsHelp(), [toggleShortcutsHelp]);
  const onSettings = useCallback(() => navigate({ to: "/settings/profile" }), [navigate]);
  const onSearch = useCallback(() => toggleOmniBar(), [toggleOmniBar]);
  const onToggleSidebar = useCallback(() => toggleSidebar(), [toggleSidebar]);
  const onGoHome = useCallback(() => navigate({ to: "/" }), [navigate]);

  useGlobalShortcuts({
    onCommandPalette,
    onNewChat,
    onShortcutsHelp,
    onSettings,
    onSearch,
    onToggleSidebar,
    onGoHome,
  });

  return null;
}
