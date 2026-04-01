import { createFileRoute } from "@tanstack/react-router";
import { TemplateForm } from "@/components/TemplateForm";

export const Route = createFileRoute("/_admin/marketplace/templates/$templateId")({
  component: () => {
    const { templateId } = Route.useParams();
    return <TemplateForm key={templateId} mode="edit" templateId={templateId} />;
  },
});
