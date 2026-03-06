import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export const Route = createFileRoute("/_auth/admin/org-settings")({
  component: OrgSettingsPage,
});

function OrgSettingsPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: org } = useQuery({
    queryKey: ["org"],
    queryFn: () => api.get<any>("/api/org"),
  });

  const { data: settings } = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => api.get<any>("/api/org/settings"),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [maxFileSize, setMaxFileSize] = useState("");

  useEffect(() => {
    if (org) {
      setName(org.name ?? "");
      setSlug(org.slug ?? "");
    }
    if (settings) {
      setDefaultModel(settings.defaultModel ?? "gpt-4o");
      setMaxTokens(String(settings.maxTokensPerMessage ?? 4096));
      setMaxFileSize(String(settings.maxFileSizeMb ?? 50));
    }
  }, [org, settings]);

  const updateOrg = useMutation({
    mutationFn: (data: any) => api.patch("/api/org", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org"] }),
  });

  const updateSettings = useMutation({
    mutationFn: (data: any) => api.put("/api/org/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => {
    updateOrg.mutate({ name, slug });
    updateSettings.mutate({
      defaultModel,
      maxTokensPerMessage: parseInt(maxTokens),
      maxFileSizeMb: parseInt(maxFileSize),
    });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-text">Organization Info</h3>
        <Input label="Organization Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-text">Defaults</h3>
        <Input label="Default Model" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} />
        <Input label="Max Tokens per Message" type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
        <Input label="Max File Size (MB)" type="number" value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={handleSave} loading={updateOrg.isPending || updateSettings.isPending}>
          Save Settings
        </Button>
        {saved && <span className="text-sm text-success">Saved!</span>}
      </div>
    </div>
  );
}
