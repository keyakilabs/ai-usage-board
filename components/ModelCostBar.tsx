"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { fmtCost } from "@/lib/format";

const COLORS: Record<string, string> = {
  opus: "#9A6B1F",
  sonnet: "#2E5E7E",
  haiku: "#3E6B4F",
};

function modelColor(name: string): string {
  if (name.includes("opus")) return COLORS.opus;
  if (name.includes("haiku")) return COLORS.haiku;
  return COLORS.sonnet;
}

function shortName(name: string): string {
  const m = name.match(/claude-(\w+)-(\d)/);
  if (m) return `${m[1]}-${m[2]}`;
  return name.replace("claude-", "").slice(0, 16);
}

interface Props {
  data: Record<string, { cost?: number }>;
  title: string;
  /** 値の書式。既定は金額（$）。トークン数を並べるときは fmtCompact などを渡す */
  format?: (n: number) => string;
}

export function ModelCostBar({ data, title, format = fmtCost }: Props) {
  const entries = Object.entries(data)
    .map(([name, v]) => ({ name: shortName(name), fullName: name, cost: v.cost ?? 0 }))
    .filter((e) => e.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  const max = entries[0]?.cost ?? 1;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
      <h3 className="font-semibold mb-4 text-[var(--ink)]">{title}</h3>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.fullName}>
            <div className="flex items-center justify-between mb-1 text-xs text-[var(--muted)]">
              <span>{e.name}</span>
              <span className="font-mono">{format(e.cost)}</span>
            </div>
            <div className="h-2 bg-[var(--accent-soft)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(e.cost / max) * 100}%`, backgroundColor: modelColor(e.fullName) }}
              />
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-sm text-[var(--muted)] text-center py-4">この期間はデータなし</div>
        )}
      </div>
    </div>
  );
}
