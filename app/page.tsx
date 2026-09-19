"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardData } from "@/lib/types";
import { CostChart } from "@/components/CostChart";
import { ModelCostBar } from "@/components/ModelCostBar";
import { HourHeatmap } from "@/components/HourHeatmap";
import { TokenChart } from "@/components/TokenChart";
import { fmtCost, fmtInt, fmtCompact } from "@/lib/format";

type Period = "今日" | "今週" | "今月" | "全期間";
type Tool = "cc" | "oc" | "gemini" | "ag";

function getPeriodRange(period: Period): { start: string; end: string } | null {
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = fmt(today);
  if (period === "今日") return { start: todayStr, end: todayStr };
  if (period === "今週") {
    const d = new Date(today);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return { start: fmt(d), end: todayStr };
  }
  if (period === "今月") {
    return { start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, end: todayStr };
  }
  return null;
}

function filterByPeriod<T extends { date: string }>(items: T[], period: Period): T[] {
  const range = getPeriodRange(period);
  if (!range) return items;
  return items.filter((d) => d.date >= range.start && d.date <= range.end);
}

// 数値整形は lib/format.ts に集約している

const PERIODS: Period[] = ["今日", "今週", "今月", "全期間"];
const TOOLS: { id: Tool; label: string; accent: string; border: string }[] = [
  { id: "cc",     label: "Claude Code", accent: "text-[var(--tool-cc)]",     border: "border-[var(--line)]" },
  { id: "oc",     label: "OpenCode",    accent: "text-[var(--tool-oc)]",     border: "border-[var(--line)]" },
  { id: "gemini", label: "Gemini CLI",  accent: "text-[var(--tool-gemini)]", border: "border-[var(--line)]" },
  { id: "ag",     label: "Antigravity", accent: "text-[var(--tool-ag)]",     border: "border-[var(--line)]" },
];

