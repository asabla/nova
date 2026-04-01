import { createFileRoute } from "@tanstack/react-router";
import { AgentForm } from "@/components/AgentForm";

export const Route = createFileRoute("/_admin/marketplace/agents/$agentId")({
  component: () => {
    const { agentId } = Route.useParams();
    return <AgentForm key={agentId} mode="edit" agentId={agentId} />;
  },
});
