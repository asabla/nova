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

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
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
    // Ensure user has an org set up
    if (!activeOrgId || !useAuthStore.getState().user?.role) {
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
