/**
 * デモ用のダミーデータ。
 *
 * `ai-usage-board --demo` で使う。目的は2つ:
 *   1. 手元にログが無い人でも、どんな画面なのかを確かめられるようにする
 *   2. 紹介ページやドキュメントに載せるスクリーンショットを、
 *      実際の利用状況（＝実際の支出額）を晒さずに撮れるようにする
 *
 * ⚠️ 乱数は使わない。実行するたびに数字が変わると、
 * スクリーンショットを撮り直したときに差分が出て比較できなくなるため、
 * 固定シードの疑似乱数で毎回同じ形を出す。
 *
 * ⚠️ 一方で日付は「今日まで」に追従させる。ここを固定日にすると、
 * 画面の既定フィルタ（今月）から外れてグラフが全部空になる。
 * 値は日付ではなく系列上の位置から決まるので、日が変わっても数字の並びは同じ。
 */

import type {
  AntigravityStats,
  ClaudeCodeStats,
  ClaudeProfile,
  DailyCost,
  GeminiStats,
  ModelUsage,
  OpenCodeStats,
} from "./types";

const DEMO_DAYS = 30;

/** デモ系列の最終日 = 今日。ローカル時刻で YYYY-MM-DD。 */
function demoEnd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 決定的な疑似乱数（xorshift）。seed が同じなら必ず同じ列を返す。 */
function makeRandom(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return Math.abs(x % 10000) / 10000;
  };
}

