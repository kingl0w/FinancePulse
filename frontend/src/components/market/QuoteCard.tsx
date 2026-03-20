"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { PriceUpdate } from "@/types";

interface QuoteCardProps {
  symbol: string;
  data?: PriceUpdate;
}

export function QuoteCard({ symbol, data }: QuoteCardProps) {
  if (!data) {
    return (
      <Card className="bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold">{symbol}</span>
            <span className="text-sm text-muted-foreground">--</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = (data.change_percent_24h ?? 0) >= 0;

  return (
    <Card className="bg-card hover:bg-accent/30 transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono font-bold text-sm">{symbol}</span>
          {data.change_percent_24h !== undefined && (
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                isPositive
                  ? "bg-gain/10 text-gain"
                  : "bg-loss/10 text-loss"
              )}
            >
              <span className="font-mono">{formatPercent(data.change_percent_24h)}</span>
            </span>
          )}
        </div>
        <p className="text-lg font-semibold font-mono">{formatCurrency(data.price)}</p>
      </CardContent>
    </Card>
  );
}
