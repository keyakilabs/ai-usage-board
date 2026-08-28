#!/usr/bin/env node
'use strict';

const path = require('path');
const { exec } = require('child_process');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
AI Usage Board v${require('../package.json').version}

  Visualize your AI coding tool usage — Claude Code, Gemini CLI,
  OpenCode, and Antigravity — in a local web dashboard.

Usage:
  npx ai-usage-board          Start dashboard (opens browser)
  npx ai-usage-board --demo   Start with sample data (reads nothing)
  npx ai-usage-board --help   Show this help

Options:
  --help, -h    Show help
  --demo        Render the dashboard with built-in sample data.
                Useful to see what it looks like before pointing it
                at your own logs. No local file is read in this mode.
  PORT=<port>   Use a custom port (default: 3456)

Data sources (read-only, local files only — nothing is sent anywhere):
  Claude Code   ~/.claude/projects/**/*.jsonl
  Gemini CLI    ~/.gemini/usage_data.db
  OpenCode      ~/.local/share/opencode/opencode.db
  Antigravity   ~/Library/Application Support/Antigravity/logs/

Requirements:
  Node.js 18+

More info: https://www.keyaki-labs.com/products/ai-usage-board
`);
  process.exit(0);
}

if (args.includes('--demo')) {
  // サーバー側（app/api/data）が環境変数を見てダミーデータに切り替える
  process.env.AI_USAGE_BOARD_DEMO = '1';
}

const PORT = process.env.PORT || '3456';
const HOST = '127.0.0.1';

process.env.PORT = PORT;
process.env.HOSTNAME = HOST;

const url = `http://localhost:${PORT}`;

console.log(`\nAI Usage Board${process.env.AI_USAGE_BOARD_DEMO === '1' ? ' (demo data)' : ''}`);
console.log(`Starting server at ${url} ...\n`);

setTimeout(() => {
  const openCmd =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32'  ? `start "" "${url}"` :
    `xdg-open "${url}"`;
  exec(openCmd);
}, 2000);

const serverPath = path.join(__dirname, '..', '.next', 'standalone', 'server.js');
require(serverPath);
