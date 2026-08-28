import fs from "fs";
import path from "path";
import type { AntigravityStats } from "./types";

const LOGS_PATH = path.join(
  process.env.HOME || "",
  "Library",
  "Application Support",
  "Antigravity",
  "logs"
);

export function getAntigravityStats(): AntigravityStats | null {
  try {
    const entries = fs.readdirSync(LOGS_PATH);

    const sessionDates = entries
      .filter((e) => /^\d{8}T\d{6}$/.test(e))
      .sort();

    const dailyMap = new Map<string, number>();
    sessionDates.forEach((d) => {
      const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    });

    const recentSessions = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return {
      sessionDates,
      totalSessions: sessionDates.length,
      recentSessions,
    };
  } catch {
    return null;
  }
}
