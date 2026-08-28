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
  npx ai-usage-board --help   Show this help

Options:
  --help, -h    Show help
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

const PORT = process.env.PORT || '3456';
const HOST = '127.0.0.1';

process.env.PORT = PORT;
process.env.HOSTNAME = HOST;

const url = `http://localhost:${PORT}`;

console.log(`\nAI Usage Board`);
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
