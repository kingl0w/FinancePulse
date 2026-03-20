"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  type IPriceLine,
  type LogicalRange,
} from "lightweight-charts";
import type { HistoricalCandle } from "@/types";

export interface LivePrice {
  price: number;
  volume: number;
  timestamp: string;
}

export interface IndicatorData {
  sma_20?: (number | null)[];
  sma_50?: (number | null)[];
  ema_12?: (number | null)[];
  ema_26?: (number | null)[];
  rsi_14?: (number | null)[];
  macd?: {
    macd_line: (number | null)[];
    signal_line: (number | null)[];
    histogram: (number | null)[];
  };
  bollinger?: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  };
  [key: string]: unknown;
}

interface PriceChartProps {
  symbol: string;
  candles?: HistoricalCandle[];
  height?: number;
  range?: string;
  livePrice?: LivePrice;
  indicators?: IndicatorData;
  activeIndicators?: string[];
}

function getCandlePeriodSeconds(range: string): number {
  switch (range) {
    case "1m":
      return 60;
    case "5m":
      return 300;
    case "15m":
      return 900;
    case "30m":
      return 1800;
    case "1H":
      return 3600;
    case "1D":
      return 3600;
    case "1W":
      return 14400;
    case "1M":
    case "3M":
      return 86400;
    case "1Y":
      return 604800;
    default:
      return 86400;
  }
}

function getCandleTime(timestampSecs: number, periodSecs: number): number {
  return Math.floor(timestampSecs / periodSecs) * periodSecs;
}

function candleTimestamps(candles: HistoricalCandle[]): UTCTimestamp[] {
  return candles.map(
    (c) => (new Date(c.timestamp).getTime() / 1000) as UTCTimestamp
  );
}

