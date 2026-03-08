import { definePreview, type Renderer } from "@storybook/react-vite";
import addonThemes, { withThemeByDataAttribute } from "@storybook/addon-themes";

import "../src/styles/app.css";

export default definePreview({
  addons: [addonThemes()],
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
  ],
});
