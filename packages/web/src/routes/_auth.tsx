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
  beforeLoad: async () => {
    // Check for org switch via URL parameter (used by admin portal "Open in App")
    const urlParams = new URLSearchParams(window.location.search);
    const orgParam = urlParams.get("org");
    if (orgParam) {
      // Clean up the URL immediately
      urlParams.delete("org");
      const cleanUrl = urlParams.toString() ? `${window.location.pathname}?${urlParams}` : window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }

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
      // Explicit org switch — set directly and re-init for role resolution
      setActiveOrgId(orgParam);
      useAuthStore.getState().setActiveOrg(orgParam);
      // Fetch user's role in this org (if they have one)
      try {
        const res = await fetch("/api/auth/init", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "x-org-id": orgParam },
        });
        if (res.ok) {
          const data = await res.json();
          // Keep the orgParam, don't let init override it
          useAuthStore.setState((state) => ({
            activeOrgId: orgParam,
            user: state.user ? { ...state.user, role: data.role ?? "member", displayName: data.displayName } : state.user,
          }));
        }
      } catch {
        // Non-critical — org switch still works, just no role info
      }
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
