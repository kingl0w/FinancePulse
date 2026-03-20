"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsCard } from "@/components/market/NewsCard";
import { fetchGeneralNews, fetchTrending, type TrendingAsset } from "@/lib/api";
import type { NewsArticle } from "@/types";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

const INITIAL_COUNT = 20;

export default function NewsPage() {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    document.title = "Market News | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const { data: articles, isLoading } = useQuery({
    queryKey: ["general-news"],
    queryFn: fetchGeneralNews,
    staleTime: 5 * 60 * 1000,
  });

  const { data: trending } = useQuery({
    queryKey: ["trending"],
    queryFn: fetchTrending,
    staleTime: 30_000,
  });

  const visible = showAll ? articles : articles?.slice(0, INITIAL_COUNT);
  const hasMore = (articles?.length ?? 0) > INITIAL_COUNT;

  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  if (articles) {
    for (const a of articles) {
      sentimentCounts[a.sentiment]++;
    }
  }
  const totalSentiment = sentimentCounts.bullish + sentimentCounts.bearish + sentimentCounts.neutral;

  const trendingSymbols = trending
    ?.filter((t: TrendingAsset) => t.price != null)
    .slice(0, 10) ?? [];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading">Market News</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Latest market news and analysis
        </p>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 py-3 border-b border-border">
                  <Skeleton className="w-[80px] h-[60px] rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible && visible.length > 0 ? (
            <>
              <div className="divide-y divide-border">
                {visible.map((article: NewsArticle, i: number) => (
                  <NewsCard key={`${article.url}-${i}`} {...article} />
                ))}
              </div>
              {hasMore && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="mt-4 text-[13px] text-primary hover:text-primary/80 transition-colors"
                >
                  Load more ({(articles?.length ?? 0) - INITIAL_COUNT} remaining)
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-48 rounded-lg border border-secondary bg-card">
              <p className="text-muted-foreground">No news available</p>
            </div>
          )}
        </div>

        <aside className="hidden md:block w-72 shrink-0 space-y-4">
          {totalSentiment > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-[14px] font-heading font-semibold text-foreground mb-3">
                Market Sentiment
              </h3>
              <div className="space-y-2">
                <SentimentRow
                  label="Bullish"
                  count={sentimentCounts.bullish}
                  total={totalSentiment}
                  color="bg-gain"
                  textColor="text-gain"
                />
                <SentimentRow
                  label="Neutral"
                  count={sentimentCounts.neutral}
                  total={totalSentiment}
                  color="bg-muted-foreground"
                  textColor="text-muted-foreground"
                />
                <SentimentRow
                  label="Bearish"
                  count={sentimentCounts.bearish}
                  total={totalSentiment}
                  color="bg-loss"
                  textColor="text-loss"
                />
              </div>
            </div>
          )}

          {trendingSymbols.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-[14px] font-heading font-semibold text-foreground mb-3">
                Trending Symbols
              </h3>
              <div className="space-y-0">
                {trendingSymbols.map((t: TrendingAsset) => {
                  const isPositive = (t.change_percent_24h ?? 0) >= 0;
                  return (
                    <Link
                      key={t.symbol}
                      href={`/market/${t.symbol}`}
                      className="flex items-center justify-between py-1.5 hover:bg-muted -mx-2 px-2 rounded transition-colors"
                    >
                      <div>
                        <span className="text-[13px] font-mono font-semibold text-foreground">
                          {t.symbol}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1.5">{t.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[12px] font-mono text-foreground">
                          {t.price != null ? formatCurrency(t.price) : "—"}
                        </span>
                        {t.change_percent_24h != null && (
                          <span
                            className={cn(
                              "text-[11px] font-mono ml-1.5",
                              isPositive ? "text-gain" : "text-loss",
                            )}
                          >
                            {formatPercent(t.change_percent_24h)}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SentimentRow({
  label,
  count,
  total,
  color,
  textColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  textColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1">
        <span className={textColor}>{label}</span>
        <span className="text-muted-foreground font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
