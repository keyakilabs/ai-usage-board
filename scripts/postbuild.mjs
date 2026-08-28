import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const root = process.cwd();

const staticSrc = join(root, '.next', 'static');
const staticDst = join(root, '.next', 'standalone', '.next', 'static');
if (existsSync(staticSrc)) {
  mkdirSync(staticDst, { recursive: true });
  cpSync(staticSrc, staticDst, { recursive: true });
  console.log('Copied .next/static');
}

const publicSrc = join(root, 'public');
const publicDst = join(root, '.next', 'standalone', 'public');
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDst, { recursive: true });
  console.log('Copied public');
}

/*
 * 公開パッケージにビルドしたマシンの絶対パスを載せない。
 *
 * Next.js の standalone 出力は outputFileTracingRoot / root にビルド時の絶対パスを
 * そのまま書き込む（server.js・required-server-files.json など11ファイル）。
 * これらは package.json の files に含まれるため、そのまま publish すると
 * ビルドした人のホームディレクトリ構成が npm 経由で読めてしまう。
 *
 * 中立なパス（例: /tmp 配下）にクローンしてからビルドすれば埋め込まれない。
 * ここでは検知して落とすだけにする（自動で書き換えると実行時のパス解決を壊すため）。
 */
const home = homedir();
const standalone = join(root, '.next', 'standalone');
if (existsSync(standalone) && root.startsWith(home)) {
  console.error('');
  console.error('🔴 ホームディレクトリ配下でビルドされています:', root);
  console.error('   このまま npm publish すると、standalone 出力に上記の絶対パスが埋め込まれたまま公開されます。');
  console.error('   公開用ビルドは中立なパスで行ってください:');
  console.error('     git clone <repo> /tmp/aub-build && cd /tmp/aub-build && npm ci && npm publish');
  console.error('   （ローカル開発ではこの警告を無視して構いません）');
  console.error('');
}

console.log('postbuild done');
