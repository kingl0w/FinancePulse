"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import dynamic from "next/dynamic";
import type { LivePrice, IndicatorData } from "@/components/charts/PriceChart";

const PriceChart = dynamic(
  () => import("@/components/charts/PriceChart").then((mod) => mod.PriceChart),
  {
    ssr: false,
    loading: () => <div className="w-full h-[600px] bg-card animate-pulse rounded-lg" />,
  }
);

const ComparisonChart = dynamic(
  () => import("@/components/charts/ComparisonChart").then((mod) => mod.ComparisonChart),
  {
    ssr: false,
    loading: () => <div className="w-full h-[600px] bg-card animate-pulse rounded-lg" />,
  }
);
import { TrendingUp, TrendingDown, Plus, Bell, GitCompareArrows, X, Star } from "lucide-react";
import { fetchQuote, fetchHistory, fetchIndicators, fetchComparison, searchMarket, checkWatchlist, addToWatchlist, removeFromWatchlist, fetchWatchlists } from "@/lib/api";
import { NewsFeed } from "@/components/market/NewsFeed";
import type { SearchResult } from "@/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePriceStore } from "@/stores/priceStore";
import { useAuthStore } from "@/stores/authStore";
import { formatCurrency, formatMarketCap, formatPercent, formatNumber, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const INTRADAY_RANGES = ["1m", "5m", "15m", "30m", "1H"] as const;
const DAILY_RANGES = ["1D", "1W", "1M", "3M", "1Y"] as const;
const ALL_RANGES = [...INTRADAY_RANGES, ...DAILY_RANGES] as const;
type TimeRange = (typeof ALL_RANGES)[number];

const COMPARE_COLORS = ["#818cf8", "#38bdf8", "#fb923c"];

const INDICATOR_OPTIONS = [
  { key: "sma_20", label: "SMA 20", color: "#f0b429" },
  { key: "sma_50", label: "SMA 50", color: "#818cf8" },
  { key: "ema_12", label: "EMA 12", color: "#38bdf8" },
  { key: "ema_26", label: "EMA 26", color: "#fb923c" },
  { key: "rsi_14", label: "RSI", color: "#f0b429" },
  { key: "macd", label: "MACD", color: "#f0b429" },
  { key: "bollinger", label: "Bollinger", color: "#6b6561" },
] as const;

export default function MarketSymbolPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const displaySymbol = symbol.toUpperCase();
  const [range, setRange] = useState<TimeRange>("1M");
  const [activeIndicators, setActiveIndicators] = useState<string[]>(["sma_20"]);
  const [comparisonSymbols, setComparisonSymbols] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSearch, setCompareSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [starAnimating, setStarAnimating] = useState(false);

  const { data: watchlistCheck } = useQuery({
    queryKey: ["watchlist-check", displaySymbol],
    queryFn: () => checkWatchlist(displaySymbol),
    enabled: isAuthenticated,
  });

  const { data: watchlists } = useQuery({
    queryKey: ["watchlists"],
    queryFn: fetchWatchlists,
    enabled: isAuthenticated,
  });

  const defaultWatchlistId = watchlists?.[0]?.id;

  const addToWatchlistMut = useMutation({
    mutationFn: () => addToWatchlist(defaultWatchlistId!, displaySymbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-check", displaySymbol] });
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Added to watchlist");
    },
  });

  const removeFromWatchlistMut = useMutation({
    mutationFn: () =>
      removeFromWatchlist(
        watchlistCheck?.watchlist_id ?? defaultWatchlistId!,
        displaySymbol
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-check", displaySymbol] });
      queryClient.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Removed from watchlist");
    },
  });

  const handleStarClick = () => {
    if (!isAuthenticated) {
      toast.info("Sign in to add to watchlist");
      return;
    }
    setStarAnimating(true);
    setTimeout(() => setStarAnimating(false), 200);
    if (watchlistCheck?.in_watchlist) {
      removeFromWatchlistMut.mutate();
    } else {
      addToWatchlistMut.mutate();
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setRange(detail);
    };
    window.addEventListener("shortcut-timeframe", handler);
    return () => window.removeEventListener("shortcut-timeframe", handler);
  }, []);

  useWebSocket({ symbols: [displaySymbol], enabled: true });
  const livePriceData = usePriceStore((s) => s.prices[displaySymbol]);

  const {
    data: quote,
    isLoading: quoteLoading,
    error: quoteError,
  } = useQuery({
    queryKey: ["quote", displaySymbol],
    queryFn: () => fetchQuote(displaySymbol),
    refetchInterval: 30_000,
    retry: 2,
    retryDelay: 5000,
  });

  const {
    data: candles,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery({
    queryKey: ["history", displaySymbol, range],
    queryFn: () => fetchHistory(displaySymbol, range),
  });

  const { data: indicatorData } = useQuery({
    queryKey: ["indicators", displaySymbol, range, activeIndicators],
    queryFn: () => fetchIndicators(displaySymbol, range, activeIndicators),
    enabled: activeIndicators.length > 0,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(compareSearch), 300);
    return () => clearTimeout(timer);
  }, [compareSearch]);

  const { data: searchResults } = useQuery({
    queryKey: ["market-search", debouncedSearch],
    queryFn: () => searchMarket(debouncedSearch),
    enabled: debouncedSearch.length >= 1,
  });

  const { data: comparisonData, isLoading: comparisonLoading } = useQuery({
    queryKey: ["comparison", displaySymbol, ...comparisonSymbols, range],
    queryFn: () => fetchComparison([displaySymbol, ...comparisonSymbols], range),
    enabled: comparisonSymbols.length > 0,
  });

  const addComparison = useCallback(
    (sym: string) => {
      const upper = sym.toUpperCase();
      if (upper === displaySymbol) return;
      if (comparisonSymbols.includes(upper)) return;
      if (comparisonSymbols.length >= 3) {
        toast.info("Maximum 3 comparison symbols");
        return;
      }
      setComparisonSymbols((prev) => [...prev, upper]);
      setCompareSearch("");
    },
    [displaySymbol, comparisonSymbols]
  );

  const removeComparison = useCallback((sym: string) => {
    setComparisonSymbols((prev) => prev.filter((s) => s !== sym));
  }, []);

  const clearComparisons = useCallback(() => {
    setComparisonSymbols([]);
    setCompareOpen(false);
  }, []);

  const filteredSearchResults = searchResults?.filter(
    (r: SearchResult) =>
      r.symbol.toUpperCase() !== displaySymbol &&
      !comparisonSymbols.includes(r.symbol.toUpperCase())
  );

  const toggleIndicator = (key: string) => {
    setActiveIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const chartLivePrice: LivePrice | undefined = livePriceData
    ? {
        price: livePriceData.price,
        volume: livePriceData.volume,
        timestamp: livePriceData.timestamp,
      }
    : undefined;

  const currentPrice = livePriceData?.price ?? (quote?.price ?? undefined);
  const changePercent = quote?.change_percent_24h ?? 0;
  const isPositive = changePercent >= 0;
  const isStale = quote?.stale === true;
  const error = historyError;
  const assetKind = getAssetKind(displaySymbol, quote?.source);

  function handleAddToPortfolio() {
    if (!isAuthenticated) {
      toast.info("Sign in to use this feature");
      return;
    }
  }

  function handleSetAlert() {
    if (!isAuthenticated) {
      toast.info("Sign in to use this feature");
      return;
    }
  }

  useEffect(() => {
    const priceStr = currentPrice != null
      ? (assetKind === "treasury" ? `${currentPrice.toFixed(3)}%` : formatCurrency(currentPrice))
      : "";
    document.title = priceStr
      ? `${displaySymbol} - ${priceStr} | FinancePulse`
      : `${displaySymbol} | FinancePulse`;
    return () => { document.title = "FinancePulse"; };
  }, [displaySymbol, currentPrice]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-loss">
          Failed to load market data for {displaySymbol}.{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-heading">{displaySymbol}</h1>
            <button
              onClick={handleStarClick}
              className="transition-transform duration-200"
              style={{
                transform: starAnimating ? "scale(1.2)" : "scale(1)",
              }}
              title={watchlistCheck?.in_watchlist ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star
                className={cn(
                  "h-5 w-5 transition-colors",
                  watchlistCheck?.in_watchlist
                    ? "fill-primary text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
              />
            </button>
            {quote ? (
              <Badge
                variant="secondary"
                className="bg-secondary border-secondary text-muted-foreground text-[11px]"
              >
                {quote.source}
              </Badge>
            ) : (
              <Skeleton className="h-5 w-14" />
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            {quoteLoading && !currentPrice ? (
              <>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-5 w-20" />
              </>
            ) : currentPrice != null ? (
              <>
                <LivePriceDisplay price={currentPrice} asYield={assetKind === "treasury"} />
                <span
                  className={cn(
                    "flex items-center gap-1 text-[18px] font-medium font-mono",
                    isPositive ? "text-gain" : "text-loss",
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {formatPercent(changePercent)}
                </span>
                {isStale && (
                  <span className="text-[12px] text-muted-foreground font-mono">stale</span>
                )}
              </>
            ) : (
              <span className="text-[18px] font-mono text-muted-foreground">
                Price temporarily unavailable
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link href="/portfolio">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-secondary bg-card hover:bg-secondary text-foreground text-xs"
                >
                  <Plus className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Add to Portfolio</span>
                </Button>
              </Link>
              <Link href="/alerts">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-secondary bg-card hover:bg-secondary text-foreground text-xs"
                >
                  <Bell className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Set Alert</span>
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-secondary bg-card hover:bg-secondary text-foreground text-xs"
                onClick={handleAddToPortfolio}
              >
                <Plus className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Add to Portfolio</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-secondary bg-card hover:bg-secondary text-foreground text-xs"
                onClick={handleSetAlert}
              >
                <Bell className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Set Alert</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-0.5 overflow-x-auto pb-1 scrollbar-hide">
        {INTRADAY_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[13px] font-medium transition-colors",
              range === r
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r}
          </button>
        ))}
        <div className="shrink-0 w-px h-4 bg-border mx-1.5" />
        {DAILY_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[13px] font-medium transition-colors",
              range === r
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-1.5 flex-wrap overflow-x-auto">
        <span className="text-[12px] text-muted-foreground uppercase tracking-wider mr-1">Indicators</span>
        {INDICATOR_OPTIONS.map((ind) => {
          const active = activeIndicators.includes(ind.key);
          return (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className={cn(
                "px-2.5 py-1 rounded text-[13px] font-mono font-medium transition-all",
                active
                  ? "border text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary bg-transparent",
              )}
              style={active ? { borderColor: ind.color, color: ind.color, backgroundColor: `${ind.color}15` } : undefined}
            >
              {ind.label}
            </button>
          );
        })}

        <div className="w-px h-4 bg-border mx-1" />

        <Popover open={compareOpen} onOpenChange={setCompareOpen}>
          <PopoverTrigger
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[13px] font-medium transition-all",
              comparisonSymbols.length > 0
                ? "border border-primary text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare{comparisonSymbols.length > 0 && ` (${comparisonSymbols.length})`}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-64 bg-card border border-secondary p-0"
          >
            <div className="p-2">
              <Input
                placeholder="Search symbol..."
                value={compareSearch}
                onChange={(e) => setCompareSearch(e.target.value)}
                className="h-8 text-xs bg-muted border-secondary text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
            </div>

            {debouncedSearch.length >= 1 && filteredSearchResults && filteredSearchResults.length > 0 && (
              <div className="max-h-32 overflow-y-auto border-t border-secondary">
                {filteredSearchResults.slice(0, 6).map((r: SearchResult) => (
                  <button
                    key={r.symbol}
                    onClick={() => addComparison(r.symbol)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary transition-colors"
                  >
                    <span className="font-mono font-medium text-foreground">{r.symbol}</span>
                    <span className="text-muted-foreground truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            )}

            {comparisonSymbols.length > 0 && (
              <div className="border-t border-secondary p-2 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Comparing</span>
                {comparisonSymbols.map((sym, i) => (
                  <div key={sym} className="flex items-center justify-between py-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COMPARE_COLORS[i] }}
                      />
                      <span className="text-xs font-mono text-foreground">{sym}</span>
                    </div>
                    <button
                      onClick={() => removeComparison(sym)}
                      className="text-muted-foreground hover:text-loss transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={clearComparisons}
                  className="w-full mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Clear All
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {comparisonSymbols.map((sym, i) => (
          <button
            key={sym}
            onClick={() => removeComparison(sym)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-mono border transition-all hover:opacity-70"
            style={{ borderColor: COMPARE_COLORS[i], color: COMPARE_COLORS[i] }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: COMPARE_COLORS[i] }}
            />
            {sym}
            <X className="h-2.5 w-2.5 ml-0.5" />
          </button>
        ))}
      </div>

      <div className="mt-4">
      {comparisonSymbols.length > 0 ? (
        comparisonLoading ? (
          <Skeleton className="h-[600px] w-full rounded-lg" />
        ) : comparisonData ? (
          <ComparisonChart
            data={comparisonData}
            symbols={[displaySymbol, ...comparisonSymbols]}
            primarySymbol={displaySymbol}
            height={600}
          />
        ) : (
          <div className="flex items-center justify-center h-[600px] rounded-lg border border-secondary bg-card">
            <p className="text-muted-foreground">Loading comparison data...</p>
          </div>
        )
      ) : historyLoading ? (
        <Skeleton className="h-[600px] w-full rounded-lg" />
      ) : candles && candles.length > 0 ? (
        <PriceChart
          symbol={displaySymbol}
          candles={candles}
          height={600}
          range={range}
          livePrice={chartLivePrice}
          indicators={indicatorData?.indicators as IndicatorData | undefined}
          activeIndicators={activeIndicators}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-[600px] rounded-lg border border-secondary bg-card">
          <p className="text-muted-foreground text-[15px]">No data available for this timeframe</p>
          <p className="text-muted-foreground/60 text-[13px] mt-1">Try selecting a different time range above</p>
        </div>
      )}
      </div>

      <div className="mt-4 flex items-center divide-x divide-secondary border border-secondary rounded-lg bg-card overflow-x-auto">
        {assetKind === "treasury" ? (
          <>
            <StatItem
              label="Current Yield"
              value={currentPrice != null ? `${currentPrice.toFixed(3)}%` : "--"}
              loading={quoteLoading}
            />
            <StatItem
              label="24h Change"
              value={
                quote?.change_percent_24h != null
                  ? formatPercent(quote.change_percent_24h)
                  : "--"
              }
              loading={quoteLoading}
              valueClassName={changePercent >= 0 ? "text-gain" : "text-loss"}
            />
            <StatItem
              label="Source"
              value={quote?.source ?? "--"}
              loading={quoteLoading}
              mono={false}
            />
          </>
        ) : (
          <>
            <StatItem
              label="Volume"
              value={quote?.volume != null ? formatNumber(quote.volume) : "--"}
              loading={quoteLoading}
            />
            {assetKind === "index" ? (
              <StatItem label="Type" value="Index" loading={quoteLoading} mono={false} />
            ) : assetKind === "commodity" ? (
              <StatItem label="Type" value="Commodity" loading={quoteLoading} mono={false} />
            ) : (
              <StatItem
                label="Market Cap"
                value={
                  quote?.market_cap != null && quote.market_cap > 0
                    ? formatMarketCap(quote.market_cap)
                    : "--"
                }
                loading={quoteLoading}
              />
            )}
            <StatItem
              label="24h Change"
              value={
                quote?.change_percent_24h != null
                  ? formatPercent(quote.change_percent_24h)
                  : quote?.change_24h != null
                    ? formatCurrency(quote.change_24h)
                    : "--"
              }
              loading={quoteLoading}
              valueClassName={changePercent >= 0 ? "text-gain" : "text-loss"}
            />
            <StatItem
              label="Source"
              value={quote?.source ?? "--"}
              loading={quoteLoading}
              mono={false}
            />
          </>
        )}
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <NewsFeed symbol={displaySymbol} />
      </div>
    </div>
  );
}

type AssetKind = "stock" | "crypto" | "index" | "commodity" | "treasury";

const INDEX_SYMBOLS = new Set(["SP500", "DOW", "NASDAQ", "RUSSELL2000", "VIX", "FTSE", "DAX", "NIKKEI"]);
const COMMODITY_SYMBOLS = new Set(["GOLD", "SILVER", "CRUDE_OIL", "NATURAL_GAS", "COPPER", "PLATINUM"]);
const TREASURY_SYMBOLS = new Set(["US10Y", "US2Y", "US5Y", "US30Y"]);

function getAssetKind(symbol: string, source?: string): AssetKind {
  if (TREASURY_SYMBOLS.has(symbol)) return "treasury";
  if (INDEX_SYMBOLS.has(symbol)) return "index";
  if (COMMODITY_SYMBOLS.has(symbol)) return "commodity";
  if (source === "coinbase") return "crypto";
  return "stock";
}

function LivePriceDisplay({ price, asYield }: { price: number | undefined; asYield?: boolean }) {
  const prevPrice = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (price == null || prevPrice.current == null) {
      prevPrice.current = price;
      return;
    }
    if (price !== prevPrice.current) {
      setFlash(price > prevPrice.current ? "up" : "down");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setFlash(null), 600);
      prevPrice.current = price;
    }
  }, [price]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "text-[24px] sm:text-[32px] font-bold font-mono transition-colors duration-300",
        flash === "up" && "text-gain",
        flash === "down" && "text-loss",
        !flash && "text-foreground",
      )}
    >
      {price != null ? (asYield ? `${price.toFixed(3)}%` : formatCurrency(price)) : "--"}
    </span>
  );
}

function StatItem({
  label,
  value,
  loading,
  valueClassName,
  mono = true,
}: {
  label: string;
  value: string;
  loading: boolean;
  valueClassName?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex-1 min-w-[140px] px-4 py-3">
      <p className="text-[12px] text-muted-foreground mb-0.5">{label}</p>
      {loading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <p
          className={cn(
            "text-[16px] font-semibold truncate",
            mono && "font-mono",
            valueClassName,
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}
