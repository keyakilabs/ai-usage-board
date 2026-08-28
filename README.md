# AI Usage Board

**複数のAIコーディングツールの使用量を、手元で一枚にまとめる。**

Claude Code / Gemini CLI / OpenCode / Antigravity のローカルログを読み取り、
トークン量とコストをブラウザ上のダッシュボードに表示するCLIツールです。

```bash
npx ai-usage-board
```

インストール不要。実行すると `http://localhost:3456` が開きます。

---

## なぜ作ったか

AIコーディングツールを複数使い分け始めると、管理画面がツールごとにばらけて
「自分が何をどれくらい使っているのか」が誰にも分からなくなります。

各社のダッシュボードを順番に開いて頭の中で合算する、という作業を毎月やっていたので、
手元のログを読んで一枚にまとめるツールを自分用に作りました。そのまま無料で公開しています。

## データは外に出ません

このツールが読むのは**あなたのマシン上のログ・DBファイルだけ**です。

- サーバーは `127.0.0.1:3456` にのみ bind します（同じネットワークの他の端末からは見えません）
- 外部へのHTTPリクエストを行うコードはありません。ブラウザ側の通信も、同じプロセスの `/api/data` を叩く1本だけです
- アカウント登録も、APIキーの入力も、設定ファイルもありません

| ツール | 読み取り元 |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| Gemini CLI | `~/.gemini/usage_data.db` |
| OpenCode | `~/.local/share/opencode/opencode.db` |
| Antigravity | `~/Library/Application Support/Antigravity/logs/` |

いずれも**読み取り専用**で開きます（OpenCode の SQLite は本体との競合を避けるため `readonly: true` で開いています）。
気になる場合はソースを読んで確かめてください。

`~/.claude` に加えて `~/.claude-*` の形の追加プロファイルも自動で見つけ、プロファイル別に切り替えて見られます。

## 使い方

```bash
# 起動（ブラウザが自動で開く）
npx ai-usage-board

# ポートを変える
PORT=4000 npx ai-usage-board

# ヘルプ
npx ai-usage-board --help
```

期間（今日 / 今週 / 今月 / 全期間）とツールを切り替えて、日別コスト・モデル別コスト・
トークン推移・時間帯別の活動量を見られます。

## コストの数字について

⚠️ **表示されるコストは、トークン使用量にAPI単価を掛けた推定値です。**

Claude Max や Gemini Advanced のような**サブスクリプション料金は含まれません**。
「サブスクの範囲内でどれくらいAPI換算の価値を使っているか」の目安として見てください。

Gemini CLI と Antigravity はログにトークン情報が含まれないため、コストは「計測外」と表示されます
（Antigravity は起動回数のみ）。

### 「全期間」は各ツールのログが残っている範囲

このツールは手元のログを読んでいるだけなので、**ツール側が古いログを消すと、その分は集計から消えます**。
「全期間」の数字が前より減ることがあるのはこのためで、不具合ではありません。
長期の記録を残したい場合は、ログのバックアップを別途取ってください。

## 動作環境

- Node.js 18 以上
- macOS / Linux / Windows（Antigravity のログパスは macOS のもののみ対応）

## 開発

```bash
npm install
npm run dev     # 開発サーバー（port 3456）
npm run build   # 本番ビルド
```

Next.js 15 (App Router) / TypeScript / Tailwind CSS v4 / Recharts / better-sqlite3。

## ライセンス

MIT

---

[Keyaki Labs](https://www.keyaki-labs.com/) が作っている無料ツールです。
「AIと作る生活の仕組み」をテーマに、AIを使う人の手元を整えるものを作っています。

- プロダクト紹介: <https://www.keyaki-labs.com/products/ai-usage-board>
- 不具合・要望: [Issues](https://github.com/keyakilabs/ai-usage-board/issues)
