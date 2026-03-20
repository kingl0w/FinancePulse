"use client";

import { Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import type { PortfolioSummary } from "@/types";

interface PortfolioCardProps {
  portfolio: PortfolioSummary;
  totalInvested?: number;
  currentValue?: number;
  isLoadingPrices?: boolean;
}

export function PortfolioCard({
  portfolio,
  totalInvested,
  currentValue,
  isLoadingPrices,
}: PortfolioCardProps) {
  const hasPriceData = totalInvested != null && currentValue != null;
  const pnl = hasPriceData ? currentValue - totalInvested : 0;
  const pnlPercent = hasPriceData && totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
  const isPositive = pnl >= 0;

  return (
    <Card className="bg-card border-border hover:border-secondary transition-colors cursor-pointer h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 min-w-0">
          <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{portfolio.name}</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {portfolio.holding_count}{" "}
          {portfolio.holding_count === 1 ? "holding" : "holdings"}
        </p>
      </CardHeader>
      <CardContent>
        {isLoadingPrices ? (
          <div className="space-y-2">
            <div className="h-7 w-28 bg-border rounded animate-pulse" />
            <div className="h-4 w-20 bg-border rounded animate-pulse" />
          </div>
        ) : hasPriceData ? (
          <div className="space-y-1">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Current Value</p>
                <p className="text-xl font-bold font-mono">
                  {formatCurrency(currentValue)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Invested</p>
                <p className="text-sm font-mono text-muted-foreground">
                  {formatCurrency(totalInvested)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-gain" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-loss" />
              )}
              <span
                className={cn(
                  "text-sm font-mono font-medium",
                  isPositive ? "text-gain" : "text-loss"
                )}
              >
                {formatCurrency(Math.abs(pnl))}
              </span>
              <span
                className={cn(
                  "text-xs font-mono",
                  isPositive ? "text-gain" : "text-loss"
                )}
              >
                ({formatPercent(pnlPercent)})
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {portfolio.holding_count === 0
              ? "No holdings yet"
              : "Loading prices..."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
