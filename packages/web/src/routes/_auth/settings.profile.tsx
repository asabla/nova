import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
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

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "sv", label: "Svenska" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Francais" },
  { value: "es", label: "Espanol" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portugues" },
];

function ProfileSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () => api.get<any>("/api/users/me"),
  });

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      // Fallback for environments that don't support Intl.supportedValuesOf
      return [
        "UTC",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Stockholm",
        "Europe/Berlin",
        "Europe/Paris",
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Asia/Seoul",
        "Australia/Sydney",
      ];
    }
  }, []);

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("en");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.displayName ?? profile.name ?? "");
      setAvatarUrl(profile.avatarUrl ?? "");
      setTimezone(profile.timezone ?? "UTC");
      setLocale(profile.locale ?? "en");
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: (data: {
      displayName?: string;
      avatarUrl?: string;
      timezone?: string;
      locale?: string;
    }) => api.patch("/api/users/me", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      displayName: name,
      avatarUrl: avatarUrl || undefined,
      timezone,
      locale,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={profile?.displayName ?? profile?.name} src={avatarUrl || undefined} size="lg" />
        <div>
          <p className="font-medium text-text">{profile?.displayName ?? profile?.name ?? "User"}</p>
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

        <Input
          label={t("settings.avatarUrl", "Avatar URL")}
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/avatar.jpg"
          type="url"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="timezone-select" className="text-sm font-medium text-text">
            {t("settings.timezone", "Timezone")}
          </label>
          <select
            id="timezone-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text hover:border-border-strong focus:outline-2 focus:outline-offset-0 focus:outline-primary focus:border-primary"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="language-select" className="text-sm font-medium text-text">
            {t("settings.language", "Language")}
          </label>
          <select
            id="language-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text hover:border-border-strong focus:outline-2 focus:outline-offset-0 focus:outline-primary focus:border-primary"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

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
