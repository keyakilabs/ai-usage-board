import { getClaudeCodeStats, getClaudeProfiles } from "@/lib/claude-code";
import { getOpenCodeStats } from "@/lib/opencode";
import { getAntigravityStats } from "@/lib/antigravity";
import { getGeminiStats } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const collect = () => ({
        claudeCode: getClaudeCodeStats(),
        claudeProfiles: getClaudeProfiles(),
        openCode: getOpenCodeStats(),
        antigravity: getAntigravityStats(),
        gemini: getGeminiStats(),
        lastUpdated: new Date().toISOString(),
      });

      send(collect());

      const interval = setInterval(() => {
        try { send(collect()); } catch { clearInterval(interval); controller.close(); }
      }, 30000);

      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
