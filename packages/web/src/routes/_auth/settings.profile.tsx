import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Avatar } from "../../components/ui/Avatar";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/settings/profile")({
  component: ProfileSettings,
});

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "sv", label: "Svenska" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "ko", label: "한국어" },
  { value: "pt", label: "Português" },
];

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-surface-secondary" />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-surface-secondary rounded" />
          <div className="h-3 w-48 bg-surface-secondary rounded" />
        </div>
      </div>
      <div className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-surface-secondary rounded" />
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-surface-secondary rounded" />
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-20 bg-surface-secondary rounded" />
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-20 bg-surface-secondary rounded" />
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-20 bg-surface-secondary rounded" />
          <div className="h-10 w-full bg-surface-secondary rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
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
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const [locale, setLocale] = useState("en");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.displayName ?? profile.name ?? "");
      setAvatarUrl(profile.avatarUrl ?? "");
      setTimezone(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
      setLocale(profile.locale ?? "en");
    }
  }, [profile]);

  const savedTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

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
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      toast(t("settings.profileUpdateFailed", "Failed to update profile. Please try again."), "error");
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

  if (isLoading) {
    return <ProfileSkeleton />;
  }

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
          label={t("settings.displayName", "Display Name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label={t("auth.email", "Email")}
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

        <Select
          label={t("settings.timezone", "Timezone")}
          options={timezones.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))}
          value={timezone}
          onChange={(val) => setTimezone(val)}
        />

        <Select
          label={t("settings.language", "Language")}
          options={LANGUAGES.map((lang) => ({ value: lang.value, label: lang.label }))}
          value={locale}
          onChange={(val) => setLocale(val)}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={updateProfile.isPending}>
            {t("settings.save", "Save")}
          </Button>
          {saved && (
            <span className="text-sm text-success" role="status" aria-live="polite">
              {t("settings.saved", "Saved")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
