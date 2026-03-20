"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPredictions, type PredictionMarket } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = ["all", "crypto", "politics", "economics", "sports", "geopolitics", "tech", "other"] as const;
type Category = (typeof CATEGORIES)[number];

type SortKey = "volume" | "liquidity" | "end_date";

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PredictionsPage() {
  const [category, setCategory] = useState<Category>("all");
  const [sortBy, setSortBy] = useState<SortKey>("volume");

  const { data: markets, isLoading } = useQuery({
    queryKey: ["predictions"],
    queryFn: fetchPredictions,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    document.title = "Predictions | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const filtered = useMemo(() => {
    let items = markets?.filter(
      (m) => category === "all" || m.category === category
    ) ?? [];

    items = [...items].sort((a, b) => {
      switch (sortBy) {
        case "volume":
          return b.volume_24h - a.volume_24h;
        case "liquidity":
          return b.liquidity - a.liquidity;
        case "end_date": {
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
        }
        default:
          return 0;
      }
    });

    return items;
  }, [markets, category, sortBy]);

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading">Prediction Markets</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Powered by Polymarket
        </p>
      </div>

      <div className="flex items-center gap-0.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "px-3 py-1 rounded-full text-[13px] font-medium capitalize transition-colors",
              category === cat
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted-foreground uppercase tracking-wider">Sort</span>
        <div className="flex items-center gap-0.5">
          {([
            { key: "volume" as SortKey, label: "Volume" },
            { key: "liquidity" as SortKey, label: "Liquidity" },
            { key: "end_date" as SortKey, label: "Ending Soon" },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors",
                sortBy === opt.key
                  ? "bg-secondary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((market) => (
            <PredictionCard key={market.id} market={market} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 rounded-lg border border-secondary bg-card">
          <p className="text-muted-foreground">No markets in this category</p>
        </div>
      )}
    </div>
  );
}

function PredictionCard({ market }: { market: PredictionMarket }) {
  const yesPct = Math.round(market.yes_price * 100);
  const noPct = 100 - yesPct;

  return (
    <a
      href={`https://polymarket.com/event/${market.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex bg-card border border-border rounded-lg p-4 hover:border-secondary transition-colors h-full"
    >
      <div className="flex gap-3">
        {market.image && (
          <img
            src={market.image}
            alt=""
            className="w-10 h-10 rounded-md object-cover shrink-0 mt-0.5"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2">
            {market.question}
          </p>

          <div className="mt-3">
            <div className="flex h-6 rounded-full overflow-hidden">
              <div
                className="flex items-center justify-center text-[11px] font-mono font-semibold text-primary-foreground bg-gain"
                style={{ width: `${Math.max(yesPct, 8)}%` }}
              >
                {yesPct >= 15 && `Yes ${yesPct}%`}
              </div>
              <div
                className="flex items-center justify-center text-[11px] font-mono font-semibold text-primary-foreground bg-loss"
                style={{ width: `${Math.max(noPct, 8)}%` }}
              >
                {noPct >= 15 && `No ${noPct}%`}
              </div>
            </div>
            {(yesPct < 15 || noPct < 15) && (
              <div className="flex justify-between mt-1 text-[11px] font-mono">
                <span className="text-gain">Yes {yesPct}%</span>
                <span className="text-loss">No {noPct}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span>24h Vol: {formatVolume(market.volume_24h)}</span>
            <span>·</span>
            <span>Liquidity: {formatVolume(market.liquidity)}</span>
            {market.end_date && (
              <>
                <span>·</span>
                <span>Ends: {formatDate(market.end_date)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
