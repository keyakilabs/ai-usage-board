import path from "path";
import type { OpenCodeStats, OpenCodeSession } from "./types";
import { toLocalDate } from "./date";

const DB_PATH = path.join(
  process.env.HOME || "",
  ".local",
  "share",
  "opencode",
  "opencode.db"
);

export function getOpenCodeStats(): OpenCodeStats | null {
  try {
    // better-sqlite3はサーバーサイドのみで動作
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    const db = new Database(DB_PATH, { readonly: true });

    const sessions = db
      .prepare(
        `SELECT id, title, model, time_created FROM session
       WHERE time_archived IS NULL ORDER BY time_created DESC`
      )
      .all() as {
      id: string;
      title: string;
      model: string;
      time_created: number;
    }[];

    const tokenRows = db
      .prepare(
        `SELECT
          session_id,
          SUM(CAST(json_extract(data, '$.tokens.input') AS INTEGER)) as input_tokens,
          SUM(CAST(json_extract(data, '$.tokens.output') AS INTEGER)) as output_tokens,
          SUM(CAST(json_extract(data, '$.tokens.cache.read') AS INTEGER)) as cache_read,
          SUM(CAST(json_extract(data, '$.tokens.cache.write') AS INTEGER)) as cache_write,
          SUM(CAST(json_extract(data, '$.cost') AS REAL)) as cost
        FROM part
        WHERE json_extract(data, '$.type') = 'step-finish'
        GROUP BY session_id`
      )
      .all() as {
      session_id: string;
      input_tokens: number;
      output_tokens: number;
      cache_read: number;
      cache_write: number;
      cost: number;
    }[];

    db.close();

    const tokenMap = new Map(tokenRows.map((t) => [t.session_id, t]));

    const enriched: OpenCodeSession[] = sessions.map((s) => {
      const t = tokenMap.get(s.id);
      let modelId = "unknown";
      let providerID = "unknown";
      try {
        const m = JSON.parse(s.model || "{}");
        modelId = m.id || "unknown";
        providerID = m.providerID || "unknown";
      } catch {}
      return {
        id: s.id,
        title: s.title,
        model: modelId,
        providerID,
        timeCreated: s.time_created,
        inputTokens: t?.input_tokens || 0,
        outputTokens: t?.output_tokens || 0,
        cacheReadTokens: t?.cache_read || 0,
        cacheWriteTokens: t?.cache_write || 0,
        cost: t?.cost || 0,
      };
    });

    const dailyMap = new Map<string, { input: number; output: number; cost: number }>();
    enriched.forEach((s) => {
      const date = toLocalDate(s.timeCreated);
      const cur = dailyMap.get(date) || { input: 0, output: 0, cost: 0 };
      dailyMap.set(date, {
        input: cur.input + s.inputTokens,
        output: cur.output + s.outputTokens,
        cost: cur.cost + s.cost,
      });
    });

    const dailyTokens = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const modelBreakdown: Record<string, { sessions: number; tokens: number }> = {};
    enriched.forEach((s) => {
      const key = `${s.providerID}/${s.model}`;
      if (!modelBreakdown[key]) modelBreakdown[key] = { sessions: 0, tokens: 0 };
      modelBreakdown[key].sessions++;
      modelBreakdown[key].tokens += s.inputTokens + s.outputTokens;
    });

    return {
      sessions: enriched,
      totalSessions: enriched.length,
      totalInputTokens: enriched.reduce((s, r) => s + r.inputTokens, 0),
      totalOutputTokens: enriched.reduce((s, r) => s + r.outputTokens, 0),
      totalCost: enriched.reduce((s, r) => s + r.cost, 0),
      dailyTokens,
      modelBreakdown,
    };
  } catch (e) {
    console.error("OpenCode stats error:", e);
    return null;
  }
}
