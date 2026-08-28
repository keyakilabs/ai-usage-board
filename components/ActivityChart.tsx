"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface ActivityChartProps {
  data: { date: string; messages: number; sessions: number; toolCalls: number }[];
  title: string;
}

export function ActivityChart({ data, title }: ActivityChartProps) {
  const last30 = data.slice(-30);
  const formatted = last30.map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
      <h3 className="font-semibold mb-4 text-[var(--ink)]">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "8px" }}
            labelStyle={{ color: "var(--ink)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="messages" name="メッセージ" fill="var(--tool-cc)" opacity={0.8} />
          <Line yAxisId="right" dataKey="sessions" name="セッション" stroke="var(--tool-oc)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
