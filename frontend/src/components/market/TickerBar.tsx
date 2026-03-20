"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePriceStore } from "@/stores/priceStore";
import { fetchTrending, type TrendingAsset } from "@/lib/api";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

const TICKER_SYMBOLS = [
  "SP500", "DOW", "NASDAQ",
  "BTC", "ETH", "SOL",
  "GOLD", "CRUDE_OIL", "US10Y",
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA",
];

const TREASURY_SYMBOLS = new Set(["US10Y", "US2Y", "US5Y", "US30Y"]);

function TickerItem({
  symbol,
  trendingPrice,
}: {
  symbol: string;
  trendingPrice?: { price: number | null; change: number | null };
}) {
  const wsPrice = usePriceStore((s) => s.prices[symbol]?.price);
  const wsPct = usePriceStore((s) => s.prices[symbol]?.change_percent_24h);

  const price = wsPrice ?? trendingPrice?.price ?? null;
  const pct = wsPct ?? trendingPrice?.change ?? null;

  const isPositive = (pct ?? 0) >= 0;
  const isFlat = pct == null || pct === 0;
  const isTreasury = TREASURY_SYMBOLS.has(symbol);

  return (
    <Link
      href={`/market/${symbol}`}
      className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap hover:text-primary transition-colors"
    >
      <span className="font-mono font-semibold text-foreground text-[12px]">{symbol}</span>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isFlat ? "bg-muted-foreground" : isPositive ? "bg-gain" : "bg-loss",
        )}
      />
      <span className={cn(
        "font-mono text-[12px]",
        price != null ? "text-foreground" : "text-muted-foreground/50",
      )}>
        {price != null
          ? isTreasury ? `${price.toFixed(3)}%` : formatCurrency(price)
          : "—"}
      </span>
      {pct != null && (
        <span
          className={cn(
            "font-mono font-medium text-[12px]",
            isPositive ? "text-gain" : "text-loss",
          )}
        >
          {isPositive ? "▲" : "▼"} {formatPercent(pct)}
        </span>
      )}
    </Link>
  );
}

export function TickerBar() {
  useWebSocket({ symbols: TICKER_SYMBOLS, enabled: true });

  const { data: trending } = useQuery({
    queryKey: ["ticker-prices"],
    queryFn: fetchTrending,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const trendingMap = useMemo(() => {
    const map: Record<string, { price: number | null; change: number | null }> = {};
    trending?.forEach((a: TrendingAsset) => {
      map[a.symbol] = { price: a.price, change: a.change_percent_24h };
    });
    return map;
  }, [trending]);

  const items = TICKER_SYMBOLS.map((symbol) => (
    <span key={symbol} className="inline-flex items-center gap-8 shrink-0">
      <TickerItem symbol={symbol} trendingPrice={trendingMap[symbol]} />
      <span className="text-muted-foreground text-[10px] select-none">·</span>
    </span>
  ));

  return (
    <div className="h-8 border-b border-[#1c1c1c] bg-black overflow-hidden flex items-center">
      <div
        className="ticker-animate flex items-center gap-8 whitespace-nowrap h-full"
        style={{ width: "max-content" }}
      >
        <span className="inline-flex items-center gap-8 shrink-0">{items}</span>
        <span className="inline-flex items-center gap-8 shrink-0" aria-hidden>{items}</span>
      </div>
    </div>
  );
}
