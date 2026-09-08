"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

export interface TrendPoint {
  month: string; // "Sep 2026"
  credits: number;
}

export function CreditTrendChart({
  data,
  threshold,
}: {
  data: TrendPoint[];
  threshold?: number;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          {threshold != null && (
            <ReferenceLine
              y={threshold}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: `Tier min ${threshold}`, fontSize: 11, fill: "#b45309", position: "insideTopRight" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="credits"
            stroke="#0f172a"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
