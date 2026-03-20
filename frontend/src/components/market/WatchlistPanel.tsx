"use client";

import { useState, useEffect, useRef, memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sparkline } from "@/components/charts/Sparkline";
import { useUIStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { usePriceStore } from "@/stores/priceStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  fetchWatchlists,
  addToWatchlist,
  removeFromWatchlist,
  searchMarket,
  fetchSparklines,
} from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { SearchResult } from "@/types";
import Link from "next/link";

export function WatchlistPanel() {
  const { watchlistOpen, setWatchlistOpen } = useUIStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: watchlists } = useQuery({
    queryKey: ["watchlists"],
    queryFn: fetchWatchlists,
    enabled: isAuthenticated && watchlistOpen,
  });

  const defaultWatchlist = watchlists?.[0];
  const symbols = defaultWatchlist?.symbols ?? [];

  useWebSocket({ symbols, enabled: watchlistOpen && symbols.length > 0 });

  const { data: sparklines } = useQuery({
    queryKey: ["sparklines"],
    queryFn: fetchSparklines,
    enabled: watchlistOpen && symbols.length > 0,
    staleTime: 5 * 60_000,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["market-search", debouncedSearch],
    queryFn: () => searchMarket(debouncedSearch),
    enabled: debouncedSearch.length >= 1,
  });

  const addMutation = useMutation({
    mutationFn: (symbol: string) =>
      addToWatchlist(defaultWatchlist!.id, symbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-check"] });
      setSearch("");
      setDebouncedSearch("");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (symbol: string) =>
      removeFromWatchlist(defaultWatchlist!.id, symbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      queryClient.invalidateQueries({ queryKey: ["watchlist-check"] });
    },
  });

  const symbolSet = useMemo(() => new Set(symbols), [symbols]);

  const filteredResults = searchResults?.filter(
    (r: SearchResult) => !symbolSet.has(r.symbol.toUpperCase())
  );

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200"
        style={{
          opacity: watchlistOpen ? 1 : 0,
          pointerEvents: watchlistOpen ? "auto" : "none",
        }}
        role="presentation"
        onClick={() => setWatchlistOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setWatchlistOpen(false); }}
      />

      <div
        ref={panelRef}
        className="fixed right-0 top-12 bottom-0 z-50 w-80 border-l border-border bg-card transition-transform duration-200 ease-out"
        style={{
          transform: watchlistOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[16px] font-bold font-heading text-foreground">
            Watchlist
          </h2>
          <button
            onClick={() => setWatchlistOpen(false)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-[calc(100%-49px)] flex-col">
          {!isAuthenticated ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
              <p className="text-[14px] text-muted-foreground">
                Sign in to create watchlists
              </p>
              <Link
                href="/login"
                onClick={() => setWatchlistOpen(false)}
                className="text-[14px] font-medium text-primary hover:underline"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                {symbols.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-12">
                    <Star className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <p className="text-foreground font-medium text-[14px] mb-1">
                      Watchlist is empty
                    </p>
                    <p className="text-center text-[13px] text-muted-foreground mb-5">
                      Track your favorite symbols with live prices and sparklines.
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {["BTC", "ETH", "AAPL", "TSLA", "NVDA"].map((sym) => (
                        <button
                          key={sym}
                          onClick={() => defaultWatchlist && addMutation.mutate(sym)}
                          disabled={!defaultWatchlist || addMutation.isPending}
                          className="px-2.5 py-1 rounded text-[12px] font-mono font-medium bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          + {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  symbols.map((sym) => (
                    <WatchlistRow
                      key={sym}
                      symbol={sym}
                      sparklineData={sparklines?.[sym]}
                      onRemove={() => removeMutation.mutate(sym)}
                      onClick={() => {
                        router.push(`/market/${sym}`);
                        setWatchlistOpen(false);
                      }}
                    />
                  ))
                )}
              </div>

              <div className="border-t border-border p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Add symbol..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 border-border bg-muted pl-8 text-[13px] text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>

                {debouncedSearch.length >= 1 &&
                  filteredResults &&
                  filteredResults.length > 0 && (
                    <div className="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-border bg-muted">
                      {filteredResults.slice(0, 6).map((r: SearchResult) => (
                        <button
                          key={r.symbol}
                          onClick={() => addMutation.mutate(r.symbol)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-secondary"
                        >
                          <span className="font-mono font-medium text-foreground">
                            {r.symbol}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {r.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const WatchlistRow = memo(function WatchlistRow({
  symbol,
  sparklineData,
  onRemove,
  onClick,
}: {
  symbol: string;
  sparklineData?: number[];
  onRemove: () => void;
  onClick: () => void;
}) {
  const priceData = usePriceStore((s) => s.prices[symbol]);
  const price = priceData?.price;
  const changePct = priceData?.change_percent_24h ?? 0;
  const isPositive = changePct >= 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="group flex w-full items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left transition-colors hover:bg-muted cursor-pointer outline-none focus-visible:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <span className="block font-mono text-[14px] font-bold text-foreground truncate">
          {symbol}
        </span>
      </div>

      {sparklineData && sparklineData.length > 1 && (
        <Sparkline data={sparklineData} width={60} height={24} />
      )}

      <div className="text-right">
        <span className="block font-mono text-[13px] text-foreground">
          {price != null ? formatCurrency(price) : "--"}
        </span>
        <span
          className={`block font-mono text-[11px] ${
            isPositive ? "text-gain" : "text-loss"
          }`}
        >
          {changePct !== 0 ? formatPercent(changePct) : "--"}
        </span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove from watchlist"
        className="ml-1 hidden text-muted-foreground transition-colors hover:text-loss group-hover:block"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});
