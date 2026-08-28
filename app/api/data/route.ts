import { NextResponse } from "next/server";
import { getClaudeCodeStats, getClaudeProfiles } from "@/lib/claude-code";
import { getOpenCodeStats } from "@/lib/opencode";
import { getAntigravityStats } from "@/lib/antigravity";
import { getGeminiStats } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    claudeCode: getClaudeCodeStats(),
    claudeProfiles: getClaudeProfiles(),
    openCode: getOpenCodeStats(),
    antigravity: getAntigravityStats(),
    gemini: getGeminiStats(),
    lastUpdated: new Date().toISOString(),
  });
}
