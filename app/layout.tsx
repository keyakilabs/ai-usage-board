import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Usage Board — Keyaki Labs",
  description:
    "Claude Code / Gemini CLI / OpenCode / Antigravity のローカルログを読み取り、使用量とコストを1画面にまとめます。データは外部に送信しません。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-[var(--paper)] text-[var(--ink)] min-h-screen">{children}</body>
    </html>
  );
}
