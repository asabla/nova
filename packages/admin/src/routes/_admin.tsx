import { createFileRoute, Outlet, Link, useMatchRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Building2, Users, Server, Settings, FileSearch, Heart, Store,
  LogOut, ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { adminApi } from "@/lib/api";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

const navSections = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/health", icon: Heart, label: "Health" },
    ],
  },
  {
    label: "Management",
    items: [
      { to: "/organisations", icon: Building2, label: "Organisations" },
      { to: "/users", icon: Users, label: "Users" },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/marketplace", icon: Store, label: "Marketplace" },
      { to: "/providers", icon: Server, label: "Model Providers" },
      { to: "/settings", icon: Settings, label: "Settings" },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/audit", icon: FileSearch, label: "Audit Log" },
    ],
  },
] as const;

function AdminLayout() {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();

  const { data: auth, isLoading: authLoading } = useQuery({
    queryKey: ["admin-auth"],
    queryFn: () => adminApi.get<{ authenticated: boolean; email?: string }>("/admin-api/auth/me"),
    retry: false,
  });

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--color-surface)" }}>
        <div className="text-center">
          <div className="h-8 w-8 rounded-lg mx-auto mb-3 animate-pulse" style={{ background: "var(--color-accent-blue-dim)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!auth?.authenticated) {
    navigate({ to: "/login" });
    return null;
  }

  return (
    <div className="flex h-screen" style={{ background: "var(--color-surface)" }}>
      {/* Sidebar */}
      <aside className="w-60 flex flex-col border-r" style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-surface-raised)" }}>
        {/* Brand */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "var(--color-accent-blue)" }}>
              <span className="text-white text-xs font-bold font-mono">N</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>NOVA Admin</h1>
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ to, icon: Icon, label }) => {
                  const isActive = !!matchRoute({ to, fuzzy: true });
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={clsx(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? "text-white"
                          : "hover:text-white",
                      )}
                      style={{
                        color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                        background: isActive ? "var(--color-accent-blue-dim)" : "transparent",
                        borderLeft: isActive ? "2px solid var(--color-accent-blue)" : "2px solid transparent",
                      }}
                    >
                      <Icon className="h-4 w-4 shrink-0" style={{ opacity: isActive ? 1 : 0.6 }} />
                      <span className="flex-1">{label}</span>
                      {isActive && <ChevronRight className="h-3 w-3 opacity-40" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>v1.0.0</span>
            <button className="p-1.5 rounded hover:bg-white/5 transition-colors" style={{ color: "var(--color-text-muted)" }}>
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
