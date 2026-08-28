/**
 * 画面に出す数値の整形をここに集約する。
 *
 * 以前は page.tsx / TokenChart / CostChart / ModelCostBar / ModelBreakdown に
 * 同じような整形関数が個別に置かれていて、3桁区切りの有無や丸め方が揃っていなかった。
 *
 * ロケールは "en-US" を明示する。実行環境のロケールに任せると、
 * 区切り文字が環境によって変わってしまうため。
 */

const GROUPED = "en-US";

/** 件数・回数など「1件ずつ数えられるもの」。必ず3桁区切りの整数で出す。 */
export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString(GROUPED);
}

/**
 * 金額。3桁区切りを入れたうえで、桁の大きさに応じて小数の細かさを変える。
 *   1234.5   -> $1,235
 *   12.345   -> $12.35
 *   0.01234  -> $0.0123
 */
export function fmtCost(n: number): string {
  if (!Number.isFinite(n)) return "-";
  // ちょうど0のときに "$0.0000" と出すと、グラフの軸で他の目盛り（$6,000 等）と不揃いになる
  if (n === 0) return "$0";
  const digits = n >= 100 ? 0 : n >= 1 ? 2 : 4;
  return `$${n.toLocaleString(GROUPED, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/**
 * トークン数のように桁が大きすぎて生の数字だと読めないもの。
 * K / M / B で丸める。丸めた後の数値にも3桁区切りを入れる。
 *
 * ⚠️ B（10億）の段を持たせている。以前は M 止まりだったため、
 * 361億トークンが "36129.3M" という読めない表示になっていた。
 */
export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  const scale =
    abs >= 1_000_000_000 ? { div: 1_000_000_000, suffix: "B" }
    : abs >= 1_000_000 ? { div: 1_000_000, suffix: "M" }
    : abs >= 10_000 ? { div: 1_000, suffix: "K" }
    : null;

  // 1万未満は丸めずそのまま出す（3桁区切りだけで十分読める）
  if (!scale) return fmtInt(n);

  const v = n / scale.div;
  return `${v.toLocaleString(GROUPED, { maximumFractionDigits: 1 })}${scale.suffix}`;
}
