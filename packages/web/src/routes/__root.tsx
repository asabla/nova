import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { CommandPalette } from "../components/chat/CommandPalette";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { NotFound } from "../components/NotFound";

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
      <Outlet />
      <CommandPalette />
    </ErrorBoundary>
  );
}
