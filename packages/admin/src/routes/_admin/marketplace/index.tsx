import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/marketplace/")({
  beforeLoad: () => {
    throw redirect({ to: "/marketplace/agents" });
  },
});
