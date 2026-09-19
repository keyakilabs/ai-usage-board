import fs from "fs";
import path from "path";
import type { ClaudeCodeStats, ClaudeProfile, DailyCost, ModelUsage } from "./types";
import { toLocalDate } from "./date";

const HOME = process.env.HOME || "";
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * API単価（USD / 100万トークン）。出典は公式の料金ページ。
 * https://platform.claude.com/docs/en/about-claude/pricing （最終確認: 2026-09-19）
 *
 * ⚠️ モデル名だけで "opus" → 一律、としてはいけない。単価は世代ごとに改定される。
 * 実際 Opus は 4.5 で $15/$75 → $5/$25 に下がっており、世代を見ないと3倍ずれる。
 *
 * キャッシュ書き込みは 5分（base × 1.25）と 1時間（base × 2）で単価が違う。
 * 読み出しは base × 0.1（Fable/Mythos 5.1 だけ × 0.025）。
 */
type Pricing = {
  input: number;
  output: number;
  /** 5分キャッシュへの書き込み（base × 1.25） */
  cacheWrite: number;
  /** 1時間キャッシュへの書き込み（base × 2） */
  cacheWrite1h: number;
  cacheRead: number;
};

/** base 単価から各単価を導く。readMul は読み出しの乗数（5.1 世代だけ 0.025）。 */
function withCache(input: number, output: number, readMul = 0.1): Pricing {
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    input,
    output,
    cacheWrite: round(input * 1.25),
    cacheWrite1h: round(input * 2),
    cacheRead: round(input * readMul),
  };
}

/**
 * モデルID から世代を取り出す。`major * 100 + minor` の整数で返す
 * （4.5 → 405、4.10 → 410、5 → 500、5.1 → 501）。
 * 小数で持つと 4.1 と 4.10 が同じ値になるため、小数部は桁ごと整数で持つ。
 *
 * IDの形式は2種類あり、世代の位置が違う。
 *   新: `claude-opus-4-5-20251101` → 405 ／ `claude-fable-5-1` → 501（世代が後ろ）
 *   旧: `claude-3-5-haiku-20241022` → 305 ／ `claude-3-opus-20240229` → 300（世代が前）
 * 末尾の8桁は日付なので世代として読まない。
 * プロキシ経由（OpenRouter 等）のログには `claude-opus-4.5` のようなドット区切りの名前が入るので、
 * 区切りはハイフンとドットの両方を受ける。
 */
function parseGeneration(model: string): number | null {
  const toGen = (major: string, minor?: string) => {
    if (major.length >= 3) return null; // 日付やビルド番号を世代と読み違えない
    const m = minor && minor.length <= 2 ? Number(minor) : 0;
    return Number(major) * 100 + m;
  };

  // 旧形式を先に見る（`claude-3-5-haiku-...` は後ろにも数字が続くため）
  const old = model.match(/claude-(\d+)(?:[-.](\d+))?-(?:opus|sonnet|haiku|fable|mythos)/);
  if (old) return toGen(old[1], old[2]);

  const cur = model.match(/(?:opus|sonnet|haiku|fable|mythos)-(\d+)(?:[-.](\d+))?/);
  if (cur) return toGen(cur[1], cur[2]);

  return null;
}

/**
 * 🔴 世代が読めないとき（`"model":"opus"` のようなエイリアス）は、
 * どの系統でも**現行世代**の単価に倒す。引退した世代の単価を既定にしない。
 */
function getModelPricing(model: string): Pricing {
  const m = model.toLowerCase();
  const gen = parseGeneration(m);

  // Fable / Mythos は Opus とは別の価格帯（$10/$50）。5.1 世代は読み出しだけ 0.025x の特例
  if (m.includes("fable") || m.includes("mythos")) {
    return withCache(10, 50, gen === null || gen >= 501 ? 0.025 : 0.1);
  }
  if (m.includes("opus")) {
    // 4.5 以降は $5/$25。4.1 以前（引退済み）は $15/$75
    if (gen === null || gen >= 405) return withCache(5, 25);
    return withCache(15, 75);
  }
  if (m.includes("haiku")) {
    // 4.5 は $1/$5。3.5 は $0.8/$4（引退済み）
    if (gen === null || gen >= 400) return withCache(1, 5);
    if (gen >= 305) return withCache(0.8, 4);
    // Haiku 3（引退済み）はキャッシュ単価が乗数どおりでなかった（書き込み $0.30・読み出し $0.03）
    return { input: 0.25, output: 1.25, cacheWrite: 0.3, cacheWrite1h: 0.5, cacheRead: 0.03 };
  }
  // Sonnet 5 は $2/$10。4.6 以前は $3/$15
  if (gen === null || gen >= 500) return withCache(2, 10);
  return withCache(3, 15);
}

