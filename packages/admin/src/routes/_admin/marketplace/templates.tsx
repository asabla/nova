import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/marketplace/templates")({
  component: () => (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Prompt Templates</h1>
      <p className="text-sm text-gray-500">Manage curated prompt templates for the platform marketplace</p>
      <div className="text-center py-16 text-gray-600 text-sm">Coming soon</div>
    </div>
  ),
});
