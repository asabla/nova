import { createFileRoute } from "@tanstack/react-router";
import { AgentForm } from "@/components/AgentForm";

export const Route = createFileRoute("/_admin/marketplace/agents/new")({
  component: () => <AgentForm mode="create" />,
});
