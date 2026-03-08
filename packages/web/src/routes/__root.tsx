import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { GlobalShortcuts } from "../components/GlobalShortcuts";
import { ShortcutsHelpOverlay } from "../components/ui/ShortcutsHelpOverlay";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { NotFound } from "../components/NotFound";
import { ToastContainer } from "../components/ui/Toast";
import { api } from "../lib/api";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function BrandingInjector() {
  const { data: settings } = useQuery({
    queryKey: ["org-settings-branding"],
    queryFn: () => api.get<any>("/api/org/settings").catch(() => null),
    staleTime: 300_000,
    retry: false,
  });

  useEffect(() => {
    if (!settings) return;
    const branding = settings.branding ?? settings;

    // Inject custom CSS
    const customCss = branding.customCss ?? branding.custom_css;
    if (customCss) {
      let styleEl = document.getElementById("nova-custom-css") as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "nova-custom-css";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = customCss;
    }

    // Inject primary color as CSS variable
    const primaryColor = branding.primaryColor ?? branding.primary_color;
    if (primaryColor) {
      document.documentElement.style.setProperty("--color-primary", primaryColor);
    }

    // Inject favicon
    const faviconUrl = branding.faviconUrl ?? branding.favicon_url;
    if (faviconUrl) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [settings]);

  return null;
}

function RootLayout() {
  return (
    <ErrorBoundary>
      <BrandingInjector />
      <GlobalShortcuts />
      <Outlet />
      <ShortcutsHelpOverlay />
      <ToastContainer />
    </ErrorBoundary>
  );
}
