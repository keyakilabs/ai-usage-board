import fs from "fs";
import path from "path";
import type { ClaudeCodeStats, ClaudeProfile, DailyCost, ModelUsage } from "./types";

const HOME = process.env.HOME || "";
const CACHE_TTL_MS = 5 * 60 * 1000;

function getModelPricing(model: string) {
  const m = model.toLowerCase();
  if (m.includes("opus")) return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 };
  if (m.includes("haiku")) return { input: 0.8, output: 4, cacheWrite: 1.0, cacheRead: 0.08 };
  return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };
}

function calcCost(model: string, input: number, output: number, cacheWrite: number, cacheRead: number): number {
  const p = getModelPricing(model);
  return (input * p.input + output * p.output + cacheWrite * p.cacheWrite + cacheRead * p.cacheRead) / 1_000_000;
}

function findJSONLFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...findJSONLFiles(fullPath));
      else if (entry.name.endsWith(".jsonl")) results.push(fullPath);
    }
  } catch {}
  return results;
}

function discoverProfiles(): { name: string; dir: string }[] {
  const profiles: { name: string; dir: string }[] = [];
  try {
    const entries = fs.readdirSync(HOME, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === ".claude" || /^\.claude-.+/.test(entry.name)) {
        const name = entry.name === ".claude" ? "default" : entry.name.slice(".claude-".length);
        profiles.push({ name, dir: path.join(HOME, entry.name) });
      }
    }
  } catch {}
  return profiles;
}

interface ParsedJSONL {
  dailyCosts: DailyCost[];
  totalCostUSD: number;
  /** JSONL ファイル1本 = 1セッション。課金対象の記録が1件でもあるものだけ数える。 */
  totalSessions: number;
  /** 課金対象だったアシスタント応答の件数。 */
  totalMessages: number;
  /** モデル別の累計。以前は stats-cache.json から取っていた。 */
  modelUsage: Record<string, ModelUsage>;
  /** 記録が残っている最後の日付。 */
  lastActivityDate: string;
}

const profileJSONLCache = new Map<string, ParsedJSONL & { expiresAt: number }>();

