import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

const novaTheme = create({
  base: "dark",

  // Brand
  brandTitle: "NOVA Design System",
  brandUrl: "/",

  // Colors — hex equivalents of NOVA's oklch palette
  // oklch(0.55 0.22 268) → #5B4BDB (primary)
  // oklch(0.58 0.20 268) → #6C5CE7 (primary variant)
  colorPrimary: "#5B4BDB",
  colorSecondary: "#6C5CE7",

  // UI — approximations of dark-mode surface tokens
  // oklch(0.155 0.012 275) → #1a1a2e
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
