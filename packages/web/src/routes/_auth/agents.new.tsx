import { createFileRoute } from "@tanstack/react-router";
import { AgentBuilderLayout } from "../../components/agents/AgentBuilderLayout";

export const Route = createFileRoute("/_auth/agents/new")({
  component: AgentBuilderPage,
});

function AgentBuilderPage() {
  return <AgentBuilderLayout mode="create" />;
}