function dedup<T extends { time: UTCTimestamp }>(data: T[]): T[] {
  const seen = new Set<number>();
  return data
    .sort((a, b) => (a.time as number) - (b.time as number))
    .filter((item) => {
      const t = item.time as number;
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
}

function safeSetData<T extends { time: UTCTimestamp }>(
  series: { setData: (data: T[]) => void },
  data: T[]
): void {
  try {
    series.setData(dedup(data));
  } catch (err) {
    // Chart data error — non-critical, swallow silently
  }
}

function toLineData(
  timestamps: UTCTimestamp[],
  values: (number | null)[]
): { time: UTCTimestamp; value: number }[] {
  const result: { time: UTCTimestamp; value: number }[] = [];
  for (let i = 0; i < Math.min(timestamps.length, values.length); i++) {
    if (values[i] != null) {
      result.push({ time: timestamps[i], value: values[i] as number });
    }
  }
  return result;
}

function toHistogramData(
  timestamps: UTCTimestamp[],
  values: (number | null)[]
): { time: UTCTimestamp; value: number; color: string }[] {
  const result: { time: UTCTimestamp; value: number; color: string }[] = [];
  for (let i = 0; i < Math.min(timestamps.length, values.length); i++) {
    if (values[i] != null) {
      const v = values[i] as number;
      result.push({
        time: timestamps[i],
        value: v,
        color: v >= 0 ? "#34d399" : "#f87171",
      });
    }
  }
  return result;
}

const CHART_BG = "#0a0a0a";
const GRID_COLOR = "#1c1c1c";
const TEXT_COLOR = "#6b6561";
const BORDER_COLOR = "#1c1c1c";

function makeChartOptions(width: number, h: number) {
  return {
    width,
    height: h,
    layout: {
      background: { type: ColorType.Solid as const, color: CHART_BG },
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
    rightPriceScale: { borderColor: BORDER_COLOR },
  };
}

interface CrosshairValues {
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  sma_20?: number;
  sma_50?: number;
  ema_12?: number;
  ema_26?: number;
  rsi?: number;
  macd?: number;
  signal?: number;
  histogram?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
}

export function PriceChart({
  symbol,
  candles,
  height = 400,
  range = "1M",
  livePrice,
  indicators,
  activeIndicators = [],
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);
  const lastCandleRef = useRef<CandlestickData<UTCTimestamp> | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const tickDotRef = useRef<HTMLDivElement>(null);
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [crosshair, setCrosshair] = useState<CrosshairValues | null>(null);

  const showRsi = activeIndicators.includes("rsi_14");
  const showMacd = activeIndicators.includes("macd");

  useEffect(() => {
    if (!candles || candles.length === 0 || !containerRef.current) return;
    const container = containerRef.current;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      ...makeChartOptions(container.clientWidth, height),
      timeScale: {
        borderColor: BORDER_COLOR,
        rightOffset: 5,
        barSpacing: 6,
        minBarSpacing: 1,
        visible: !showRsi && !showMacd,
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#f0b42980",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const timestamps = candleTimestamps(candles);

    const candlestickData: CandlestickData<UTCTimestamp>[] = candles.map(
      (c, i) => ({
        time: timestamps[i],
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })
    );

    const volumeData = candles.map((c, i) => ({
      time: timestamps[i],
      value: c.volume,
      color: c.close >= c.open ? "#34d39940" : "#f8717140",
    }));

    safeSetData(candleSeries, candlestickData);
    safeSetData(volumeSeries, volumeData);

    const dedupedCandles = dedup(candlestickData);
    if (dedupedCandles.length > 0) {
      lastCandleRef.current = {
        ...dedupedCandles[dedupedCandles.length - 1],
      };
    }
    priceLineRef.current = null;

    const overlaySeries: ISeriesApi<"Line">[] = [];

    if (indicators?.sma_20 && activeIndicators.includes("sma_20")) {
      const s = chart.addSeries(LineSeries, {
        color: "#f0b429",
        lineWidth: 1,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      safeSetData(s, toLineData(timestamps, indicators.sma_20));
      overlaySeries.push(s);
    }

    if (indicators?.sma_50 && activeIndicators.includes("sma_50")) {
      const s = chart.addSeries(LineSeries, {
        color: "#818cf8",
        lineWidth: 1,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      safeSetData(s, toLineData(timestamps, indicators.sma_50));
      overlaySeries.push(s);
    }

    if (indicators?.ema_12 && activeIndicators.includes("ema_12")) {
      const s = chart.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      safeSetData(s, toLineData(timestamps, indicators.ema_12));
      overlaySeries.push(s);
    }

    if (indicators?.ema_26 && activeIndicators.includes("ema_26")) {
      const s = chart.addSeries(LineSeries, {
        color: "#fb923c",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      safeSetData(s, toLineData(timestamps, indicators.ema_26));
      overlaySeries.push(s);
    }

    if (indicators?.bollinger && activeIndicators.includes("bollinger")) {
      const bbUpper = chart.addSeries(LineSeries, {
        color: "#6b6561",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      safeSetData(bbUpper, toLineData(timestamps, indicators.bollinger.upper));
      overlaySeries.push(bbUpper);

      const bbMiddle = chart.addSeries(LineSeries, {
        color: "#f0b429",
        lineWidth: 1,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      safeSetData(bbMiddle, toLineData(timestamps, indicators.bollinger.middle));
      overlaySeries.push(bbMiddle);

      const bbLower = chart.addSeries(LineSeries, {
        color: "#6b6561",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceScaleId: "right",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      safeSetData(bbLower, toLineData(timestamps, indicators.bollinger.lower));
      overlaySeries.push(bbLower);
    }

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        setCrosshair(null);
        return;
      }
      const candleValue = param.seriesData.get(candleSeries) as
        | CandlestickData<UTCTimestamp>
        | undefined;
      if (!candleValue) {
        setCrosshair(null);
        return;
      }
      const idx = timestamps.indexOf(param.time as UTCTimestamp);
      const vals: CrosshairValues = {
        o: candleValue.open,
        h: candleValue.high,
        l: candleValue.low,
        c: candleValue.close,
      };
      if (idx >= 0 && indicators) {
        if (indicators.sma_20?.[idx] != null)
          vals.sma_20 = indicators.sma_20[idx] as number;
        if (indicators.sma_50?.[idx] != null)
          vals.sma_50 = indicators.sma_50[idx] as number;
        if (indicators.ema_12?.[idx] != null)
          vals.ema_12 = indicators.ema_12[idx] as number;
        if (indicators.ema_26?.[idx] != null)
          vals.ema_26 = indicators.ema_26[idx] as number;
        if (indicators.rsi_14?.[idx] != null)
          vals.rsi = indicators.rsi_14[idx] as number;
        if (indicators.macd) {
          if (indicators.macd.macd_line[idx] != null)
            vals.macd = indicators.macd.macd_line[idx] as number;
          if (indicators.macd.signal_line[idx] != null)
            vals.signal = indicators.macd.signal_line[idx] as number;
          if (indicators.macd.histogram[idx] != null)
            vals.histogram = indicators.macd.histogram[idx] as number;
        }
        if (indicators.bollinger) {
          if (indicators.bollinger.upper[idx] != null)
            vals.bb_upper = indicators.bollinger.upper[idx] as number;
          if (indicators.bollinger.middle[idx] != null)
            vals.bb_middle = indicators.bollinger.middle[idx] as number;
          if (indicators.bollinger.lower[idx] != null)
            vals.bb_lower = indicators.bollinger.lower[idx] as number;
        }
      }
      setCrosshair(vals);
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
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      lastCandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, height, range, indicators, activeIndicators.join(",")]);

  useEffect(() => {
    if (!showRsi || !candles || candles.length === 0 || !rsiContainerRef.current)
      return;

    const rsiValues = indicators?.rsi_14;
    if (!rsiValues) return;

    const container = rsiContainerRef.current;
    const timestamps = candleTimestamps(candles);

    const rsiChart = createChart(container, {
      ...makeChartOptions(container.clientWidth, 120),
      timeScale: {
        borderColor: BORDER_COLOR,
        rightOffset: 5,
        visible: !showMacd,
      },
      rightPriceScale: {
        borderColor: BORDER_COLOR,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
    });
    rsiChartRef.current = rsiChart;

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: "#f0b429",
      lineWidth: 2,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    safeSetData(rsiSeries, toLineData(timestamps, rsiValues));

    rsiSeries.createPriceLine({
      price: 70,
      color: "#f8717180",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: "#34d39980",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });
    rsiSeries.createPriceLine({
      price: 50,
      color: "#6b656140",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: "",
    });

    rsiChart.priceScale("right").applyOptions({
      autoScale: false,
      scaleMargins: { top: 0.05, bottom: 0.05 },
    });
    rsiSeries.applyOptions({
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    });

    rsiChart.timeScale().fitContent();

    const mainChart = chartRef.current;
    if (mainChart) {
      mainChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((logicalRange: LogicalRange | null) => {
          if (logicalRange && rsiChartRef.current) {
            rsiChartRef.current
              .timeScale()
              .setVisibleLogicalRange(logicalRange);
          }
        });
      rsiChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((logicalRange: LogicalRange | null) => {
          if (logicalRange && chartRef.current) {
            chartRef.current
              .timeScale()
              .setVisibleLogicalRange(logicalRange);
          }
        });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        rsiChart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      rsiChart.remove();
      rsiChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, showRsi, indicators?.rsi_14, showMacd]);

  useEffect(() => {
    if (
      !showMacd ||
      !candles ||
      candles.length === 0 ||
      !macdContainerRef.current
    )
      return;

    const macdData = indicators?.macd;
    if (!macdData) return;

    const container = macdContainerRef.current;
    const timestamps = candleTimestamps(candles);

    const macdChart = createChart(container, {
      ...makeChartOptions(container.clientWidth, 120),
      timeScale: { borderColor: BORDER_COLOR, rightOffset: 5, visible: true },
      rightPriceScale: {
        borderColor: BORDER_COLOR,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });
    macdChartRef.current = macdChart;

    const histSeries = macdChart.addSeries(HistogramSeries, {
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    safeSetData(histSeries, toHistogramData(timestamps, macdData.histogram));

    const macdLineSeries = macdChart.addSeries(LineSeries, {
      color: "#f0b429",
      lineWidth: 1,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    safeSetData(macdLineSeries, toLineData(timestamps, macdData.macd_line));

    const signalSeries = macdChart.addSeries(LineSeries, {
      color: "#818cf8",
      lineWidth: 1,
      priceScaleId: "right",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    safeSetData(signalSeries, toLineData(timestamps, macdData.signal_line));

    macdLineSeries.createPriceLine({
      price: 0,
      color: "#6b656140",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: "",
    });

    macdChart.timeScale().fitContent();

    const mainChart = chartRef.current;
    if (mainChart) {
      mainChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((logicalRange: LogicalRange | null) => {
          if (logicalRange && macdChartRef.current) {
            macdChartRef.current
              .timeScale()
              .setVisibleLogicalRange(logicalRange);
          }
        });
      macdChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((logicalRange: LogicalRange | null) => {
          if (logicalRange && chartRef.current) {
            chartRef.current
              .timeScale()
              .setVisibleLogicalRange(logicalRange);
          }
        });
    }

    const rsiChart = rsiChartRef.current;
    if (rsiChart) {
      rsiChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((logicalRange: LogicalRange | null) => {
          if (logicalRange && macdChartRef.current) {
            macdChartRef.current
              .timeScale()
              .setVisibleLogicalRange(logicalRange);
          }
        });
      macdChart
        .timeScale()
        .subscribeVisibleLogicalRangeChange((logicalRange: LogicalRange | null) => {
          if (logicalRange && rsiChartRef.current) {
            rsiChartRef.current
              .timeScale()
              .setVisibleLogicalRange(logicalRange);
          }
        });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        macdChart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      macdChart.remove();
      macdChartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, showMacd, indicators?.macd]);

  const updateLivePrice = useCallback(
    (live: LivePrice) => {
      const candleSeries = candleSeriesRef.current;
      const volumeSeries = volumeSeriesRef.current;
      if (!candleSeries || !volumeSeries) return;

      const lastCandle = lastCandleRef.current;
      if (!lastCandle) return;

      const price = live.price;
      const tsSecs = Math.floor(new Date(live.timestamp).getTime() / 1000);
      const period = getCandlePeriodSeconds(range);
      const candleTimeNum = getCandleTime(tsSecs, period);
      const lastTimeNum = Number(lastCandle.time);

      if (candleTimeNum < lastTimeNum) return;

      try {
        if (candleTimeNum === lastTimeNum) {
          const updated: CandlestickData<UTCTimestamp> = {
            time: lastCandle.time,
            open: lastCandle.open,
            high: Math.max(lastCandle.high, price),
            low: Math.min(lastCandle.low, price),
            close: price,
          };
          candleSeries.update(updated);
          lastCandleRef.current = updated;
          try {
            volumeSeries.update({
              time: lastCandle.time,
              value: live.volume,
              color: price >= updated.open ? "#34d39940" : "#f8717140",
            });
          } catch { /* volume update non-critical */ }
        } else {
          const prevClose = lastCandle.close;
          const newCandle: CandlestickData<UTCTimestamp> = {
            time: candleTimeNum as unknown as UTCTimestamp,
            open: prevClose,
            high: Math.max(prevClose, price),
            low: Math.min(prevClose, price),
            close: price,
          };
          candleSeries.update(newCandle);
          lastCandleRef.current = newCandle;
          try {
            volumeSeries.update({
              time: candleTimeNum as unknown as UTCTimestamp,
              value: live.volume,
              color: price >= prevClose ? "#34d39940" : "#f8717140",
            });
          } catch { /* volume update non-critical */ }
        }

        if (priceLineRef.current) {
          candleSeries.removePriceLine(priceLineRef.current);
        }
        priceLineRef.current = candleSeries.createPriceLine({
          price,
          color: "#f0b429",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "",
        });

        const dot = tickDotRef.current;
        if (dot) {
          const yCoord = candleSeries.priceToCoordinate(price);
          if (yCoord !== null) {
            const isUp =
              prevPriceRef.current === null || price >= prevPriceRef.current;
            dot.style.top = `${yCoord}px`;
            dot.style.backgroundColor = isUp ? "#34d399" : "#f87171";
            dot.style.boxShadow = isUp
              ? "0 0 6px 2px rgba(52,211,153,0.5)"
              : "0 0 6px 2px rgba(248,113,113,0.5)";
            dot.style.opacity = "1";
            if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
            tickTimerRef.current = setTimeout(() => {
              dot.style.opacity = "0";
            }, 500);
          }
        }
        prevPriceRef.current = price;
      } catch (err) {
        // Live update skipped — non-critical
      }
    },
    [range]
  );

  useEffect(() => {
    if (!livePrice) return;
    updateLivePrice(livePrice);
  }, [livePrice, updateLivePrice]);

  if (!candles || candles.length === 0) {
    return (
      <div
        className="w-full rounded-lg overflow-hidden flex items-center justify-center bg-card"
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium font-mono">{symbol}</p>
          <p className="text-sm">No price data available</p>
        </div>
      </div>
    );
  }

  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-0">
      <div className="relative">
        <div
          ref={containerRef}
          className="w-full rounded-t-lg overflow-hidden"
          style={{ height }}
        />

        {crosshair && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none font-mono text-[11px] leading-relaxed bg-black/70 rounded px-2 py-1.5 backdrop-blur-sm">
            <div className="flex gap-3 text-foreground">
              <span>O <span className="text-foreground">{fmt(crosshair.o ?? 0)}</span></span>
              <span>H <span className="text-foreground">{fmt(crosshair.h ?? 0)}</span></span>
              <span>L <span className="text-foreground">{fmt(crosshair.l ?? 0)}</span></span>
              <span>C <span className="text-foreground">{fmt(crosshair.c ?? 0)}</span></span>
            </div>
            {crosshair.sma_20 != null && (
              <div className="text-primary">SMA 20: {fmt(crosshair.sma_20)}</div>
            )}
            {crosshair.sma_50 != null && (
              <div className="text-[#818cf8]">SMA 50: {fmt(crosshair.sma_50)}</div>
            )}
            {crosshair.ema_12 != null && (
              <div className="text-[#38bdf8]">EMA 12: {fmt(crosshair.ema_12)}</div>
            )}
            {crosshair.ema_26 != null && (
              <div className="text-[#fb923c]">EMA 26: {fmt(crosshair.ema_26)}</div>
            )}
            {crosshair.bb_upper != null && (
              <div className="text-muted-foreground">
                BB: {fmt(crosshair.bb_upper)} / {fmt(crosshair.bb_middle ?? 0)} / {fmt(crosshair.bb_lower ?? 0)}
              </div>
            )}
            {crosshair.rsi != null && (
              <div className="text-primary">RSI: {crosshair.rsi.toFixed(1)}</div>
            )}
            {crosshair.macd != null && (
              <div className="text-primary">
                MACD: {fmt(crosshair.macd)} / Signal: {fmt(crosshair.signal ?? 0)} / Hist: {fmt(crosshair.histogram ?? 0)}
              </div>
            )}
          </div>
        )}

        <div
          ref={tickDotRef}
          style={{
            position: "absolute",
            right: 52,
            width: 8,
            height: 8,
            borderRadius: "50%",
            opacity: 0,
            transition: "opacity 300ms ease-out, top 100ms ease-out",
            pointerEvents: "none",
            transform: "translateY(-50%)",
            zIndex: 10,
          }}
        />
      </div>

      {showRsi && indicators?.rsi_14 && (
        <div className="relative">
          <div className="absolute top-1 left-2 z-10 text-[10px] font-mono text-muted-foreground pointer-events-none">
            RSI (14)
          </div>
          <div
            ref={rsiContainerRef}
            className="w-full overflow-hidden border-t border-border"
            style={{ height: 120 }}
          />
        </div>
      )}

      {showMacd && indicators?.macd && (
        <div className="relative">
          <div className="absolute top-1 left-2 z-10 text-[10px] font-mono text-muted-foreground pointer-events-none">
            MACD (12,26,9)
          </div>
          <div
            ref={macdContainerRef}
            className="w-full overflow-hidden rounded-b-lg border-t border-border"
            style={{ height: 120 }}
          />
        </div>
      )}
    </div>
  );
}
