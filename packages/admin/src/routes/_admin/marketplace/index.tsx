import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { Bot, FileText } from "lucide-react";

export const Route = createFileRoute("/_admin/marketplace/")({
  component: MarketplaceLayout,
});

function MarketplaceLayout() {
  const matchRoute = useMatchRoute();
  const isAgents = !!matchRoute({ to: "/marketplace/agents", fuzzy: true });

  // Default to showing agents content inline if no sub-route matched
  return null;
}
