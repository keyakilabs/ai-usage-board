import fs from "fs";
import path from "path";
import type { GeminiStats } from "./types";
import { toLocalDate } from "./date";

const TMP_DIR = path.join(process.env.HOME || "", ".gemini", "tmp");

export function getGeminiStats(): GeminiStats | null {
  try {
    const projectDirs = fs.readdirSync(TMP_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(TMP_DIR, e.name));

    const dailyMap = new Map<string, { sessions: number; messages: number }>();
    let totalSessions = 0;

    for (const dir of projectDirs) {
      const logsPath = path.join(dir, "logs.json");
      try {
        const entries = JSON.parse(fs.readFileSync(logsPath, "utf-8")) as { timestamp?: string; type?: string }[];
        if (!entries.length) continue;
        totalSessions++;
        const date = toLocalDate(entries[0].timestamp ?? "");
        if (!date) continue;
        const cur = dailyMap.get(date) ?? { sessions: 0, messages: 0 };
        const msgCount = entries.filter((e) => e.type === "user").length;
        dailyMap.set(date, { sessions: cur.sessions + 1, messages: cur.messages + msgCount });
      } catch {}
    }

    const recentSessions = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { totalSessions, recentSessions };
  } catch {
    return null;
  }
}
