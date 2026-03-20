import { create } from "zustand";

interface UIState {
  watchlistOpen: boolean;
  shortcutsOpen: boolean;
  toggleWatchlist: () => void;
  toggleShortcuts: () => void;
  closeAll: () => void;
  setWatchlistOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  watchlistOpen: false,
  shortcutsOpen: false,

  toggleWatchlist: () =>
    set((state) => ({
      watchlistOpen: !state.watchlistOpen,
      shortcutsOpen: false,
    })),

  toggleShortcuts: () =>
    set((state) => ({
      shortcutsOpen: !state.shortcutsOpen,
      watchlistOpen: false,
    })),

  closeAll: () => set({ watchlistOpen: false, shortcutsOpen: false }),

  setWatchlistOpen: (open) => set({ watchlistOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
}));
