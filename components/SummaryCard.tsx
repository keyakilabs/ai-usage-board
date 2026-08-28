"use client";

interface SummaryCardProps {
  tool: string;
  color: string;
  metrics: { label: string; value: string }[];
  available: boolean;
}

export function SummaryCard({ tool, color, metrics, available }: SummaryCardProps) {
  return (
    <div className={`rounded-xl border ${color} bg-[var(--paper-raised)] p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg font-bold">{tool}</span>
        {!available && (
          <span className="text-xs text-[var(--muted)] ml-auto">データなし</span>
        )}
      </div>
      {available ? (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-xs text-[var(--muted)]">{m.label}</div>
              <div className="text-xl font-semibold mt-0.5">{m.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[var(--muted)] text-sm">ログファイルが見つかりません</div>
      )}
    </div>
  );
}
