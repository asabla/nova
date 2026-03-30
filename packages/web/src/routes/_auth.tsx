import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { StatusBanner } from "../components/layout/StatusBanner";
import { SystemStatusBanner } from "../components/layout/SystemStatusBanner";
import { useAuthStore } from "../stores/auth.store";
import { useUIStore } from "../stores/ui.store";
import { useTheme } from "../hooks/useTheme";
import { useWebSocket } from "../hooks/useWebSocket";
import { authClient } from "../hooks/useAuth";
import { setActiveOrgId } from "../lib/api";

export const Route = createFileRoute("/_auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    org: (search.org as string) ?? undefined,
  }),
  beforeLoad: async ({ search }) => {
    const orgParam = search.org;

    const { session, setSession, activeOrgId, initOrg } = useAuthStore.getState();
    if (!session) {
      // Try to restore session from cookie
      const { data } = await authClient.getSession();
      if (data?.session) {
        setSession(data);
      } else {
        throw redirect({ to: "/login" });
      }
    }

    if (orgParam) {
      // Explicit org switch from admin portal — force the org context
      // Do NOT call initOrg() as it would override back to the user's default org
      setActiveOrgId(orgParam);
      useAuthStore.setState({ activeOrgId: orgParam });
      // Set a default role so the app doesn't try to re-init
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, role: state.user.role ?? "org-admin" } : state.user,
      }));
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (!activeOrgId || !useAuthStore.getState().user?.role) {
      // Normal flow — let initOrg handle it
      await initOrg();
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  useTheme();
  useWebSocket();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <SystemStatusBanner />
        <StatusBanner />
        <main id="main-content" className="flex flex-col flex-1 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
