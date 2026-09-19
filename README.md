# AI Usage Board

**複数のAIコーディングツールの使用量を、手元で一枚にまとめる。**

Claude Code / Gemini CLI / OpenCode / Antigravity のローカルログを読み取り、
トークン量とコストをブラウザ上のダッシュボードに表示するCLIツールです。

```bash
npx ai-usage-board
```

インストール不要。実行すると `http://localhost:3456` が開きます。

手元にログが無くても、まず画面を見てみたい場合は:

```bash
npx ai-usage-board --demo
```

サンプルデータで描画します。**このモードではローカルのファイルを一切読みません。**

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

# サンプルデータで表示する（ローカルのファイルを読まない）
npx ai-usage-board --demo

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

### 単価の出どころ

単価は [公式の料金ページ](https://platform.claude.com/docs/en/about-claude/pricing) の値を
`lib/claude-code.ts` の `getModelPricing` に持っています（最終確認: 2026-09-19）。

- **単価は世代ごとに違う**ので、モデルIDから世代を判定して当てています（Opus 4.5 以降は $5/$25、4.1 以前は $15/$75、など）。
  世代が読めない表記（`"model":"opus"` など）は現行世代の単価で計算します
- プロンプトキャッシュへの書き込みは 5分（base × 1.25）と 1時間（base × 2）で単価が違うので、
  ログの内訳（`usage.cache_creation`）を見て分けて計算しています
- fast mode（`usage.speed: "fast"`）は2倍（公式の fast mode 料金がある Opus 5 / 4.8 のみ）、
  US 限定の推論（`usage.inference_geo: "us"`）は1.1倍（Claude 4.6 以降のみ）で計算します
- **トークン代だけ**を計算しています。Web 検索（1,000回あたり $10）やコード実行の時間課金など、
  トークン以外の料金は含みません（Claude Code のログでは、Web 検索を使っても
  `usage.server_tool_use.web_search_requests` が 0 のままで、正しい回数が取れないため）

⚠️ 料金は改定されます。**単価が古いと金額がそのままずれる**ので、気になるときは公式ページと
`getModelPricing` の分岐を見比べてください。ずれていたら Issue か PR をもらえると助かります。

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

⚠️ **`next.config.mjs` を `.ts` に戻さないでください。** `.ts` にすると Next.js が設定を読むために
TypeScript 本体（8.7MB）を standalone 出力に同梱してしまいます。`npx` で配る以上、
初回ダウンロードの重さがそのまま使い勝手に響きます。

## ライセンス

MIT

---

[Keyaki Labs](https://www.keyaki-labs.com/) が作っている無料ツールです。
「AIと作る生活の仕組み」をテーマに、AIを使う人の手元を整えるものを作っています。

- プロダクト紹介: <https://www.keyaki-labs.com/products/ai-usage-board>
- 不具合・要望: [Issues](https://github.com/keyakilabs/ai-usage-board/issues)
