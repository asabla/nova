import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { CommandPalette } from "../components/chat/CommandPalette";
import { GlobalShortcuts } from "../components/GlobalShortcuts";
import { ShortcutsHelpOverlay } from "../components/ui/ShortcutsHelpOverlay";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { NotFound } from "../components/NotFound";
import { ToastContainer } from "../components/ui/Toast";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <ErrorBoundary>
      <GlobalShortcuts />
      <Outlet />
      <CommandPalette />
      <ShortcutsHelpOverlay />
      <ToastContainer />
    </ErrorBoundary>
  );
}
