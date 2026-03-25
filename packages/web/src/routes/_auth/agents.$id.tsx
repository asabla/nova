import { createFileRoute } from "@tanstack/react-router";
import { AgentBuilderLayout } from "../../components/agents/AgentBuilderLayout";

export const Route = createFileRoute("/_auth/agents/$id")({
  component: AgentDetailPage,
});

function AgentDetailPage() {
  const { id } = Route.useParams();
  return <AgentBuilderLayout mode="edit" agentId={id} />;
}
