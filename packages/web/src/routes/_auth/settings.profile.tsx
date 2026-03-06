import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Avatar } from "../../components/ui/Avatar";

export const Route = createFileRoute("/_auth/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () => api.get<any>("/api/users/me"),
  });

  const [name, setName] = useState(profile?.name ?? "");
  const [saved, setSaved] = useState(false);

  const updateProfile = useMutation({
    mutationFn: (data: { name: string }) => api.patch("/api/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={profile?.name} size="lg" />
        <div>
          <p className="font-medium text-text">{profile?.name ?? "User"}</p>
          <p className="text-sm text-text-secondary">{profile?.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <Input
          label={t("settings.displayName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label={t("auth.email")}
          value={profile?.email ?? ""}
          disabled
        />

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={updateProfile.isPending}>
            {t("settings.save")}
          </Button>
          {saved && <span className="text-sm text-success">{t("settings.saved")}</span>}
        </div>
      </form>
    </div>
  );
}