/**
 * 応答ごとの料金の補正。どちらも全区分（入力・出力・キャッシュ）に掛かり、重ねて掛かる。
 *   - fast mode（`usage.speed: "fast"`）: 2倍。公式の fast mode 料金があるのは Opus 5 / 4.8 だけ。
 *     Opus 4.6 は fast を指定しても標準の速度・標準料金になるので2倍にしない
 *   - US 限定の推論（`usage.inference_geo: "us"`）: 1.1倍。対象は Claude 4.6 以降だけ
 */
function priceMultiplier(model: string, usage: { speed?: string; inference_geo?: string }): number {
  const m = model.toLowerCase();
  const gen = parseGeneration(m);
  let mul = 1;
  if (usage.speed === "fast" && m.includes("opus") && (gen === null || gen >= 408)) mul *= 2;
  if (usage.inference_geo === "us" && (gen === null || gen >= 406)) mul *= 1.1;
  return mul;
}

/**
 * キャッシュ書き込みは 5分と 1時間で単価が違うので分けて渡す。
 * mul は priceMultiplier の値。
 */
function calcCost(
  model: string,
  input: number,
  output: number,
  cacheWrite5m: number,
  cacheWrite1h: number,
  cacheRead: number,
  mul = 1,
): number {
  const p = getModelPricing(model);
  return (
    (input * p.input +
      output * p.output +
      cacheWrite5m * p.cacheWrite +
      cacheWrite1h * p.cacheWrite1h +
      cacheRead * p.cacheRead) *
    mul
  ) / 1_000_000;
}

/**
 * キャッシュ書き込み（`cache_creation_input_tokens`）を 5分ぶん / 1時間ぶん に分ける。
 * 1時間ぶんを内訳（`usage.cache_creation`）から取り、残りを 5分ぶんとする。
 * 内訳が無い古いログは全部 5分ぶんになる。画面のトークン数（合計値）と金額の根拠を揃えるため、
 * 合計値を基準にしている。
 */
function splitCacheWrites(usage: {
  cache_creation_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
}): { w5m: number; w1h: number } {
  const total = usage.cache_creation_input_tokens ?? 0;
  const w1h = Math.min(usage.cache_creation?.ephemeral_1h_input_tokens ?? 0, total);
  return { w5m: total - w1h, w1h };
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

  type AssistantEntry = { message: { id?: string; model: string; usage: Record<string, any> }; timestamp: string };

  /** 1つの応答を集計に足す。金額が0の行（トークン0の合成メッセージ等）は数えない。 */
  const add = (entry: AssistantEntry): boolean => {
    const msg = entry.message;
    const ts = entry.timestamp;
    const date = toLocalDate(ts);
    if (!date) return false;
    const { input_tokens = 0, output_tokens = 0, cache_creation_input_tokens = 0, cache_read_input_tokens = 0 } = msg.usage;
    const { w5m, w1h } = splitCacheWrites(msg.usage);
    const cost = calcCost(msg.model, input_tokens, output_tokens, w5m, w1h, cache_read_input_tokens, priceMultiplier(msg.model, msg.usage));
    if (cost <= 0) return false;
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
    totalMessages++;
    return true;
  };

  /*
   * 🔴 Claude Code は1つの応答を内容ブロック（thinking / text / tool_use）ごとに別の行へ書き出し、
   * どの行にも同じ usage を丸ごと付ける。行ごとに足すと同じ応答を2〜4回数えてしまう
   * （実ログで金額が約1.9倍になっていた）。そこで message.id ごとに1回だけ数える。
   * 同じ応答の行は連続して書かれ、output_tokens は最後の行が最終値なので、最後の行を採る。
   * 別のファイルに同じ応答が現れた場合は、先に数えた方を残す。
   */
  const countedIds = new Set<string>();

  for (const file of findJSONLFiles(projectsDir)) {
    try {
      let countedInThisFile = 0;
      let pending: AssistantEntry | null = null;
      const flush = () => {
        if (!pending) return;
        const id = pending.message.id;
        if (id) {
          if (countedIds.has(id)) { pending = null; return; }
          countedIds.add(id);
        }
        if (add(pending)) countedInThisFile++;
        pending = null;
      };

      const content = fs.readFileSync(file, "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type !== "assistant") continue;
          const msg = entry.message;
          if (!msg?.usage || !msg?.model) continue;
          if (!entry.timestamp) continue;
          const current = entry as AssistantEntry;
          // 同じ応答の続きの行なら、手前の行を捨てて最後の行に置き換える
          if (pending && current.message.id && pending.message.id === current.message.id) {
            pending = current;
            continue;
          }
          flush();
          pending = current;
        } catch {}
      }
      flush();
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
