/**
 * タイムスタンプを、画面を見ている人の**ローカル時刻**の日付（YYYY-MM-DD）にする。
 *
 * ログのタイムスタンプは UTC（末尾が Z）で書かれている。先頭10文字をそのまま日付に
 * すると UTC の日付になり、日本時間では 0〜9 時の分が前日に入ってしまう。
 * 画面側の「今日・今週・今月」はローカル時刻で決めているので、集計もそれに揃える。
 * 読めないタイムスタンプは空文字を返す。
 */
export function toLocalDate(ts: string | number | Date): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
