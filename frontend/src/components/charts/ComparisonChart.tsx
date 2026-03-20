"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

export interface ComparisonData {
  series: Record<string, Array<{ timestamp: string; pct_change: number }>>;
}

interface ComparisonChartProps {
  data: ComparisonData;
  symbols: string[];
  primarySymbol: string;
  height?: number;
}

const CHART_BG = "#0a0a0a";
const GRID_COLOR = "#1c1c1c";
const TEXT_COLOR = "#6b6561";
const BORDER_COLOR = "#1c1c1c";

const SERIES_COLORS: { color: string; lineWidth: 1 | 2 | 3 | 4 }[] = [
  { color: "#f0b429", lineWidth: 2 },
  { color: "#818cf8", lineWidth: 2 },
  { color: "#38bdf8", lineWidth: 2 },
  { color: "#fb923c", lineWidth: 2 },
];

interface LegendEntry {
  symbol: string;
  color: string;
  value: number | null;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function ComparisonChart({
  data,
  symbols,
  primarySymbol,
  height = 400,
}: ComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const [legend, setLegend] = useState<LegendEntry[] | null>(null);

  const orderedSymbols = [
    primarySymbol,
    ...symbols.filter((s) => s !== primarySymbol),
  ].filter((s) => data.series[s] && data.series[s].length > 0);

  const hasData = orderedSymbols.length > 0;

  useEffect(() => {
    if (!hasData || !containerRef.current) return;
    const container = containerRef.current;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    seriesMapRef.current.clear();

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: TEXT_COLOR,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: { mode: 0 as const },
      timeScale: {
        borderColor: BORDER_COLOR,
        rightOffset: 5,
        barSpacing: 6,
        minBarSpacing: 1,
        visible: true,
      },
      rightPriceScale: {
        borderColor: BORDER_COLOR,
      },
    });
    chartRef.current = chart;

    let zeroLineCreated = false;

    for (let i = 0; i < orderedSymbols.length; i++) {
      const sym = orderedSymbols[i];
      const points = data.series[sym];
      if (!points || points.length === 0) continue;

      const colorConfig = SERIES_COLORS[i] ?? {
        color: "#6b6561",
        lineWidth: 1 as const,
      };

      const series = chart.addSeries(LineSeries, {
        color: colorConfig.color,
        lineWidth: colorConfig.lineWidth,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const lineData = points.map((p) => ({
        time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
        value: p.pct_change,
      }));

      series.setData(lineData);
      seriesMapRef.current.set(sym, series);

      if (!zeroLineCreated) {
        series.createPriceLine({
          price: 0,
          color: "#6b6561",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: "",
        });
        zeroLineCreated = true;
      }
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        setLegend(null);
        return;
      }

      const entries: LegendEntry[] = [];
      for (let i = 0; i < orderedSymbols.length; i++) {
        const sym = orderedSymbols[i];
        const series = seriesMapRef.current.get(sym);
        if (!series) continue;

        const colorConfig = SERIES_COLORS[i] ?? { color: "#6b6561" };
        const seriesData = param.seriesData.get(series) as
          | { value: number }
          | undefined;

        entries.push({
          symbol: sym,
          color: colorConfig.color,
          value: seriesData?.value ?? null,
        });
      }

      setLegend(entries.length > 0 ? entries : null);
    });

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, symbols.join(","), primarySymbol, height]);

  if (!hasData) {
    return (
      <div
        className="w-full rounded-lg overflow-hidden flex items-center justify-center bg-card"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium font-mono">Comparison</p>
          <p className="text-sm">No comparison data</p>
        </div>
      </div>
    );
  }

  const defaultLegend: LegendEntry[] = orderedSymbols.map((sym, i) => {
    const points = data.series[sym];
    const lastVal =
      points && points.length > 0 ? points[points.length - 1].pct_change : null;
    const colorConfig = SERIES_COLORS[i] ?? { color: "#6b6561" };
    return { symbol: sym, color: colorConfig.color, value: lastVal };
  });

  const displayLegend = legend ?? defaultLegend;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height }}
      />

      <div className="absolute top-2 right-2 z-20 pointer-events-none bg-black/80 rounded px-3 py-2">
        {displayLegend.map((entry) => (
          <div
            key={entry.symbol}
            className="flex items-center gap-2 text-xs font-mono"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground">{entry.symbol}</span>
            {entry.value !== null ? (
              <span
                className={
                  entry.value >= 0 ? "text-gain" : "text-loss"
                }
              >
                {formatPct(entry.value)}
              </span>
            ) : (
              <span className="text-muted-foreground">--</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
