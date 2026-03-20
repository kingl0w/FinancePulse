"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NewsCard } from "./NewsCard";
import { fetchNews } from "@/lib/api";
import type { NewsArticle } from "@/types";

const INITIAL_COUNT = 8;

function SentimentBar({ articles }: { articles: NewsArticle[] }) {
  if (articles.length < 3) return null;

  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  for (const a of articles) {
    counts[a.sentiment]++;
  }
  const total = articles.length;
  const bullPct = Math.round((counts.bullish / total) * 100);
  const bearPct = Math.round((counts.bearish / total) * 100);
  const neutralPct = 100 - bullPct - bearPct;

  let label: string;
  if (bullPct >= 60) label = `Mostly Bullish (${bullPct}%)`;
  else if (bearPct >= 60) label = `Mostly Bearish (${bearPct}%)`;
  else label = "Mixed";

  return (
    <div className="mb-4">
      <div className="flex h-1.5 w-full rounded-full overflow-hidden">
        {bullPct > 0 && (
          <div
            className="bg-gain"
            style={{ width: `${bullPct}%` }}
          />
        )}
        {neutralPct > 0 && (
          <div
            className="bg-muted-foreground"
            style={{ width: `${neutralPct}%` }}
          />
        )}
        {bearPct > 0 && (
          <div
            className="bg-loss"
            style={{ width: `${bearPct}%` }}
          />
        )}
      </div>
      <p className="text-[12px] text-muted-foreground mt-1.5">
        Sentiment: <span className="text-foreground">{label}</span>
      </p>
    </div>
  );
}

function LoadingSkeletons() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-3 border-b border-border">
          <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewsFeed({ symbol }: { symbol: string }) {
  const [showAll, setShowAll] = useState(false);

  const { data: articles, isLoading, isError } = useQuery({
    queryKey: ["news", symbol],
    queryFn: () => fetchNews(symbol),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section>
        <h2 className="text-[18px] font-heading mb-4 flex items-center gap-2">
          <Newspaper className="h-4.5 w-4.5 text-muted-foreground" />
          Latest News
        </h2>
        <LoadingSkeletons />
      </section>
    );
  }

  if (isError) {
    return (
      <section>
        <h2 className="text-[18px] font-heading mb-4 flex items-center gap-2">
          <Newspaper className="h-4.5 w-4.5 text-muted-foreground" />
          Latest News
        </h2>
        <p className="text-[14px] text-muted-foreground">Unable to load news</p>
      </section>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <section>
        <h2 className="text-[18px] font-heading mb-4 flex items-center gap-2">
          <Newspaper className="h-4.5 w-4.5 text-muted-foreground" />
          Latest News
        </h2>
        <p className="text-[14px] text-muted-foreground">
          No recent news found for {symbol}
        </p>
      </section>
    );
  }

  const visible = showAll ? articles : articles.slice(0, INITIAL_COUNT);
  const hasMore = articles.length > INITIAL_COUNT;

  return (
    <section>
      <h2 className="text-[18px] font-heading mb-4 flex items-center gap-2">
          <Newspaper className="h-4.5 w-4.5 text-muted-foreground" />
          Latest News
        </h2>
      <SentimentBar articles={articles} />
      <div className="border-b border-border mb-2" />
      <div>
        {visible.map((article, i) => (
          <NewsCard key={`${article.url}-${i}`} {...article} />
        ))}
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-[13px] text-primary hover:text-primary/80 transition-colors"
        >
          Show more ({articles.length - INITIAL_COUNT} remaining)
        </button>
      )}
    </section>
  );
}
