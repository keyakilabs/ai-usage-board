# ai-usage-board

Claude Code / Gemini CLI / OpenCode / Antigravity の使用状況をリアルタイム可視化するダッシュボード。`npx ai-usage-board` で起動するCLI npm パッケージ。

## 技術スタック

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS v4
- Recharts（グラフ描画）
- better-sqlite3（OpenCode の SQLite 読み込み）

## ディレクトリ構成

```
app/
  api/data/route.ts     # 全データ取得 API
  api/stream/route.ts   # SSE リアルタイム更新
  page.tsx              # メインダッシュボード
bin/
  ai-usage-board.js       # CLI エントリポイント（npx 用）
components/             # UI コンポーネント
lib/
  claude-code.ts        # ~/.claude/projects/**/*.jsonl 解析（JSONL全スキャン）
  gemini.ts             # ~/.gemini/usage_data.db 解析
  opencode.ts           # ~/.local/share/opencode/opencode.db 解析
  antigravity.ts        # ~/Library/Application Support/Antigravity/logs/ 解析
  types.ts              # 型定義
```

## 開発コマンド

```bash
# 開発サーバー起動（port 3456）
npm run dev

# ビルド
npm run build

# npm 公開（⚠️ 必ず中立なパスにクローンしてから行う）
#   Next.js の standalone 出力にはビルド時の絶対パスが埋め込まれ、
#   package.json の files に含まれるため npm 経由で公開されてしまう。
#   ホーム配下でビルドすると postbuild が警告を出す。
git clone https://github.com/keyakilabs/ai-usage-board.git /tmp/aub-build
cd /tmp/aub-build && npm ci
npm version patch && npm publish

# ヘルプ確認
node bin/ai-usage-board.js --help
```

## データソース

| ツール | ソース | データ内容 |
|--------|--------|-----------|
| Claude Code | `~/.claude/projects/**/*.jsonl` | モデル別トークン・コスト（JSONL全スキャン、5分キャッシュ） |
| Gemini CLI | `~/.gemini/usage_data.db` | モデル別・日次トークン・コスト |
| OpenCode | `~/.local/share/opencode/opencode.db` | セッション・トークン数・コスト |
| Antigravity | `~/Library/Application Support/Antigravity/logs/` | 起動セッション数 |

## コーディング規約

- 1機能1コミット
- コミットメッセージは日本語、プレフィックス付与（feat / fix / docs / refactor / chore）
- ブランチ戦略: GitHub Flow

## 設計上の約束（変更しないこと）

- **外部へデータを送信しない。** 読むのはローカルのログ・DBだけ。HTTPクライアントを足さない
- **サーバーは `127.0.0.1` にのみ bind する**（`bin/ai-usage-board.js` の `HOST`）
- **SQLite は readonly で開く**（各ツール本体との競合を避けるため）

この3点はREADMEでユーザーに約束している内容なので、崩す変更を入れない。

## 管理メモの置き場所

進捗・決定事項の管理メモは**このリポジトリには置かない**（実支出額を含むため）。
Keyaki Labs 内部の `keyaki/docs/10_開発総合/ai-usage-dashboard_管理メモ.md` が正。
