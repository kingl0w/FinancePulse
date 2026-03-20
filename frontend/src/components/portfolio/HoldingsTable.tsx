"use client";

import { useRef, useEffect, useState, useCallback, memo } from "react";
import { Trash2, Plus, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { usePriceStore } from "@/stores/priceStore";
import type { HoldingWithPrice } from "@/types";

interface HoldingsTableProps {
  holdings: HoldingWithPrice[];
  onDelete?: (holdingId: string) => void;
  onEdit?: (holding: HoldingWithPrice) => void;
}

function PriceCell({ symbol, fallbackPrice }: { symbol: string; fallbackPrice?: number }) {
  const livePrice = usePriceStore((s) => s.prices[symbol]?.price);
  const price = livePrice ?? fallbackPrice;
  const prevPriceRef = useRef(price);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    if (livePrice != null && prevPriceRef.current != null && livePrice !== prevPriceRef.current) {
      setFlashClass(
        livePrice > prevPriceRef.current ? "animate-flash-green" : "animate-flash-red"
      );
      const timer = setTimeout(() => setFlashClass(""), 600);
      prevPriceRef.current = livePrice;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = livePrice ?? prevPriceRef.current;
  }, [livePrice]);

  return (
    <TableCell className={cn("text-right font-mono", flashClass)}>
      {price != null ? formatCurrency(price) : "--"}
    </TableCell>
  );
}

const HoldingRow = memo(function HoldingRow({
  holding,
  onDelete,
  onEdit,
}: {
  holding: HoldingWithPrice;
  onDelete?: (holdingId: string) => void;
  onEdit?: (holding: HoldingWithPrice) => void;
}) {
  const livePrice = usePriceStore((s) => s.prices[holding.symbol]?.price);
  const currentPrice = livePrice ?? holding.current_price;
  const value = currentPrice != null ? holding.quantity * currentPrice : null;
  const totalCost = holding.quantity * holding.avg_cost;
  const pnl = value != null ? value - totalCost : null;
  const pnlPercent = pnl != null && totalCost > 0 ? (pnl / totalCost) * 100 : null;
  const isPositive = (pnl ?? 0) >= 0;

  return (
    <TableRow className="group">
      <TableCell className="font-mono font-medium">{holding.symbol}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">
          {holding.asset_type}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono">{holding.quantity}</TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(holding.avg_cost)}
      </TableCell>
      <PriceCell symbol={holding.symbol} fallbackPrice={holding.current_price} />
      <TableCell className="text-right font-mono">
        {value != null ? formatCurrency(value) : "--"}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-mono font-medium",
          pnl != null ? (isPositive ? "text-gain" : "text-loss") : ""
        )}
      >
        {pnl != null
          ? `${formatCurrency(pnl)} (${formatPercent(pnlPercent ?? 0)})`
          : "--"}
      </TableCell>
      {(onEdit || onDelete) && (
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit holding"
                className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                onClick={() => onEdit(holding)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove holding"
                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                onClick={() => onDelete(holding.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
});

export function HoldingsTable({ holdings, onDelete, onEdit }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Plus className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-foreground font-medium text-[14px] mb-1">No holdings yet</p>
        <p className="text-muted-foreground text-[13px] max-w-xs">
          Add a stock or crypto holding to start tracking its value in this portfolio.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Symbol</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Avg Cost</TableHead>
          <TableHead className="text-right">Current</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="text-right">P&L</TableHead>
          {(onEdit || onDelete) && <TableHead className="w-20" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((h) => (
          <HoldingRow key={h.id} holding={h} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </TableBody>
    </Table>
  );
}
