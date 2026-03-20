"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface PerformanceDataPoint {
  date: string;
  value: number;
}

interface PerformanceChartProps {
  data?: PerformanceDataPoint[];
  height?: number;
}

export function PerformanceChart({
  data,
  height = 300,
}: PerformanceChartProps) {
  const isUp = useMemo(() => {
    if (!data || data.length < 2) return true;
    return data[data.length - 1].value >= data[0].value;
  }, [data]);

  const color = isUp ? "#34d399" : "#f87171";
  const gradientId = isUp ? "gradientGain" : "gradientLoss";

  if (!data || data.length === 0) {
    return (
      <div
        className="w-full rounded-lg overflow-hidden flex items-center justify-center bg-card"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">No performance data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#6b6561", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#6b6561", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0a0a0a",
            border: "1px solid #1c1c1c",
            borderRadius: 8,
            color: "#e8e6e3",
          }}
          formatter={(value) => [`$${Number(value).toLocaleString()}`, "Value"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