function parseJSONLForDir(projectsDir: string): ParsedJSONL {
  const dailyMap = new Map<string, {
    total: number; byModel: Record<string, number>;
    input: number; output: number; cacheWrite: number; cacheRead: number;
    hours: Record<number, number>;
  }>();

  const modelUsage: Record<string, ModelUsage> = {};
  let totalSessions = 0;
  let totalMessages = 0;

  for (const file of findJSONLFiles(projectsDir)) {
    try {
      let countedInThisFile = 0;
      const content = fs.readFileSync(file, "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type !== "assistant") continue;
          const msg = entry.message;
          if (!msg?.usage || !msg?.model) continue;
          const ts: string = entry.timestamp;
          if (!ts) continue;
          const date = ts.slice(0, 10);
          const { input_tokens = 0, output_tokens = 0, cache_creation_input_tokens = 0, cache_read_input_tokens = 0 } = msg.usage;
          const cost = calcCost(msg.model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens);
          if (cost <= 0) continue;
          const hour = new Date(ts).getHours();
          const existing = dailyMap.get(date) || { total: 0, byModel: {}, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, hours: {} };
          existing.total += cost;
          existing.byModel[msg.model] = (existing.byModel[msg.model] || 0) + cost;
          existing.input += input_tokens;
          existing.output += output_tokens;
          existing.cacheWrite += cache_creation_input_tokens;
          existing.cacheRead += cache_read_input_tokens;
          existing.hours[hour] = (existing.hours[hour] || 0) + 1;
          dailyMap.set(date, existing);

          const mu = (modelUsage[msg.model] ||= {
            inputTokens: 0, outputTokens: 0,
            cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0,
          });
          mu.inputTokens += input_tokens;
          mu.outputTokens += output_tokens;
          mu.cacheReadInputTokens += cache_read_input_tokens;
          mu.cacheCreationInputTokens += cache_creation_input_tokens;
          mu.costUSD += cost;

          countedInThisFile++;
          totalMessages++;
        } catch {}
      }
      if (countedInThisFile > 0) totalSessions++;
    } catch {}
  }

  const dailyCosts: DailyCost[] = Array.from(dailyMap.entries())
    .map(([date, v]) => ({
      date, costUSD: v.total, byModel: v.byModel,
      inputTokens: v.input, outputTokens: v.output,
      cacheWriteTokens: v.cacheWrite, cacheReadTokens: v.cacheRead,
      hourCounts: v.hours,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    dailyCosts,
    totalCostUSD: dailyCosts.reduce((s, d) => s + d.costUSD, 0),
    totalSessions,
    totalMessages,
    modelUsage,
    lastActivityDate: dailyCosts.length ? dailyCosts[dailyCosts.length - 1].date : "",
  };
}

function getCachedJSONL(name: string, projectsDir: string): ParsedJSONL {
  const now = Date.now();
  const cached = profileJSONLCache.get(name);
  if (cached && now < cached.expiresAt) {
    const { expiresAt: _drop, ...rest } = cached;
    return rest;
  }
  const stats = parseJSONLForDir(projectsDir);
  profileJSONLCache.set(name, { ...stats, expiresAt: now + CACHE_TTL_MS });
  return stats;
}

function mergeDailyCosts(allCosts: DailyCost[][]): DailyCost[] {
  const map = new Map<string, DailyCost>();
  for (const costs of allCosts) {
    for (const d of costs) {
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
        for (const [h, n] of Object.entries(d.hourCounts)) ex.hourCounts[Number(h)] = (ex.hourCounts[Number(h)] ?? 0) + n;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function getClaudeProfiles(): ClaudeProfile[] {
  return discoverProfiles().map(({ name, dir }) => {
    // ⚠️ 以前は stats-cache.json から セッション数・メッセージ数・モデル別を取っていたが、
    // Claude Code 側がこのファイルを更新しなくなったため、表示が数ヶ月前で固まっていた。
    // すべて JSONL の実データから数える（lastComputedDate は互換のため残すが表示には使わない）。
    let lastComputedDate = "";
    try {
      const raw = fs.readFileSync(path.join(dir, "stats-cache.json"), "utf-8");
      lastComputedDate = (JSON.parse(raw) as ClaudeCodeStats).lastComputedDate ?? "";
    } catch {}

    const j = getCachedJSONL(name, path.join(dir, "projects"));
    return {
      name,
      dailyCosts: j.dailyCosts,
      totalCostUSD: j.totalCostUSD,
      totalSessions: j.totalSessions,
      totalMessages: j.totalMessages,
      modelUsage: j.modelUsage,
      lastActivityDate: j.lastActivityDate,
      lastComputedDate,
    };
  });
}

export function getClaudeCodeStats(): ClaudeCodeStats | null {
  try {
    const profiles = discoverProfiles();
    if (profiles.length === 0) return null;

    let base: ClaudeCodeStats | null = null;
    for (const { dir } of profiles) {
      try {
        const raw = fs.readFileSync(path.join(dir, "stats-cache.json"), "utf-8");
        const parsed = JSON.parse(raw) as ClaudeCodeStats;
        if (!base) {
          base = parsed;
        } else {
          const prev = base as ClaudeCodeStats;
          base = {
            ...prev,
            totalSessions: prev.totalSessions + parsed.totalSessions,
            totalMessages: prev.totalMessages + parsed.totalMessages,
            lastComputedDate: parsed.lastComputedDate > prev.lastComputedDate
              ? parsed.lastComputedDate
              : prev.lastComputedDate,
            dailyActivity: [...prev.dailyActivity, ...parsed.dailyActivity]
              .sort((a, b) => a.date.localeCompare(b.date)),
          };
        }
      } catch {}
    }
    if (!base) base = { dailyActivity: [], dailyModelTokens: [], modelUsage: {}, hourCounts: {}, totalSessions: 0, totalMessages: 0, lastComputedDate: "", lastActivityDate: "", dailyCosts: [], totalCostUSD: 0 };

    const parsed = profiles.map(({ name, dir }) => getCachedJSONL(name, path.join(dir, "projects")));
    const dailyCosts = mergeDailyCosts(parsed.map((p) => p.dailyCosts));
    const totalCostUSD = dailyCosts.reduce((s, d) => s + d.costUSD, 0);

    // セッション数・メッセージ数・モデル別も JSONL から合算する（stats-cache は使わない）。
    const totalSessions = parsed.reduce((s, p) => s + p.totalSessions, 0);
    const totalMessages = parsed.reduce((s, p) => s + p.totalMessages, 0);
    const modelUsage: Record<string, ModelUsage> = {};
    for (const p of parsed) {
      for (const [model, u] of Object.entries(p.modelUsage)) {
        const mu = (modelUsage[model] ||= {
          inputTokens: 0, outputTokens: 0,
          cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0,
        });
        mu.inputTokens += u.inputTokens;
        mu.outputTokens += u.outputTokens;
        mu.cacheReadInputTokens += u.cacheReadInputTokens;
        mu.cacheCreationInputTokens += u.cacheCreationInputTokens;
        mu.costUSD += u.costUSD;
      }
    }
    const lastActivityDate = dailyCosts.length ? dailyCosts[dailyCosts.length - 1].date : "";

    return { ...base, dailyCosts, totalCostUSD, totalSessions, totalMessages, modelUsage, lastActivityDate };
  } catch {
    return null;
  }
}
