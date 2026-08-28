"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { fmtCompact } from "@/lib/format";

interface TokenChartProps {
  data: { date: string; tokens: number }[];
  title: string;
  color?: string;
}

export function TokenChart({ data, title, color = "var(--tool-gemini)" }: TokenChartProps) {
  const last30 = data.slice(-30).map((d) => ({
    ...d,
    date: d.date.slice(5),
  }));

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
      <h3 className="font-semibold mb-4 text-[var(--ink)]">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={last30}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: unknown) => [typeof v === "number" ? fmtCompact(v) : String(v ?? ""), "トークン"]) as any}
            contentStyle={{ backgroundColor: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "8px" }}
          />
          <Bar dataKey="tokens" name="トークン" fill={color} opacity={0.85} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
