"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { select } from "d3-selection";
import { group } from "d3-array";
import { treemap, hierarchy, type HierarchyRectangularNode } from "d3-hierarchy";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchHeatmap, type HeatmapEntry } from "@/lib/api";
import { formatCurrency, formatPercent, formatNumber, cn } from "@/lib/utils";

function getColor(change: number | null): string {
  if (change == null) return "#333333";
  if (change < -5) return "#b91c1c";
  if (change < -2) return "#ef4444";
  if (change < -0.5) return "#991b1b";
  if (change < 0) return "#7f1d1d";
  if (change < 0.5) return "#14532d";
  if (change < 2) return "#22c55e";
  if (change < 5) return "#16a34a";
  return "#059669";
}

const STOCK_CATEGORIES = new Set(["tech", "finance", "healthcare", "consumer", "industrial", "etf", "commodity", "bonds", "index"]);

type FilterTab = "all" | "stocks" | "crypto";
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "stocks", label: "Stocks" },
  { key: "crypto", label: "Crypto" },
];

interface LeafDatum {
  name: string;
  value: number;
  entry: HeatmapEntry;
}

interface GroupDatum {
  name: string;
  children: LeafDatum[];
}

interface RootDatum {
  name: string;
  children: GroupDatum[];
}

export default function HeatmapPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  const {
    data: entries,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["heatmap"],
    queryFn: fetchHeatmap,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    document.title = "Market Heatmap | FinancePulse";
    return () => { document.title = "FinancePulse"; };
  }, []);

  const drawTreemap = useCallback(
    (data: HeatmapEntry[], width: number, height: number) => {
      const svg = select(svgRef.current);
      const tooltip = select(tooltipRef.current);

      svg.selectAll("*").remove();
      svg.attr("width", width).attr("height", height);

      const grouped = group(data, (d) => d.category);
      const rootData: RootDatum = {
        name: "root",
        children: Array.from(grouped, ([category, items]) => ({
          name: category,
          children: items.map((item) => ({
            name: item.symbol,
            value: item.market_cap,
            entry: item,
          })),
        })),
      };

      const root = hierarchy<RootDatum | GroupDatum | LeafDatum>(rootData)
        .sum((d) => ("value" in d ? d.value : 0))
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

      treemap<RootDatum | GroupDatum | LeafDatum>()
        .size([width, height])
        .padding(1)
        .paddingTop(0)
        .round(true)(root);

      const leaves = root.leaves() as HierarchyRectangularNode<
        RootDatum | GroupDatum | LeafDatum
      >[];

      const groups = svg
        .selectAll<SVGGElement, (typeof leaves)[number]>("g")
        .data(leaves)
        .join("g")
        .attr("transform", (d) => `translate(${d.x0},${d.y0})`)
        .style("cursor", "pointer");

      const getEntry = (
        d: HierarchyRectangularNode<RootDatum | GroupDatum | LeafDatum>
      ): HeatmapEntry | undefined =>
        "entry" in d.data ? (d.data as LeafDatum).entry : undefined;

      groups
        .append("rect")
        .attr("width", (d) => Math.max(0, d.x1 - d.x0))
        .attr("height", (d) => Math.max(0, d.y1 - d.y0))
        .attr("fill", (d) => getColor(getEntry(d)?.change_24h ?? null))
        .attr("stroke", "#1c1c1c")
        .attr("stroke-width", 1)
        .attr("rx", 2)
        .attr("ry", 2);

      groups
        .append("text")
        .attr("x", (d) => (d.x1 - d.x0) / 2)
        .attr("y", (d) => {
          const h = d.y1 - d.y0;
          return h < 40 ? h / 2 : h / 2 - 6;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .attr("font-family", "monospace")
        .attr("font-size", (d) => {
          const w = d.x1 - d.x0;
          if (w < 40) return "9px";
          if (w < 70) return "11px";
          return "14px";
        })
        .attr("font-weight", "bold")
        .style("pointer-events", "none")
        .text((d) => {
          const w = d.x1 - d.x0;
          if (w < 30) return "";
          return d.data.name;
        })
;

      groups
        .append("text")
        .attr("x", (d) => (d.x1 - d.x0) / 2)
        .attr("y", (d) => {
          const h = d.y1 - d.y0;
          return h < 40 ? h / 2 + 10 : h / 2 + 8;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "rgba(255,255,255,0.8)")
        .attr("font-family", "monospace")
        .attr("font-size", (d) => {
          const w = d.x1 - d.x0;
          if (w < 50) return "8px";
          return "12px";
        })
        .style("pointer-events", "none")
        .text((d) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          if (w < 40 || h < 30) return "";
          const entry = getEntry(d);
          return entry?.change_24h != null
            ? formatPercent(entry.change_24h)
            : "";
        })
;

      groups
        .append("text")
        .attr("x", (d) => (d.x1 - d.x0) / 2)
        .attr("y", (d) => (d.y1 - d.y0) / 2 + 22)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "rgba(255,255,255,0.4)")
        .attr("font-size", "11px")
        .style("pointer-events", "none")
        .text((d) => {
          const w = d.x1 - d.x0;
          const h = d.y1 - d.y0;
          if (w < 80 || h < 60) return "";
          const entry = getEntry(d);
          const name = entry?.name ?? "";
          return name.length > 14 ? name.slice(0, 12) + "..." : name;
        })
;

      groups
        .on("mouseover", function (_event, d) {
          select(this)
            .select("rect")
            .attr("stroke", "#f0b429")
            .attr("stroke-width", 2);

          const entry = getEntry(d);
          if (!entry) return;

          tooltip.style("display", "block").html(
            `<div class="text-[13px] space-y-1">
              <div class="font-bold text-white">${entry.symbol} <span class="font-normal text-[#6b6561]">${entry.name}</span></div>
              <div><span class="text-[#f0b429]">Price:</span> ${formatCurrency(entry.price)}</div>
              <div><span class="text-[#f0b429]">24h:</span> <span style="color: ${entry.change_24h != null && entry.change_24h >= 0 ? "#34d399" : "#f87171"}">${entry.change_24h != null ? formatPercent(entry.change_24h) : "N/A"}</span></div>
              <div><span class="text-[#f0b429]">Market Cap:</span> ${formatNumber(entry.market_cap)}</div>
              <div><span class="text-[#f0b429]">Category:</span> ${entry.category}</div>
            </div>`
          );
        })
        .on("mousemove", function (event) {
          const container = containerRef.current;
          if (!container) return;
          const rect = container.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;

          tooltip
            .style("left", `${Math.min(x + 12, rect.width - 200)}px`)
            .style("top", `${Math.min(y + 12, rect.height - 120)}px`);
        })
        .on("mouseout", function () {
          select(this)
            .select("rect")
            .attr("stroke", "#1c1c1c")
            .attr("stroke-width", 1);
          tooltip.style("display", "none");
        })
        .on("click", function (_event, d) {
          const entry = getEntry(d);
          if (entry) {
            router.push(`/market/${entry.symbol}`);
          }
        });
    },
    [router]
  );

  const filteredEntries = entries?.filter((e) => {
    if (e.market_cap <= 0) return false;
    if (filter === "stocks") return STOCK_CATEGORIES.has(e.category);
    if (filter === "crypto") return e.category === "crypto";
    return true;
  });

  useEffect(() => {
    if (!filteredEntries || !containerRef.current || !svgRef.current) return;

    const container = containerRef.current;

    const draw = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) {
        drawTreemap(filteredEntries, width, height);
      }
    };

    draw();

    const observer = new ResizeObserver(draw);
    observer.observe(container);

    return () => observer.disconnect();
  }, [filteredEntries, drawTreemap]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 h-[calc(100vh-48px)] p-4">
        <div className="flex items-center gap-3 mb-2">
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="flex-1 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <p className="text-loss">
          Failed to load heatmap data.{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
      <div className="flex items-center gap-3 px-4 py-2 shrink-0">
        <h1 className="text-lg font-bold font-heading text-foreground">
          Market Heatmap
        </h1>
        <span className="text-[13px] text-muted-foreground">
          {filteredEntries?.length ?? 0} assets — sized by market cap, colored
          by 24h change
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "px-3 py-1 rounded-full text-[13px] font-medium transition-colors",
                filter === tab.key
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="relative flex-1 min-h-0 mx-1 mb-1">
        <svg ref={svgRef} className="block w-full h-full" />
        <div
          ref={tooltipRef}
          className="absolute hidden bg-muted border border-border rounded-lg p-3 pointer-events-none z-50"
          style={{ minWidth: 180 }}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-3 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 text-[11px] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#ef4444]" />
            <span className="text-muted-foreground">Down</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#333333]" />
            <span className="text-muted-foreground">Flat</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#22c55e]" />
            <span className="text-muted-foreground">Up</span>
          </span>
        </div>
      </div>
    </div>
  );
}