function dateSeries(end: string, days: number): string[] {
  const out: string[] = [];
  const [y, m, d] = end.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  for (let i = days - 1; i >= 0; i--) {
    const t = new Date(base - i * 86400000);
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

const MODELS = [
  { name: "claude-opus-5", weight: 0.55, rate: 1.0 },
  { name: "claude-sonnet-5", weight: 0.3, rate: 0.2 },
  { name: "claude-opus-4-6", weight: 0.1, rate: 0.8 },
  { name: "claude-haiku-4-5", weight: 0.05, rate: 0.05 },
];

function buildDailyCosts(seed: number, scale: number): DailyCost[] {
  const rand = makeRandom(seed);
  return dateSeries(demoEnd(), DEMO_DAYS).map((date, i) => {
    const dow = new Date(date + "T00:00:00Z").getUTCDay();
    // 週末は少なめ。平日でも波があるほうが実物らしく見える
    const weekend = dow === 0 || dow === 6 ? 0.25 : 1;
    const spike = i === DEMO_DAYS - 4 ? 2.4 : 1;
    const total = (8 + rand() * 42) * scale * weekend * spike;

    const byModel: Record<string, number> = {};
    let rest = total;
    MODELS.forEach((m, idx) => {
      const part = idx === MODELS.length - 1 ? rest : total * m.weight;
      byModel[m.name] = Number(part.toFixed(4));
      rest -= part;
    });

    const hourCounts: Record<number, number> = {};
    for (let h = 9; h <= 23; h++) {
      const peak = h >= 10 && h <= 12 ? 2.2 : h >= 20 && h <= 22 ? 1.8 : 1;
      hourCounts[h] = Math.round(rand() * 30 * peak * weekend);
    }

    return {
      date,
      costUSD: Number(total.toFixed(4)),
      byModel,
      inputTokens: Math.round(total * 90),
      outputTokens: Math.round(total * 1400),
      cacheWriteTokens: Math.round(total * 21000),
      cacheReadTokens: Math.round(total * 380000),
      hourCounts,
    };
  });
}

function modelUsageFrom(dailyCosts: DailyCost[]): Record<string, ModelUsage> {
  const out: Record<string, ModelUsage> = {};
  for (const d of dailyCosts) {
    for (const [model, cost] of Object.entries(d.byModel)) {
      const u = (out[model] ||= {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUSD: 0,
      });
      u.costUSD += cost;
      u.inputTokens += Math.round(cost * 90);
      u.outputTokens += Math.round(cost * 1400);
      u.cacheCreationInputTokens += Math.round(cost * 21000);
      u.cacheReadInputTokens += Math.round(cost * 380000);
    }
  }
  return out;
}

function mergeDaily(all: DailyCost[][]): DailyCost[] {
  const map = new Map<string, DailyCost>();
  for (const list of all) {
    for (const d of list) {
      const ex = map.get(d.date);
      if (!ex) {
        map.set(d.date, { ...d, byModel: { ...d.byModel }, hourCounts: { ...d.hourCounts } });
      } else {
        ex.costUSD += d.costUSD;
        ex.inputTokens += d.inputTokens;
        ex.outputTokens += d.outputTokens;
        ex.cacheWriteTokens += d.cacheWriteTokens;
        ex.cacheReadTokens += d.cacheReadTokens;
        for (const [m, c] of Object.entries(d.byModel)) ex.byModel[m] = (ex.byModel[m] ?? 0) + c;
        for (const [h, n] of Object.entries(d.hourCounts))
          ex.hourCounts[Number(h)] = (ex.hourCounts[Number(h)] ?? 0) + n;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

const PROFILE_SEEDS: { name: string; seed: number; scale: number; sessions: number }[] = [
  { name: "default", seed: 20260314, scale: 1.0, sessions: 214 },
  { name: "work", seed: 77712, scale: 0.55, sessions: 118 },
];

export function getDemoClaudeProfiles(): ClaudeProfile[] {
  return PROFILE_SEEDS.map((p) => {
    const dailyCosts = buildDailyCosts(p.seed, p.scale);
    return {
      name: p.name,
      dailyCosts,
      totalCostUSD: dailyCosts.reduce((s, d) => s + d.costUSD, 0),
      totalSessions: p.sessions,
      totalMessages: p.sessions * 108,
      lastComputedDate: "",
      lastActivityDate: demoEnd(),
      modelUsage: modelUsageFrom(dailyCosts),
    };
  });
}

export function getDemoClaudeCodeStats(): ClaudeCodeStats {
  const profiles = getDemoClaudeProfiles();
  const dailyCosts = mergeDaily(profiles.map((p) => p.dailyCosts));
  return {
    dailyActivity: [],
    dailyModelTokens: [],
    hourCounts: {},
    modelUsage: modelUsageFrom(dailyCosts),
    totalSessions: profiles.reduce((s, p) => s + p.totalSessions, 0),
    totalMessages: profiles.reduce((s, p) => s + p.totalMessages, 0),
    lastComputedDate: "",
    lastActivityDate: demoEnd(),
    dailyCosts,
    totalCostUSD: dailyCosts.reduce((s, d) => s + d.costUSD, 0),
  };
}

export function getDemoOpenCodeStats(): OpenCodeStats {
  const rand = makeRandom(4242);
  const dailyTokens = dateSeries(demoEnd(), DEMO_DAYS).map((date) => {
    const cost = Number((rand() * 1.6).toFixed(4));
    return { date, input: Math.round(cost * 5200), output: Math.round(cost * 900), cost };
  });
  return {
    sessions: [],
    totalSessions: 46,
    totalInputTokens: dailyTokens.reduce((s, d) => s + d.input, 0),
    totalOutputTokens: dailyTokens.reduce((s, d) => s + d.output, 0),
    totalCost: dailyTokens.reduce((s, d) => s + d.cost, 0),
    dailyTokens,
    modelBreakdown: {
      "anthropic/claude-sonnet-5": { sessions: 31, tokens: 4820000 },
      "openai/gpt-5": { sessions: 11, tokens: 1310000 },
      "google/gemini-3-pro": { sessions: 4, tokens: 420000 },
    },
  };
}

export function getDemoAntigravityStats(): AntigravityStats {
  const rand = makeRandom(909);
  const recent = dateSeries(demoEnd(), DEMO_DAYS).map((date) => ({
    date,
    count: Math.round(rand() * 6),
  }));
  return {
    sessionDates: recent.map((r) => r.date),
    totalSessions: recent.reduce((s, r) => s + r.count, 0),
    recentSessions: recent,
  };
}

export function getDemoGeminiStats(): GeminiStats {
  const rand = makeRandom(1357);
  const recent = dateSeries(demoEnd(), DEMO_DAYS).map((date) => {
    const sessions = Math.round(rand() * 9);
    return { date, sessions, messages: sessions * 14 };
  });
  return {
    totalSessions: recent.reduce((s, r) => s + r.sessions, 0),
    recentSessions: recent,
  };
}

/** デモモードで動いているか。CLI の --demo が環境変数に落としている。 */
export function isDemoMode(): boolean {
  return process.env.AI_USAGE_BOARD_DEMO === "1";
}
