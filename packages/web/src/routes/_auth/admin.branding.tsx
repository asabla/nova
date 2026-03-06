import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Palette, Image, Code, Eye, Save } from "lucide-react";
import { clsx } from "clsx";

export const Route = createFileRoute("/_auth/admin/branding")({
  component: BrandingPage,
});

interface BrandingSettings {
  logoUrl: string;
  primaryColor: string;
  faviconUrl: string;
  customCss: string;
  brandingEnabled: boolean;
}

const DEFAULT_SETTINGS: BrandingSettings = {
  logoUrl: "",
  primaryColor: "#6366f1",
  faviconUrl: "",
  customCss: "",
  brandingEnabled: false,
};

function BrandingPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreviewSrc, setLogoPreviewSrc] = useState<string>("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["org-settings"],
    queryFn: () => api.get<any>("/api/org/settings"),
  });

  const [form, setForm] = useState<BrandingSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (settings?.branding) {
      const b = settings.branding;
      setForm({
        logoUrl: b.logoUrl ?? "",
        primaryColor: b.primaryColor ?? "#6366f1",
        faviconUrl: b.faviconUrl ?? "",
        customCss: b.customCss ?? "",
        brandingEnabled: b.brandingEnabled ?? false,
      });
      setLogoPreviewSrc(b.logoUrl ?? "");
    }
  }, [settings]);

  const updateBranding = useMutation({
    mutationFn: (data: { branding: BrandingSettings }) =>
      api.patch("/api/org/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => {
    updateBranding.mutate({ branding: form });
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreviewSrc(dataUrl);
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const updateField = <K extends keyof BrandingSettings>(
    key: K,
    value: BrandingSettings[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Branding & White-labeling
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Customize the look and feel of your organization's NOVA instance.
        </p>
      </div>

      {/* Branding Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary p-4">
        <div>
          <p className="text-sm font-medium text-text">Custom Branding</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Enable to use your custom logo, colors, and styles instead of the
            defaults.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.brandingEnabled}
          onClick={() => updateField("brandingEnabled", !form.brandingEnabled)}
          className={clsx(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            form.brandingEnabled ? "bg-primary" : "bg-surface-tertiary",
          )}
        >
          <span
            className={clsx(
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              form.brandingEnabled ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </div>

      <div
        className={clsx(
          "space-y-6 transition-opacity",
          !form.brandingEnabled && "opacity-50 pointer-events-none",
        )}
      >
        {/* Logo Upload */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text flex items-center gap-2">
            <Image className="h-4 w-4 text-text-secondary" />
            Organization Logo
          </h3>
          <div className="flex items-start gap-4">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface overflow-hidden cursor-pointer hover:border-primary transition-colors"
              onClick={() => logoInputRef.current?.click()}
            >
              {logoPreviewSrc ? (
                <img
                  src={logoPreviewSrc}
                  alt="Logo preview"
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <Image className="h-8 w-8 text-text-tertiary" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Input
                label="Logo URL"
                placeholder="https://example.com/logo.png"
                value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
                onChange={(e) => {
                  updateField("logoUrl", e.target.value);
                  setLogoPreviewSrc(e.target.value);
                }}
              />
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFileChange}
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="text-xs text-primary hover:text-primary-dark transition-colors"
              >
                Or click to upload a file
              </button>
            </div>
          </div>
        </section>

        {/* Primary Color */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text flex items-center gap-2">
            <Palette className="h-4 w-4 text-text-secondary" />
            Primary Brand Color
          </h3>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => updateField("primaryColor", e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
            />
            <Input
              placeholder="#6366f1"
              value={form.primaryColor}
              onChange={(e) => updateField("primaryColor", e.target.value)}
              className="flex-1 font-mono"
            />
            <div
              className="h-10 flex-1 rounded-lg border border-border"
              style={{ backgroundColor: form.primaryColor }}
            />
          </div>
        </section>

        {/* Favicon */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text flex items-center gap-2">
            <Image className="h-4 w-4 text-text-secondary" />
            Favicon
          </h3>
          <div className="flex items-center gap-3">
            {form.faviconUrl && (
              <img
                src={form.faviconUrl}
                alt="Favicon preview"
                className="h-8 w-8 rounded border border-border object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="flex-1">
              <Input
                label="Favicon URL"
                placeholder="https://example.com/favicon.ico"
                value={form.faviconUrl}
                onChange={(e) => updateField("faviconUrl", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Custom CSS */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-text flex items-center gap-2">
            <Code className="h-4 w-4 text-text-secondary" />
            Custom CSS
          </h3>
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <div className="mb-2 flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 px-3 py-2">
              <span className="text-xs text-warning font-medium">
                Warning: Custom CSS is injected directly into the page. Improper
                rules may break the UI. Test changes carefully.
              </span>
            </div>
            <textarea
              value={form.customCss}
              onChange={(e) => updateField("customCss", e.target.value)}
              placeholder={`:root {\n  --color-primary: #6366f1;\n  --color-primary-dark: #4f46e5;\n}`}
              rows={8}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-text placeholder:text-text-tertiary focus:outline-2 focus:outline-offset-0 focus:outline-primary focus:border-primary resize-y"
            />
          </div>
        </section>

        {/* Login Page Preview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text flex items-center gap-2">
              <Eye className="h-4 w-4 text-text-secondary" />
              Login Page Preview
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </div>
          {showPreview && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div
                className="flex flex-col items-center justify-center p-8 space-y-6"
                style={{
                  background: `linear-gradient(135deg, ${form.primaryColor}15, ${form.primaryColor}05)`,
                }}
              >
                {/* Mock login card */}
                <div className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-lg p-6 space-y-5">
                  <div className="flex flex-col items-center gap-3">
                    {logoPreviewSrc ? (
                      <img
                        src={logoPreviewSrc}
                        alt="Logo"
                        className="h-10 w-auto object-contain"
                      />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-lg"
                        style={{ backgroundColor: form.primaryColor }}
                      />
                    )}
                    <h3 className="text-base font-semibold text-text">
                      Sign in to your account
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div className="h-10 rounded-lg border border-border bg-surface-secondary" />
                    <div className="h-10 rounded-lg border border-border bg-surface-secondary" />
                    <div
                      className="h-10 rounded-lg flex items-center justify-center text-sm font-medium text-white"
                      style={{ backgroundColor: form.primaryColor }}
                    >
                      Sign In
                    </div>
                  </div>
                  <p className="text-center text-xs text-text-tertiary">
                    Powered by NOVA
                  </p>
                </div>
              </div>
              {form.customCss && (
                <div className="border-t border-border bg-surface-secondary px-4 py-2">
                  <p className="text-xs text-text-tertiary">
                    Custom CSS will also be applied on the live login page.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 border-t border-border pt-6">
        <Button
          variant="primary"
          onClick={handleSave}
          loading={updateBranding.isPending}
        >
          <Save className="h-4 w-4" />
          Save Branding
        </Button>
        {saved && <span className="text-sm text-success">Saved!</span>}
        {updateBranding.isError && (
          <span className="text-sm text-danger">
            Failed to save. Please try again.
          </span>
        )}
      </div>
    </div>
  );
}
