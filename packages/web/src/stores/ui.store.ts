import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  commandPaletteOpen: boolean;
  theme: "light" | "dark" | "system";
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleCommandPalette: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      commandPaletteOpen: false,
      theme: "system",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setTheme: (theme) => {
        const root = document.documentElement;
        if (theme === "system") {
          root.removeAttribute("data-theme");
        } else {
          root.setAttribute("data-theme", theme);
        }
        set({ theme });
      },
    }),
    { name: "nova-ui" },
  ),
);
