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
  omniBarOpen: boolean;
  omniBarQuery: string;
  shortcutsHelpOpen: boolean;
  theme: ThemeMode;
  fontSize: FontSize;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setOmniBarOpen: (open: boolean) => void;
  setOmniBarQuery: (query: string) => void;
  toggleOmniBar: () => void;
  /** @deprecated Use toggleOmniBar instead */
  toggleCommandPalette: () => void;
  /** @deprecated Use setOmniBarOpen instead */
  setCommandPaletteOpen: (open: boolean) => void;
  /** @deprecated Use omniBarOpen instead */
  commandPaletteOpen: boolean;
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
    (set, get) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      omniBarOpen: false,
      omniBarQuery: "",
      shortcutsHelpOpen: false,
      theme: "system",
      fontSize: "medium",
      // Backward compat getter
      get commandPaletteOpen() {
        return get().omniBarOpen;
      },
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setOmniBarOpen: (open) => set({ omniBarOpen: open, omniBarQuery: open ? get().omniBarQuery : "" }),
      setOmniBarQuery: (query) => set({ omniBarQuery: query }),
      toggleOmniBar: () => set((s) => ({ omniBarOpen: !s.omniBarOpen, omniBarQuery: s.omniBarOpen ? "" : s.omniBarQuery })),
      toggleCommandPalette: () => set((s) => ({ omniBarOpen: !s.omniBarOpen, omniBarQuery: s.omniBarOpen ? "" : s.omniBarQuery })),
      setCommandPaletteOpen: (open) => set({ omniBarOpen: open, omniBarQuery: open ? get().omniBarQuery : "" }),
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
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
        fontSize: state.fontSize,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDOM(state.theme);
          applyFontSizeToDOM(state.fontSize);
        }
      },
    },
  ),
);
