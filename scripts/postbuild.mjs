import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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

console.log('postbuild done');
