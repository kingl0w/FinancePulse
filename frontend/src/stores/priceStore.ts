import { create } from "zustand";
import type { PriceUpdate } from "@/types";

interface PriceState {
  prices: Record<string, PriceUpdate>;
  subscribedSymbols: string[];
  setPrice: (symbol: string, update: PriceUpdate) => void;
  getPrice: (symbol: string) => PriceUpdate | undefined;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
}

export const usePriceStore = create<PriceState>((set, get) => ({
  prices: {},
  subscribedSymbols: [],

  setPrice: (symbol, update) =>
    set((state) => ({
      prices: { ...state.prices, [symbol]: update },
    })),

  getPrice: (symbol) => get().prices[symbol],

  subscribe: (symbols) =>
    set((state) => ({
      subscribedSymbols: [
        ...new Set([...state.subscribedSymbols, ...symbols]),
      ],
    })),

  unsubscribe: (symbols) =>
    set((state) => ({
      subscribedSymbols: state.subscribedSymbols.filter(
        (s) => !symbols.includes(s)
      ),
    })),
}));
