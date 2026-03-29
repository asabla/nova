import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard, Building2, Users, Server, Settings, FileSearch, Heart, Store,
} from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/organisations", icon: Building2, label: "Organisations" },
  { to: "/users", icon: Users, label: "Users" },
  { to: "/marketplace", icon: Store, label: "Marketplace" },
  { to: "/providers", icon: Server, label: "Model Providers" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/audit", icon: FileSearch, label: "Audit Log" },
  { to: "/health", icon: Heart, label: "Health" },
] as const;

function AdminLayout() {
  const matchRoute = useMatchRoute();

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white tracking-tight">NOVA Admin</h1>
          <p className="text-[10px] text-gray-500 mt-0.5">Platform Administration</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = !!matchRoute({ to, fuzzy: true });
            return (
              <Link
                key={to}
                to={to}
                className={clsx(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-blue-600/10 text-blue-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-[10px] text-gray-600">NOVA Platform v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
