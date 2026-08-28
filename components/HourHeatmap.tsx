"use client";

interface HourHeatmapProps {
  hourCounts: Record<string, number>;
}

export function HourHeatmap({ hourCounts }: HourHeatmapProps) {
  const max = Math.max(...Object.values(hourCounts), 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5">
      <h3 className="font-semibold mb-4 text-[var(--ink)]">時間帯別使用パターン（Claude Code）</h3>
      <div className="flex gap-1 flex-wrap">
        {hours.map((h) => {
          const count = hourCounts[String(h)] || 0;
          const intensity = count / max;
          const bg =
            intensity === 0
              ? "bg-[var(--line)]"
              : intensity < 0.25
              ? "bg-[#EBC9B4]"
              : intensity < 0.5
              ? "bg-[#D89A78]"
              : intensity < 0.75
              ? "bg-[#BE6A46]"
              : "bg-[var(--accent)]";
          return (
            <div key={h} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded ${bg} flex items-center justify-center`}
                title={`${h}時: ${count}セッション`}
              />
              <span className="text-xs text-[var(--muted)]">{h}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-[var(--muted)]">
        <span>少</span>
        <div className="flex gap-0.5">
          {["bg-[var(--line)]", "bg-[#EBC9B4]", "bg-[#D89A78]", "bg-[#BE6A46]", "bg-[var(--accent)]"].map((c, i) => (
            <div key={i} className={`w-4 h-3 rounded-sm ${c}`} />
          ))}
        </div>
        <span>多</span>
      </div>
    </div>
  );
}
