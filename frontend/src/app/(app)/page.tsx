"use client";

import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ChevronUp, ChevronDown, Search } from "lucide-react";
import { fetchTrending, fetchSparklines, fetchCurrencies, type TrendingAsset, type CurrencyEntry } from "@/lib/api";
import { Sparkline } from "@/components/charts/Sparkline";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePriceStore } from "@/stores/priceStore";
import { formatCurrency, formatPercent, formatNumber, formatMarketCap, cn } from "@/lib/utils";

type FilterTab = "all" | "stocks" | "crypto" | "indices" | "etfs" | "commodities" | "currencies";
type SortColumn = "name" | "price" | "change" | "volume" | "market_cap" | "type";
type SortDirection = "asc" | "desc";

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export default function MarketDashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortState>({ column: "market_cap", direction: "desc" });

  const { data: trending, isLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    refetchInterval: 60_000,
  });

  const { data: sparklines } = useQuery({
    queryKey: ["sparklines"],
    queryFn: fetchSparklines,
    refetchInterval: 600_000,
    staleTime: 300_000,
  });

  const { data: currencies, isLoading: currenciesLoading } = useQuery({
    queryKey: ["currencies"],
    queryFn: fetchCurrencies,
    refetchInterval: 300_000,
    staleTime: 120_000,
    enabled: filter === "currencies",
  });

  const symbols = useMemo(
    () => trending?.map((a) => a.symbol) ?? [],
    [trending],
  );

  useWebSocket({ symbols, enabled: symbols.length > 0 });

  useEffect(() => {
    document.title = "Market Dashboard | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const filtered = useMemo(() => {
    if (!trending) return [];
    switch (filter) {
      case "all": return trending;
      case "stocks": return trending.filter((a) => a.asset_type === "stock");
      case "crypto": return trending.filter((a) => a.asset_type === "crypto");
      case "indices": return trending.filter((a) => a.asset_type === "index");
      case "etfs": return trending.filter((a) => a.asset_type === "etf");
      case "commodities": return trending.filter((a) => a.asset_type === "commodity" || a.asset_type === "bonds");
      case "currencies": return [];
    }
  }, [trending, filter]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    const { column, direction } = sort;
    const dir = direction === "asc" ? 1 : -1;

    items.sort((a, b) => {
      switch (column) {
        case "name":
          return dir * a.symbol.localeCompare(b.symbol);
        case "price":
          return dir * ((a.price ?? 0) - (b.price ?? 0));
        case "change":
          return dir * ((a.change_percent_24h ?? 0) - (b.change_percent_24h ?? 0));
        case "volume":
          return dir * ((a.volume ?? 0) - (b.volume ?? 0));
        case "market_cap":
          return dir * ((a.market_cap ?? 0) - (b.market_cap ?? 0));
        case "type":
          return dir * a.asset_type.localeCompare(b.asset_type);
        default:
          return 0;
      }
    });
    return items;
  }, [filtered, sort]);

  const tabCounts = useMemo(() => {
    if (!trending) return {} as Record<string, number>;
    const counts: Record<string, number> = {
      all: trending.length,
      stocks: 0,
      crypto: 0,
      indices: 0,
      etfs: 0,
      commodities: 0,
      currencies: currencies?.length ?? 0,
    };
    for (const a of trending) {
      switch (a.asset_type) {
        case "stock": counts.stocks++; break;
        case "crypto": counts.crypto++; break;
        case "index": counts.indices++; break;
        case "etf": counts.etfs++; break;
        case "commodity":
        case "bonds": counts.commodities++; break;
      }
    }
    return counts;
  }, [trending, currencies]);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "desc" ? "asc" : "desc",
    }));
  }, []);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "stocks", label: "Stocks" },
    { key: "crypto", label: "Crypto" },
    { key: "indices", label: "Indices" },
    { key: "etfs", label: "ETFs" },
    { key: "commodities", label: "Commodities" },
    { key: "currencies", label: "Currencies" },
  ];

  return (
    <div className="text-foreground">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                filter === tab.key
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}{tabCounts[tab.key] ? ` (${tabCounts[tab.key]})` : ""}
            </button>
          ))}
        </div>

        {filter === "currencies" ? (
          <CurrenciesTable currencies={currencies} isLoading={currenciesLoading} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-border text-[13px] uppercase tracking-[0.05em]">
                    <th className="text-left py-2.5 px-3 font-medium w-10 text-muted-foreground">#</th>
                    <SortHeader label="Name" column="name" sort={sort} onSort={handleSort} align="left" />
                    <SortHeader label="Price" column="price" sort={sort} onSort={handleSort} />
                    <SortHeader label="24h %" column="change" sort={sort} onSort={handleSort} />
                    <SortHeader label="Volume" column="volume" sort={sort} onSort={handleSort} className="hidden md:table-cell" />
                    <SortHeader label="Market Cap" column="market_cap" sort={sort} onSort={handleSort} className="hidden md:table-cell" />
                    <th className="text-right py-2.5 px-3 font-medium hidden sm:table-cell text-muted-foreground">
                      7d
                    </th>
                    <SortHeader label="Type" column="type" sort={sort} onSort={handleSort} className="hidden lg:table-cell" />
                    <th className="text-right py-2.5 px-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="py-2 px-3"><Skeleton className="h-4 w-4" /></td>
                          <td className="py-2 px-3"><Skeleton className="h-4 w-24" /></td>
                          <td className="py-2 px-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                          <td className="py-2 px-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="py-2 px-3 hidden md:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="py-2 px-3 hidden md:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          <td className="py-2 px-3 hidden sm:table-cell"><Skeleton className="h-8 w-[120px] ml-auto" /></td>
                          <td className="py-2 px-3 hidden lg:table-cell"><Skeleton className="h-4 w-12 ml-auto" /></td>
                          <td className="py-2 px-3"><Skeleton className="h-4 w-4 ml-auto" /></td>
                        </tr>
                      ))
                    : sorted.map((asset, idx) => (
                        <MarketRow
                          key={asset.symbol}
                          asset={asset}
                          index={idx + 1}
                          sparklineData={sparklines?.[asset.symbol]}
                          onClick={() => router.push(`/market/${asset.symbol}`)}
                        />
                      ))}
                </tbody>
              </table>
            </div>

            {!isLoading && sorted.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-foreground font-medium text-[14px] mb-1">
                  No assets in this category
                </p>
                <p className="text-muted-foreground text-[13px]">
                  Try selecting a different filter above, or search for a specific symbol.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = "right",
  className = "",
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSort: (col: SortColumn) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.column === column;
  return (
    <th
      className={cn(
        "py-2.5 px-3 font-medium",
        align === "left" ? "text-left" : "text-right",
        className,
      )}
    >
      <button
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-0.5 select-none cursor-pointer group transition-colors",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {active ? (
          sort.direction === "desc" ? (
            <ChevronDown className="h-3 w-3 text-foreground" />
          ) : (
            <ChevronUp className="h-3 w-3 text-foreground" />
          )
        ) : (
          <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </button>
    </th>
  );
}

