export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

export interface DailyCost {
  date: string;
  costUSD: number;
  byModel: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  hourCounts: Record<number, number>;
}

export interface ClaudeCodeStats {
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, ModelUsage>;
  hourCounts: Record<string, number>;
  totalSessions: number;
  totalMessages: number;
  lastComputedDate: string;
  /** JSONL に記録が残っている最後の日付（YYYY-MM-DD）。データが1件も無ければ空文字。 */
  lastActivityDate: string;
  dailyCosts: DailyCost[];
  totalCostUSD: number;
}

export interface OpenCodeSession {
  id: string;
  title: string;
  model: string;
  providerID: string;
  timeCreated: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
}

export interface OpenCodeDailyTokens {
  date: string;
  input: number;
  output: number;
  cost: number;
}

export interface OpenCodeStats {
  sessions: OpenCodeSession[];
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  dailyTokens: OpenCodeDailyTokens[];
  modelBreakdown: Record<string, { sessions: number; tokens: number }>;
}

export interface AntigravityStats {
  sessionDates: string[];
  totalSessions: number;
  recentSessions: { date: string; count: number }[];
}

export interface GeminiStats {
  totalSessions: number;
  recentSessions: { date: string; sessions: number; messages: number }[];
}

export interface ClaudeProfile {
  name: string;
  dailyCosts: DailyCost[];
  totalCostUSD: number;
  totalSessions: number;
  totalMessages: number;
  lastComputedDate: string;
  /** JSONL に記録が残っている最後の日付（YYYY-MM-DD）。データが1件も無ければ空文字。 */
  lastActivityDate: string;
  modelUsage: Record<string, ModelUsage>;
}

export interface DashboardData {
  /** --demo で起動したダミーデータかどうか。画面にバッジを出すために使う。 */
  demo?: boolean;
  claudeCode: ClaudeCodeStats | null;
  claudeProfiles: ClaudeProfile[];
  openCode: OpenCodeStats | null;
  antigravity: AntigravityStats | null;
  gemini: GeminiStats | null;
  lastUpdated: string;
}
