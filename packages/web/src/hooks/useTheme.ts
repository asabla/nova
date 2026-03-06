import { useEffect, useCallback } from "react";
import { useUIStore, type ThemeMode, type FontSize, FONT_SIZE_MAP } from "../stores/ui.store";

/**
 * Resolves the effective theme by checking the system preference
 * when the user has selected "system" mode.
 */
function resolveEffectiveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Enhanced theme hook that supports light/dark/system modes with
 * system preference detection, font size control, and DOM synchronization.
 */
export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fontSize = useUIStore((s) => s.fontSize);
  const setFontSize = useUIStore((s) => s.setFontSize);

  // Listen for system color scheme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      // In system mode we don't set data-theme, but we do update color-scheme
      // so the browser knows which scheme is active
      root.style.colorScheme = e.matches ? "dark" : "light";
    };

    // Set initial color-scheme for system mode
    document.documentElement.style.colorScheme = mediaQuery.matches ? "dark" : "light";

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Synchronize data-theme attribute whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
      // Let the browser/media-query handle the scheme
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.style.colorScheme = prefersDark ? "dark" : "light";
    } else {
      root.setAttribute("data-theme", theme);
      root.style.colorScheme = theme;
    }
  }, [theme]);

  // Synchronize font size to the document root
  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZE_MAP[fontSize]}px`;
  }, [fontSize]);

  const effectiveTheme = resolveEffectiveTheme(theme);

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }, [theme, setTheme]);

  return {
    /** The user's chosen mode: "light" | "dark" | "system" */
    theme,
    /** The resolved theme after evaluating system preference */
    effectiveTheme,
    /** Set the theme mode */
    setTheme,
    /** Cycle through light -> dark -> system */
    cycleTheme,
    /** Current font size preset */
    fontSize,
    /** Font size in pixels */
    fontSizePx: FONT_SIZE_MAP[fontSize],
    /** Set font size preset */
    setFontSize,
  };
}
