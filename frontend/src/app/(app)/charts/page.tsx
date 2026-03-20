"use client";

import { useState, useCallback, useEffect } from "react";
import { ChartCell } from "@/components/charts/ChartCell";
import { cn } from "@/lib/utils";

type Layout = 2 | 3 | 4;

const DEFAULT_SYMBOLS = ["BTC", "ETH", "AAPL", "MSFT"];

const LAYOUT_OPTIONS: { value: Layout; label: string; icon: React.ReactNode }[] = [
  {
    value: 2,
    label: "2 charts",
    icon: (
      <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
        <rect x="0" y="0" width="7" height="14" rx="1" />
        <rect x="9" y="0" width="7" height="14" rx="1" />
      </svg>
    ),
  },
  {
    value: 3,
    label: "3 charts",
    icon: (
      <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
        <rect x="0" y="0" width="7" height="6" rx="1" />
        <rect x="9" y="0" width="7" height="6" rx="1" />
        <rect x="0" y="8" width="16" height="6" rx="1" />
      </svg>
    ),
  },
  {
    value: 4,
    label: "4 charts",
    icon: (
      <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
        <rect x="0" y="0" width="7" height="6" rx="1" />
        <rect x="9" y="0" width="7" height="6" rx="1" />
        <rect x="0" y="8" width="7" height="6" rx="1" />
        <rect x="9" y="8" width="7" height="6" rx="1" />
      </svg>
    ),
  },
];

export default function ChartsPage() {
  const [layout, setLayout] = useState<Layout>(4);
  const [symbols, setSymbols] = useState<string[]>([...DEFAULT_SYMBOLS]);

  useEffect(() => {
    document.title = "Charts | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const handleSymbolChange = useCallback((index: number, newSymbol: string) => {
    setSymbols((prev) => {
      const next = [...prev];
      next[index] = newSymbol;
      return next;
    });
  }, []);

  const handleClose = useCallback((index: number) => {
    setSymbols((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });
  }, []);

  const handleLayoutChange = useCallback((newLayout: Layout) => {
    setLayout(newLayout);
  }, []);

  const visibleSymbols = symbols.slice(0, layout);

  return (
    <div className="flex flex-col -mx-4 -my-3" style={{ height: "calc(100vh - 48px)" }}>
      <div className="flex items-center gap-2 px-4 py-1.5 bg-card border-b border-border shrink-0">
        <span className="text-[12px] text-muted-foreground uppercase tracking-wider mr-1">Layout</span>
        {LAYOUT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleLayoutChange(opt.value)}
            title={opt.label}
            className={cn(
              "p-1.5 rounded transition-colors",
              layout === opt.value
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      <div
        className="grid gap-px bg-border flex-1 min-h-0 grid-cols-1 md:grid-cols-2"
        style={{
          gridTemplateRows: layout >= 3 ? "1fr 1fr" : "1fr",
        }}
      >
        {visibleSymbols.map((sym, i) => {
          const span = layout === 3 && i === 2 ? "col-span-1 md:col-span-2" : "";

          return (
            <div key={`cell-${i}`} className={cn(span, "overflow-hidden h-full")}>
              {sym ? (
                <ChartCell
                  defaultSymbol={sym}
                  onSymbolChange={(s) => handleSymbolChange(i, s)}
                  onClose={() => handleClose(i)}
                />
              ) : (
                <EmptyCell onSelect={(s) => handleSymbolChange(i, s)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyCell({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col items-center justify-center h-full bg-background border border-border">
      <p className="text-muted-foreground text-[13px] mb-2">No symbol selected</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim()) {
            onSelect(query.trim());
          }
        }}
        placeholder="Type symbol & Enter"
        className="h-7 w-32 bg-card border border-border rounded px-2 text-[12px] font-mono text-foreground outline-none focus:border-primary placeholder:text-muted-foreground/60"
      />
    </div>
  );
}