const MarketRow = memo(function MarketRow({
  asset,
  index,
  sparklineData,
  onClick,
}: {
  asset: TrendingAsset;
  index: number;
  sparklineData?: number[];
  onClick: () => void;
}) {
  const livePrice = usePriceStore((s) => s.prices[asset.symbol]?.price);
  const liveVolume = usePriceStore((s) => s.prices[asset.symbol]?.volume);

  const price = livePrice ?? asset.price;
  const change = asset.change_percent_24h ?? 0;
  const isPositive = change >= 0;
  const volume = liveVolume ?? asset.volume;

  return (
    <tr
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      tabIndex={0}
      role="link"
      className="group border-b border-border cursor-pointer hover:bg-card focus-visible:bg-card duration-150 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
    >
      <td className="py-2.5 px-3 text-muted-foreground font-mono text-[14px]">{index}</td>
      <td className="py-2.5 px-3">
        <div>
          <span className="font-mono font-bold text-[15px] text-foreground">{asset.symbol}</span>
          <span className="block text-[13px] text-muted-foreground leading-tight">
            {asset.name}
          </span>
        </div>
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-[15px] text-foreground">
        {price != null ? formatCurrency(price) : "--"}
      </td>
      <td
        className={cn(
          "py-2.5 px-3 text-right font-mono text-[14px] font-medium",
          isPositive ? "text-gain" : "text-loss",
        )}
      >
        {isPositive ? "▲" : "▼"} {formatPercent(change)}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-[14px] text-muted-foreground hidden md:table-cell">
        {volume != null ? formatNumber(volume) : "--"}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-[14px] text-muted-foreground hidden md:table-cell">
        {asset.market_cap != null ? formatMarketCap(asset.market_cap) : "--"}
      </td>
      <td className="py-2.5 px-3 text-right hidden sm:table-cell">
        {sparklineData && sparklineData.length >= 2 ? (
          <Sparkline data={sparklineData} width={120} height={32} />
        ) : (
          <span className="inline-block w-[120px] text-center text-muted-foreground/40 text-[12px] font-mono">—</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right hidden lg:table-cell">
        <span
          className={cn(
            "text-[12px] px-1.5 py-0.5 rounded",
            asset.asset_type === "crypto" && "bg-primary/10 text-primary",
            asset.asset_type === "stock" && "bg-[#38bdf8]/10 text-[#38bdf8]",
            asset.asset_type === "index" && "bg-[#60a5fa]/10 text-[#60a5fa]",
            asset.asset_type === "etf" && "bg-[#818cf8]/10 text-[#818cf8]",
            asset.asset_type === "commodity" && "bg-[#fb923c]/10 text-[#fb923c]",
            asset.asset_type === "bonds" && "bg-[#9ca3af]/10 text-[#9ca3af]",
          )}
        >
          {asset.asset_type}
        </span>
      </td>
      <td className="py-2.5 px-3 text-right">
        <ChevronRight className="h-4 w-4 text-foreground opacity-0 group-hover:opacity-100 transition-opacity inline-block" />
      </td>
    </tr>
  );
});

function CurrenciesTable({
  currencies,
  isLoading,
}: {
  currencies?: CurrencyEntry[];
  isLoading: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-[13px] uppercase tracking-[0.05em]">
            <th className="text-left py-2.5 px-3 font-medium w-10">#</th>
            <th className="text-left py-2.5 px-3 font-medium">Pair</th>
            <th className="text-right py-2.5 px-3 font-medium">Rate</th>
            <th className="text-right py-2.5 px-3 font-medium">24h Change</th>
            <th className="text-right py-2.5 px-3 font-medium">Direction</th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-2 px-3"><Skeleton className="h-4 w-4" /></td>
                  <td className="py-2 px-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="py-2 px-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  <td className="py-2 px-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="py-2 px-3"><Skeleton className="h-4 w-12 ml-auto" /></td>
                </tr>
              ))
            : currencies?.map((c, idx) => {
                const changePct = c.change_pct ?? 0;
                const isPositive = changePct >= 0;
                return (
                  <tr key={c.pair} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="py-2.5 px-3 text-muted-foreground font-mono text-[14px]">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-[15px] text-foreground">{c.pair}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[15px] text-foreground">
                      {c.rate.toFixed(c.rate > 100 ? 2 : 4)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 px-3 text-right font-mono text-[14px] font-medium",
                        isPositive ? "text-gain" : "text-loss",
                      )}
                    >
                      {isPositive ? "+" : ""}{changePct.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={cn(
                          "text-[12px] px-1.5 py-0.5 rounded",
                          c.direction === "up" && "bg-gain/10 text-gain",
                          c.direction === "down" && "bg-loss/10 text-loss",
                          c.direction === "flat" && "bg-muted-foreground/10 text-muted-foreground",
                        )}
                      >
                        {c.direction === "up" ? "▲ Up" : c.direction === "down" ? "▼ Down" : "— Flat"}
                      </span>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
      {!isLoading && (!currencies || currencies.length === 0) && (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-foreground font-medium text-[14px] mb-1">
            No currency data available
          </p>
          <p className="text-muted-foreground text-[13px]">
            Currency exchange rates are loading or temporarily unavailable.
          </p>
        </div>
      )}
    </div>
  );
}
