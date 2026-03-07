import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/admin/org-settings")({
  component: OrgSettingsPage,
});

function OrgSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["org"],
    queryFn: () => api.get<any>("/api/org"),
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
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

  const handleSave = async () => {
    setSaving(true);
    const results = await Promise.allSettled([
      api.patch("/api/org", { name, slug }),
      api.put("/api/org/settings", {
        defaultModel,
        maxTokensPerMessage: parseInt(maxTokens),
        maxFileSizeMb: parseInt(maxFileSize),
      }),
    ]);

    const orgResult = results[0];
    const settingsResult = results[1];

    if (orgResult.status === "rejected" && settingsResult.status === "rejected") {
      toast(t("admin.bothSavesFailed", { defaultValue: "Failed to save organization info and settings" }), "error");
    } else if (orgResult.status === "rejected") {
      toast(t("admin.orgSaveFailed", { defaultValue: "Settings saved, but failed to update organization info" }), "error");
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
    } else if (settingsResult.status === "rejected") {
      toast(t("admin.settingsSaveFailed", { defaultValue: "Organization info saved, but failed to update settings" }), "error");
      queryClient.invalidateQueries({ queryKey: ["org"] });
    } else {
      toast(t("admin.settingsSaved", { defaultValue: "Settings saved" }), "success");
      queryClient.invalidateQueries({ queryKey: ["org"] });
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
    }

    setSaving(false);
  };

  const isLoading = orgLoading || settingsLoading;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-text">{t("admin.orgSettingsTitle", { defaultValue: "Organization Settings" })}</h2>
        <p className="text-sm text-text-secondary mt-1">{t("admin.orgSettingsDescription", { defaultValue: "Manage your organization's name, slug, and default configurations." })}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-40 mt-4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text">{t("admin.organizationInfo", { defaultValue: "Organization Info" })}</h3>
            <Input label={t("admin.organizationName", { defaultValue: "Organization Name" })} value={name} onChange={(e) => setName(e.target.value)} />
            <Input label={t("admin.slug", { defaultValue: "Slug" })} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text">{t("admin.defaults", { defaultValue: "Defaults" })}</h3>
            <Input label={t("admin.defaultModel", { defaultValue: "Default Model" })} value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} />
            <Input label={t("admin.maxTokensPerMessage", { defaultValue: "Max Tokens per Message" })} type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
            <Input label={t("admin.maxFileSize", { defaultValue: "Max File Size (MB)" })} type="number" value={maxFileSize} onChange={(e) => setMaxFileSize(e.target.value)} />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {t("admin.saveSettings", { defaultValue: "Save Settings" })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
