import { NextResponse } from "next/server";
import { getClaudeCodeStats, getClaudeProfiles } from "@/lib/claude-code";
import { getOpenCodeStats } from "@/lib/opencode";
import { getAntigravityStats } from "@/lib/antigravity";
import { getGeminiStats } from "@/lib/gemini";
import {
  isDemoMode,
  getDemoClaudeCodeStats,
  getDemoClaudeProfiles,
  getDemoOpenCodeStats,
  getDemoAntigravityStats,
  getDemoGeminiStats,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  // --demo で起動したときは、手元のログを一切読まずダミーデータを返す
  if (isDemoMode()) {
    return NextResponse.json({
      demo: true,
      claudeCode: getDemoClaudeCodeStats(),
      claudeProfiles: getDemoClaudeProfiles(),
      openCode: getDemoOpenCodeStats(),
      antigravity: getDemoAntigravityStats(),
      gemini: getDemoGeminiStats(),
      lastUpdated: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    demo: false,
    claudeCode: getClaudeCodeStats(),
    claudeProfiles: getClaudeProfiles(),
    openCode: getOpenCodeStats(),
    antigravity: getAntigravityStats(),
    gemini: getGeminiStats(),
    lastUpdated: new Date().toISOString(),
  });
}