interface StatCard { label: string; value: string; sub?: string }

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("今月");
  const [activeTool, setActiveTool] = useState<Tool>("cc");
  const [ccProfile, setCCProfile] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/data");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString("ja-JP"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cc = data?.claudeCode;
  const oc = data?.openCode;
  const ag = data?.antigravity;
  const gm = data?.gemini;
  const profiles = data?.claudeProfiles ?? [];

  const activeCC = useMemo(() => {
    if (ccProfile === "all" || profiles.length <= 1) return cc;
    const p = profiles.find((prof) => prof.name === ccProfile);
    if (!p || !cc) return cc;
    return { ...cc, dailyCosts: p.dailyCosts, totalCostUSD: p.totalCostUSD, totalSessions: p.totalSessions, totalMessages: p.totalMessages, lastComputedDate: p.lastComputedDate, lastActivityDate: p.lastActivityDate, modelUsage: p.modelUsage };
  }, [cc, ccProfile, profiles]);

  const filteredCC = useMemo(() => filterByPeriod(activeCC?.dailyCosts ?? [], period), [activeCC?.dailyCosts, period]);
  const filteredOC = useMemo(() => filterByPeriod(oc?.dailyTokens ?? [], period), [oc?.dailyTokens, period]);
  const filteredAG = useMemo(() => filterByPeriod(ag?.recentSessions.map(d => ({ date: d.date, count: d.count })) ?? [], period), [ag?.recentSessions, period]);
  const filteredGM = useMemo(() => filterByPeriod(gm?.recentSessions ?? [], period), [gm?.recentSessions, period]);

  const ccCost = filteredCC.reduce((s, d) => s + d.costUSD, 0);
  const ocCost = filteredOC.reduce((s, d) => s + d.cost, 0);
  const totalCost = ccCost + ocCost;

  const ccTokens = filteredCC.reduce((s, d) => s + d.inputTokens + d.outputTokens + d.cacheWriteTokens + d.cacheReadTokens, 0);

  const filteredHourCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCC.forEach((d) => {
      Object.entries(d.hourCounts ?? {}).forEach(([h, n]) => {
        counts[h] = (counts[h] ?? 0) + n;
      });
    });
    return counts;
  }, [filteredCC]);
  const ocTokens = filteredOC.reduce((s, d) => s + d.input + d.output, 0);

  const modelCostData = useMemo(() => {
    if (!activeCC) return {};
    if (period === "全期間") return Object.fromEntries(Object.entries(activeCC.modelUsage).map(([k, v]) => [k, { cost: v.costUSD }]));
    const totals: Record<string, number> = {};
    filteredCC.forEach((d) => Object.entries(d.byModel).forEach(([m, c]) => { totals[m] = (totals[m] ?? 0) + c; }));
    return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, { cost: v }]));
  }, [activeCC, filteredCC, period]);

  const ocModelData = useMemo(() => {
    if (!oc) return {};
    return Object.fromEntries(
      Object.entries(oc.modelBreakdown).map(([k, v]) => [k, { cost: v.tokens }])
    );
  }, [oc]);

  const toolStats: Record<Tool, StatCard[]> = {
    cc: [
      { label: "コスト",          value: activeCC ? fmtCost(ccCost)                  : "-", sub: activeCC ? `全期間 ${fmtCost(activeCC.totalCostUSD)}` : undefined },
      { label: "トークン",        value: activeCC ? fmtCompact(ccTokens)             : "-", sub: "入出力+キャッシュ" },
      { label: "セッション",      value: activeCC ? fmtInt(activeCC.totalSessions)   : "-", sub: "全期間" },
      { label: "最終記録",        value: activeCC?.lastActivityDate || "-",             sub: "ログの最新日" },
    ],
    oc: [
      { label: "コスト",          value: oc ? fmtCost(ocCost)              : "-", sub: oc ? `全期間 ${fmtCost(oc.totalCost)}` : undefined },
      { label: "トークン",        value: oc ? fmtCompact(ocTokens)         : "-", sub: "入出力" },
      { label: "セッション",      value: oc ? fmtInt(oc.totalSessions)     : "-", sub: "全期間" },
      { label: "モデル数",        value: oc ? String(Object.keys(oc.modelBreakdown).length) : "-", sub: "使用モデル" },
    ],
    gemini: [
      { label: "コスト",          value: "計測外",                           sub: "無料枠" },
      { label: "トークン",        value: "計測外",                           sub: "データなし" },
      { label: "セッション",      value: gm ? fmtInt(gm.totalSessions)     : "-", sub: "累計" },
      { label: "期間",            value: gm ? (gm.recentSessions[0]?.date ?? "-") : "-", sub: "〜 " + (gm?.recentSessions[gm.recentSessions.length - 1]?.date ?? "-") },
    ],
    ag: [
      { label: "コスト",          value: "計測外",                           sub: "データなし" },
      { label: "トークン",        value: "計測外",                           sub: "データなし" },
      { label: "起動回数",        value: ag ? fmtInt(ag.totalSessions)     : "-", sub: "累計" },
      { label: "直近30日",        value: ag ? fmtInt(ag.recentSessions.reduce((s, d) => s + d.count, 0)) : "-", sub: "起動" },
    ],
  };

  const activeToolMeta = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="border-b border-[var(--line)] bg-[var(--paper-raised)] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-lg font-bold truncate">AI Usage Board</h1>
            {data?.demo ? (
              <span
                className="shrink-0 rounded-full border border-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent)]"
                title="--demo で起動しています。表示中の数値はすべてサンプルで、手元のログは読み込んでいません。"
              >
                サンプルデータ
              </span>
            ) : null}
            <a
              href="https://www.keyaki-labs.com/products/ai-usage-board"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden sm:inline text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors whitespace-nowrap"
            >
              Keyaki Labs
            </a>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[var(--line)] overflow-hidden">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm transition-colors ${period === p ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--accent-soft)]"}`}>
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--accent-soft)] disabled:opacity-50 transition-colors"
            >
              <span className={loading ? "animate-spin" : ""}>↻</span>
              {loading ? "更新中..." : lastUpdated ? `更新 ${lastUpdated}` : "更新"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "合計コスト",    value: fmtCost(totalCost),                               sub: period,                   border: "border-[var(--line)]" },
            { label: "Claude Code",   value: fmtCost(ccCost),                                  sub: `全期間 ${fmtCost(cc?.totalCostUSD ?? 0)}`, border: "border-[var(--line)]", accent: "text-[var(--tool-cc)]" },
            { label: "OpenCode",      value: fmtCost(ocCost),                                  sub: `全期間 ${fmtCost(oc?.totalCost ?? 0)}`,     border: "border-[var(--line)]", accent: "text-[var(--tool-oc)]" },
            { label: "セッション合計", value: fmtInt((cc?.totalSessions ?? 0) + (oc?.totalSessions ?? 0)), sub: "CC + OC",              border: "border-[var(--line)]" },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl bg-[var(--paper-raised)] border ${card.border} p-4`}>
              <div className={`text-xs mb-1 ${card.accent ?? "text-[var(--muted)]"}`}>{card.label}</div>
              <div className="text-3xl font-bold">{card.value}</div>
              <div className="text-xs text-[var(--muted)] mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          ⚠️ コストはトークン使用量からAPI単価で計算した推定値です。サブスクリプション料金（Claude Max・Gemini Advanced等）は含まれません。
        </p>

        <div className="flex gap-1 border-b border-[var(--line)]">
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setActiveTool(t.id)}
              className={`px-4 py-2 text-sm rounded-t-lg transition-colors border-b-2 ${
                activeTool === t.id
                  ? `${t.accent} border-current bg-[var(--paper-raised)]`
                  : "text-[var(--muted)] border-transparent hover:text-[var(--ink)] hover:bg-[var(--paper-raised)]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {activeTool === "cc" && profiles.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {[{ name: "all", label: "全プロファイル" }, ...profiles.map((p) => ({ name: p.name, label: p.name }))].map(({ name, label }) => (
                <button key={name} onClick={() => setCCProfile(name)}
                  className={`px-3 py-1 text-xs rounded-lg border transition-colors ${ccProfile === name ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--line)] text-[var(--muted)] hover:bg-[var(--accent-soft)]"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {toolStats[activeTool].map((card) => (
              <div key={card.label} className={`rounded-xl bg-[var(--paper-raised)] border ${activeToolMeta.border} p-4`}>
                <div className={`text-xs mb-1 ${activeToolMeta.accent}`}>{card.label}</div>
                <div className={`text-2xl font-bold ${card.value === "計測外" ? "text-[var(--muted)]" : ""}`}>{card.value}</div>
                {card.sub && <div className="text-xs text-[var(--muted)] mt-0.5">{card.sub}</div>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeTool === "cc" && (
              <CostChart data={filteredCC.map(d => ({ date: d.date, cc: d.costUSD }))} title={`日別コスト（${period}）`} showOC={false} />
            )}
            {activeTool === "oc" && (
              <CostChart data={filteredOC.map(d => ({ date: d.date, oc: d.cost }))} title={`日別コスト（${period}）`} showCC={false} />
            )}
            {activeTool === "gemini" && (
              <TokenChart data={filteredGM.map(d => ({ date: d.date, tokens: d.sessions }))} title={`日別セッション数（${period}）`} color="var(--tool-gemini)" />
            )}
            {activeTool === "ag" && (
              <TokenChart data={filteredAG.map(d => ({ date: d.date, tokens: d.count }))} title={`日別起動回数（${period}）`} color="var(--tool-ag)" />
            )}

            {activeTool === "cc" && <ModelCostBar data={modelCostData} title="モデル別コスト" />}
            {activeTool === "oc" && <ModelCostBar data={ocModelData} title="モデル別トークン" format={fmtCompact} />}
            {activeTool === "gemini" && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 flex items-center justify-center text-[var(--muted)] text-sm">
                Gemini CLI はトークン・コスト非公開
              </div>
            )}
            {activeTool === "ag" && (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 flex items-center justify-center text-[var(--muted)] text-sm">
                Antigravity はコスト非公開
              </div>
            )}
          </div>

          {activeTool === "cc" && <HourHeatmap hourCounts={filteredHourCounts} />}
        </div>

        {!data && (
          <div className="flex items-center justify-center h-64 text-[var(--muted)]">データを読み込み中...</div>
        )}

        <footer className="pt-2 pb-6 text-xs text-[var(--muted)] border-t border-[var(--line)] flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            {data?.demo
              ? "サンプルデータを表示しています。手元のログは読み込んでいません（--demo を外すと実データになります）。"
              : "読み取ったデータは外部に送信していません（このページは localhost で動いています）。"}
          </span>
          <a
            href="https://www.keyaki-labs.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-[var(--accent)] transition-colors"
          >
            Keyaki Labs →
          </a>
        </footer>
      </div>
    </div>
  );
}
