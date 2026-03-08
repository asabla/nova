import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

const novaTheme = create({
  base: "dark",

  // Brand
  brandTitle: "NOVA Design System",
  brandUrl: "/",

  // Colors — derived from NOVA's oklch palette
  colorPrimary: "#5B4BDB",
  colorSecondary: "#6C5CE7",

  // UI
  appBg: "#1a1a2e",
  appContentBg: "#16162a",
  appPreviewBg: "#0f0f1e",
  appBorderColor: "#2d2d50",
  appBorderRadius: 12,

  // Text
  textColor: "#e8e6f0",
  textInverseColor: "#1a1a2e",
  textMutedColor: "#9590b0",

  // Toolbar
  barTextColor: "#9590b0",
  barSelectedColor: "#a78bfa",
  barHoverColor: "#c4b5fd",
  barBg: "#16162a",

  // Form
  inputBg: "#1a1a2e",
  inputBorder: "#2d2d50",
  inputTextColor: "#e8e6f0",
  inputBorderRadius: 8,

  // Fonts
  fontBase: '"DM Sans", system-ui, -apple-system, sans-serif',
  fontCode: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
});

addons.setConfig({
  theme: novaTheme,
  sidebar: {
    showRoots: true,
  },
});
