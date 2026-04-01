import { createFileRoute } from "@tanstack/react-router";
import { TemplateForm } from "@/components/TemplateForm";

export const Route = createFileRoute("/_admin/marketplace/templates/new")({
  component: () => <TemplateForm mode="create" />,
});
