import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";

export const FONT_SIZE_MAP: Record<FontSize, number> = {
  small: 14,
  medium: 16,
  large: 18,
};

interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  commandPaletteOpen: boolean;
  shortcutsHelpOpen: boolean;
  theme: ThemeMode;
  fontSize: FontSize;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleShortcutsHelp: () => void;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: FontSize) => void;
}

function applyThemeToDOM(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

function applyFontSizeToDOM(size: FontSize) {
  document.documentElement.style.fontSize = `${FONT_SIZE_MAP[size]}px`;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      commandPaletteOpen: false,
      shortcutsHelpOpen: false,
      theme: "system",
      fontSize: "medium",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleShortcutsHelp: () => set((s) => ({ shortcutsHelpOpen: !s.shortcutsHelpOpen })),
      setTheme: (theme) => {
        applyThemeToDOM(theme);
        set({ theme });
      },
      setFontSize: (size) => {
        applyFontSizeToDOM(size);
        set({ fontSize: size });
      },
    }),
    {
      name: "nova-ui",
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDOM(state.theme);
          applyFontSizeToDOM(state.fontSize);
        }
      },
    },
  ),
);
