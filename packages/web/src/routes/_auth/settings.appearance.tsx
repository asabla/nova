import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Monitor, Type } from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "../../hooks/useTheme";
import type { ThemeMode, FontSize } from "../../stores/ui.store";
import { FONT_SIZE_MAP } from "../../stores/ui.store";

export const Route = createFileRoute("/_auth/settings/appearance")({
  component: AppearanceSettings,
});

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  icon: typeof Sun;
  labelKey: string;
  descriptionKey: string;
}> = [
  { value: "light", icon: Sun, labelKey: "settings.light", descriptionKey: "settings.lightDescription" },
  { value: "dark", icon: Moon, labelKey: "settings.dark", descriptionKey: "settings.darkDescription" },
  { value: "system", icon: Monitor, labelKey: "settings.system", descriptionKey: "settings.systemDescription" },
];

const FONT_SIZE_OPTIONS: Array<{
  value: FontSize;
  labelKey: string;
}> = [
  { value: "small", labelKey: "settings.fontSmall" },
  { value: "medium", labelKey: "settings.fontMedium" },
  { value: "large", labelKey: "settings.fontLarge" },
];

/** Color swatches used in the theme preview */
const PREVIEW_SWATCHES = [
  { nameKey: "settings.colorPrimary", name: "Primary", varLight: "oklch(0.585 0.233 277.117)", varDark: "oklch(0.704 0.191 277.117)" },
  { nameKey: "settings.colorSurface", name: "Surface", varLight: "oklch(1 0 0)", varDark: "oklch(0.17 0.01 285)" },
  { nameKey: "settings.colorText", name: "Text", varLight: "oklch(0.14 0 0)", varDark: "oklch(0.95 0 0)" },
  { nameKey: "settings.colorBorder", name: "Border", varLight: "oklch(0.9 0 0)", varDark: "oklch(0.3 0.01 285)" },
  { nameKey: "settings.colorSuccess", name: "Success", varLight: "oklch(0.627 0.194 149.214)", varDark: "oklch(0.627 0.194 149.214)" },
  { nameKey: "settings.colorDanger", name: "Danger", varLight: "oklch(0.577 0.245 27.325)", varDark: "oklch(0.577 0.245 27.325)" },
];

function ThemePreview({ effectiveTheme }: { effectiveTheme: "light" | "dark" }) {
  const isDark = effectiveTheme === "dark";

  return (
    <div
      className={clsx(
        "rounded-xl border-2 border-border p-4 transition-colors",
        isDark ? "bg-[oklch(0.17_0.01_285)]" : "bg-white",
      )}
      aria-hidden="true"
    >
      {/* Mock UI preview */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: isDark ? "oklch(0.577 0.245 27.325)" : "oklch(0.577 0.245 27.325)" }}
        />
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: isDark ? "oklch(0.769 0.188 70.08)" : "oklch(0.769 0.188 70.08)" }}
        />
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: isDark ? "oklch(0.627 0.194 149.214)" : "oklch(0.627 0.194 149.214)" }}
        />
      </div>
      <div className="space-y-2">
        <div
          className="h-2 rounded"
          style={{
            backgroundColor: isDark ? "oklch(0.95 0 0)" : "oklch(0.14 0 0)",
            width: "75%",
            opacity: 0.7,
          }}
        />
        <div
          className="h-2 rounded"
          style={{
            backgroundColor: isDark ? "oklch(0.7 0 0)" : "oklch(0.45 0 0)",
            width: "50%",
            opacity: 0.5,
          }}
        />
        <div
          className="h-6 rounded mt-3"
          style={{ backgroundColor: "oklch(0.585 0.233 277.117)", width: "40%" }}
        />
      </div>
    </div>
  );
}

