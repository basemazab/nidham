import { create } from "zustand";

export type SidebarSection = "open" | "collapsed";

interface UIState {
  sidebar: SidebarSection;
  mobileSidebarOpen: boolean;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebar: "open",
  mobileSidebarOpen: false,
  toggleSidebar: () =>
    set((s) => ({
      sidebar: s.sidebar === "open" ? "collapsed" : "open",
    })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
