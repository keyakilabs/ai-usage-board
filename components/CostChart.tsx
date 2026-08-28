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
import { fmtCost } from "@/lib/format";

interface CostChartProps {
  data: { date: string; cc?: number; oc?: number }[];
  title: string;
  showCC?: boolean;
  showOC?: boolean;
}

export function CostChart({ data, title, showCC = true, showOC = true }: CostChartProps) {
  const formatted = data.map((d) => ({ ...d, date: d.date.slice(5) }));

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
      <h3 className="font-semibold mb-4 text-[var(--ink)]">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted)" }} />
          <YAxis tickFormatter={fmtCost} tick={{ fontSize: 11, fill: "var(--muted)" }} width={55} />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            formatter={((v: unknown, name: unknown) => [typeof v === "number" ? fmtCost(v) : String(v ?? ""), name === "cc" ? "Claude Code" : "OpenCode"]) as any}
            contentStyle={{ backgroundColor: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "8px" }}
          />
          {(showCC || showOC) && <Legend formatter={(v) => (v === "cc" ? "Claude Code" : "OpenCode")} />}
          {showCC && <Bar dataKey="cc" name="cc" fill="var(--tool-cc)" opacity={0.85} radius={[2, 2, 0, 0]} stackId="a" />}
          {showOC && <Bar dataKey="oc" name="oc" fill="var(--tool-oc)" opacity={0.85} radius={[2, 2, 0, 0]} stackId="a" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
