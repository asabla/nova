import React from "react";
import { definePreview, type Renderer } from "@storybook/react-vite";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@fontsource-variable/dm-sans";
import "@fontsource-variable/dm-sans/wght-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "../src/styles/app.css";
import "../src/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export default definePreview({
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    layout: "centered",
    backgrounds: { disable: true },
  },
  decorators: [
    withThemeByDataAttribute<Renderer>({
      themes: {
        Light: "light",
        Dark: "dark",
      },
      defaultTheme: "Light",
      parentSelector: "html",
      attributeName: "data-theme",
    }),
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
});
