"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import dynamic from "next/dynamic";
import type { LivePrice, IndicatorData } from "@/components/charts/PriceChart";

const PriceChart = dynamic(
  () => import("@/components/charts/PriceChart").then((mod) => mod.PriceChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);
import { fetchHistory, fetchIndicators, searchMarket } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePriceStore } from "@/stores/priceStore";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { SearchResult, HistoricalCandle } from "@/types";

const INTRADAY_RANGES = ["1m", "5m", "15m", "30m", "1H"] as const;
const DAILY_RANGES = ["1D", "1W", "1M", "3M", "1Y"] as const;
const ALL_RANGES = [...INTRADAY_RANGES, ...DAILY_RANGES] as const;
type TimeRange = (typeof ALL_RANGES)[number];

const INDICATOR_TOGGLES = [
  { key: "sma_20", label: "SMA" },
  { key: "ema_12", label: "EMA" },
  { key: "rsi_14", label: "RSI" },
  { key: "bollinger", label: "BB" },
] as const;

interface ChartCellProps {
  defaultSymbol: string;
  onSymbolChange?: (symbol: string) => void;
  onClose?: () => void;
}

export function ChartCell({ defaultSymbol, onSymbolChange, onClose }: ChartCellProps) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [range, setRange] = useState<TimeRange>("1M");
  const [activeIndicators, setActiveIndicators] = useState<string[]>(["sma_20"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useWebSocket({ symbols: [symbol], enabled: true });
  const livePriceData = usePriceStore((s) => s.prices[symbol]);

  const { data: candles, isLoading } = useQuery({
    queryKey: ["history", symbol, range],
    queryFn: () => fetchHistory(symbol, range),
  });

  const { data: indicatorData } = useQuery({
    queryKey: ["indicators", symbol, range, activeIndicators],
    queryFn: () => fetchIndicators(symbol, range, activeIndicators),
    enabled: activeIndicators.length > 0,
  });

  const chartLivePrice: LivePrice | undefined = livePriceData
    ? { price: livePriceData.price, volume: livePriceData.volume, timestamp: livePriceData.timestamp }
    : undefined;

  const toggleIndicator = useCallback((key: string) => {
    setActiveIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleSearchInput = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 1) {
      setResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchMarket(q);
        setResults(res.slice(0, 6));
      } catch {
        setResults([]);
      }
    }, 200);
  }, []);

  const selectSymbol = useCallback((sym: string) => {
    setSymbol(sym);
    setSearchQuery("");
    setSearchFocused(false);
    setResults([]);
    onSymbolChange?.(sym);
  }, [onSymbolChange]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
        setSearchQuery("");
        setResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setSymbol(defaultSymbol);
  }, [defaultSymbol]);

  const currentPrice = livePriceData?.price;
  const changePercent = livePriceData?.change_percent_24h ?? 0;

  return (
    <div className="flex flex-col bg-background border border-border overflow-hidden h-full">
      <div className="flex items-center gap-1 h-8 px-2 bg-card border-b border-border shrink-0">
        <div ref={searchRef} className="relative">
          {searchFocused ? (
            <input
              ref={inputRef}
              autoFocus
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onBlur={() => {
                setTimeout(() => {
                  if (!searchRef.current?.contains(document.activeElement)) {
                    setSearchFocused(false);
                    setSearchQuery("");
                    setResults([]);
                  }
                }, 150);
              }}
              placeholder="Search..."
              className="h-5 w-20 bg-transparent border-b border-primary text-primary text-[13px] font-mono outline-none placeholder:text-muted-foreground/60"
            />
          ) : (
            <button
              onClick={() => setSearchFocused(true)}
              className="flex items-center gap-1 text-[13px] font-mono text-foreground hover:text-primary transition-colors"
            >
              <Search className="h-3 w-3 text-muted-foreground" />
              {symbol}
            </button>
          )}

          {searchFocused && results.length > 0 && (
            <div className="absolute top-6 left-0 z-50 w-48 bg-card border border-border rounded shadow-lg">
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSymbol(r.symbol)}
                  className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-secondary flex items-center justify-between transition-colors"
                >
                  <span className="font-mono text-foreground">{r.symbol}</span>
                  <span className="text-muted-foreground truncate ml-2 text-[11px]">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {currentPrice != null && (
          <span className="text-[11px] font-mono text-foreground ml-1">
            {formatCurrency(currentPrice)}
            {changePercent !== 0 && (
              <span className={cn("ml-1", changePercent >= 0 ? "text-gain" : "text-loss")}>
                {formatPercent(changePercent)}
              </span>
            )}
          </span>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          {INTRADAY_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                range === r ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
          <div className="w-px h-3 bg-border mx-0.5" />
          {DAILY_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                range === r ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 h-6 px-2 bg-card border-b border-border shrink-0">
        {INDICATOR_TOGGLES.map((ind) => {
          const active = activeIndicators.includes(ind.key);
          return (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-mono font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {ind.label}
            </button>
          );
        })}
      </div>

      <ChartArea
        symbol={symbol}
        candles={candles}
        isLoading={isLoading}
        range={range}
        livePrice={chartLivePrice}
        indicators={indicatorData?.indicators as IndicatorData | undefined}
        activeIndicators={activeIndicators}
      />
    </div>
  );
}

function ChartArea({
  symbol,
  candles,
  isLoading,
  range,
  livePrice,
  indicators,
  activeIndicators,
}: {
  symbol: string;
  candles: HistoricalCandle[] | undefined;
  isLoading: boolean;
  range: string;
  livePrice: LivePrice | undefined;
  indicators: IndicatorData | undefined;
  activeIndicators: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(300);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.floor(entry.contentRect.height);
        if (h > 0) setChartHeight(h);
      }
    });
    observer.observe(el);
    setChartHeight(el.clientHeight || 300);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="space-y-2 w-3/4">
            <div className="h-1 bg-border rounded animate-pulse" />
            <div className="h-1 bg-border rounded animate-pulse w-4/5" />
            <div className="h-1 bg-border rounded animate-pulse w-3/5" />
            <p className="text-[11px] text-muted-foreground text-center mt-4 font-mono">Loading {symbol}...</p>
          </div>
        </div>
      ) : (
        <PriceChart
          symbol={symbol}
          candles={candles}
          height={chartHeight}
          range={range}
          livePrice={livePrice}
          indicators={indicators}
          activeIndicators={activeIndicators}
        />
      )}
    </div>
  );
}