function ColorSwatches({ effectiveTheme }: { effectiveTheme: "light" | "dark" }) {
  const { t } = useTranslation();
  const isDark = effectiveTheme === "dark";

  return (
    <div role="group" aria-label={t("settings.colorSchemePreview")}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PREVIEW_SWATCHES.map((swatch) => (
          <div key={swatch.name} className="flex flex-col items-center gap-1">
            <div
              className="w-10 h-10 rounded-lg border border-border shadow-sm transition-colors"
              style={{ backgroundColor: isDark ? swatch.varDark : swatch.varLight }}
              title={t(swatch.nameKey, swatch.name)}
            />
            <span className="text-xs text-text-tertiary">{t(swatch.nameKey, swatch.name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { t } = useTranslation();
  const { theme, effectiveTheme, setTheme, fontSize, fontSizePx, setFontSize } = useTheme();

  const handleThemeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = THEME_OPTIONS.findIndex((o) => o.value === theme);
      let nextIndex = currentIndex;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
      } else {
        return;
      }

      setTheme(THEME_OPTIONS[nextIndex].value);
      // Focus the newly selected radio button
      const container = e.currentTarget;
      const buttons = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons[nextIndex]?.focus();
    },
    [theme, setTheme],
  );

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Theme Selection */}
      <fieldset>
        <legend id="theme-legend" className="text-sm font-medium text-text mb-1">
          {t("settings.theme")}
        </legend>
        <p className="text-sm text-text-secondary mb-3" id="theme-description">
          {t("settings.themeDescription")}
        </p>
        <div
          className="grid grid-cols-3 gap-3 max-w-md"
          role="radiogroup"
          aria-labelledby="theme-legend"
          aria-describedby="theme-description"
          onKeyDown={handleThemeKeyDown}
        >
          {THEME_OPTIONS.map(({ value, icon: Icon, labelKey, descriptionKey }) => (
            <button
              key={value}
              role="radio"
              aria-checked={theme === value}
              aria-label={t(labelKey)}
              tabIndex={theme === value ? 0 : -1}
              onClick={() => setTheme(value)}
              className={clsx(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                theme === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border-strong bg-surface-secondary",
              )}
            >
              <Icon
                className={clsx(
                  "h-5 w-5",
                  theme === value ? "text-primary" : "text-text-secondary",
                )}
                aria-hidden="true"
              />
              <span
                className={clsx(
                  "text-sm",
                  theme === value ? "text-primary font-medium" : "text-text-secondary",
                )}
              >
                {t(labelKey)}
              </span>
              <span className="text-xs text-text-tertiary text-center">
                {t(descriptionKey)}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Theme Preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text">
          {t("settings.preview")}
        </h3>
        <ThemePreview effectiveTheme={effectiveTheme} />
        <ColorSwatches effectiveTheme={effectiveTheme} />
      </div>

      {/* Font Size */}
      <fieldset>
        <legend className="text-sm font-medium text-text mb-1">
          <span className="flex items-center gap-2">
            <Type className="h-4 w-4" aria-hidden="true" />
            {t("settings.fontSize")}
          </span>
        </legend>
        <p className="text-sm text-text-secondary mb-3" id="fontsize-description">
          {t("settings.fontSizeDescription")}
        </p>

        <div className="max-w-md space-y-4">
          {/* Slider */}
          <div className="flex items-center gap-4">
            <label htmlFor="font-size-slider" className="sr-only">
              {t("settings.fontSize")}
            </label>
            <span className="text-xs text-text-secondary w-6 text-right" aria-hidden="true">
              A
            </span>
            <input
              id="font-size-slider"
              type="range"
              min={0}
              max={2}
              step={1}
              value={FONT_SIZE_OPTIONS.findIndex((o) => o.value === fontSize)}
              onChange={(e) => setFontSize(FONT_SIZE_OPTIONS[Number(e.target.value)].value)}
              className="flex-1 accent-primary h-2 cursor-pointer"
              aria-valuetext={`${t(FONT_SIZE_OPTIONS.find((o) => o.value === fontSize)?.labelKey ?? "settings.fontMedium")} (${fontSizePx}px)`}
              aria-describedby="fontsize-description"
            />
            <span className="text-lg text-text-secondary w-6" aria-hidden="true">
              A
            </span>
          </div>

          {/* Segment buttons */}
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label={t("settings.fontSize")}
          >
            {FONT_SIZE_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                role="radio"
                aria-checked={fontSize === value}
                onClick={() => setFontSize(value)}
                className={clsx(
                  "flex-1 py-2 px-3 rounded-lg text-sm border transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  fontSize === value
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border hover:border-border-strong bg-surface-secondary text-text-secondary",
                )}
              >
                {t(labelKey)} ({FONT_SIZE_MAP[value]}px)
              </button>
            ))}
          </div>

          {/* Live preview text */}
          <div
            className="p-4 rounded-lg bg-surface-secondary border border-border"
            aria-label={t("settings.fontSizePreview")}
          >
            <p
              className="text-text transition-all"
              style={{ fontSize: `${fontSizePx}px` }}
            >
              {t("settings.fontSizePreviewText")}
            </p>
            <p
              className="text-text-secondary mt-1 transition-all"
              style={{ fontSize: `${fontSizePx - 2}px` }}
            >
              {t("settings.fontSizePreviewSecondary")}
            </p>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
