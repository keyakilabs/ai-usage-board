"use client";

import { fmtCost, fmtCompact } from "@/lib/format";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#2E5E7E", "#3E6B4F", "#9A6B1F", "#A3432B", "#6A4C93", "#8C5A6E"];

interface ModelBreakdownProps {
  data: Record<string, { sessions?: number; tokens?: number; cost?: number }>;
  title: string;
  valueKey?: "sessions" | "tokens" | "cost";
}

const fmtValue = (v: number, key: string) =>
  key === "cost" ? fmtCost(v) : fmtCompact(v);

const labelMap: Record<string, string> = { sessions: "セッション", tokens: "トークン", cost: "コスト" };

export function ModelBreakdown({ data, title, valueKey = "tokens" }: ModelBreakdownProps) {
  const entries = Object.entries(data)
    .map(([name, v]) => ({ name, value: v[valueKey] || 0 }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
      <h3 className="font-semibold mb-4 text-[var(--ink)]">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={entries}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {entries.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: unknown) => [typeof v === "number" ? fmtValue(v, valueKey) : String(v ?? ""), labelMap[valueKey]]) as any}
            contentStyle={{ backgroundColor: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "8px" }}
          />
          <Legend
            formatter={(v) => <span className="text-xs text-[var(--muted)]">{v}</span>}
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
