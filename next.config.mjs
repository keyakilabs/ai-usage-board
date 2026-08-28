/**
 * ⚠️ このファイルを .ts にしないこと。
 *
 * next.config.ts にすると Next.js が設定を読むために TypeScript を必要とし、
 * standalone 出力の node_modules に typescript が丸ごと（8.7MB）同梱される。
 * npx で配る以上、初回ダウンロードの重さが直接そのまま体験の悪さになるので
 * 設定ファイルは素の .mjs にしている。
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "standalone",

  // better-sqlite3 はネイティブアドオンなのでバンドルせず外部モジュールのまま扱う
  serverExternalPackages: ["better-sqlite3"],

  // next/image を使っていないので画像最適化を無効化する。
  // 有効なままだと sharp と libvips のバイナリ（合計16.6MB）が同梱される。
  images: { unoptimized: true },

  /*
   * standalone のファイルトレースは安全側に倒して広く拾うため、
   * このアプリが一切使わない機能の実装まで同梱される。
   * 使っていないことを確認したうえで明示的に除外する。
   *   - amphtml-validator : AMP を使っていない（4.1MB）
   *   - capsize / fontkit / font-data : next/font を使っていない（約5.3MB）
   *   - babel : SWC でビルドしており実行時に babel は要らない（4.2MB）
   *   - next-devtools : 開発用（0.8MB）
   *   - @img / sharp : 上の images.unoptimized と対で効かせる（16.6MB）
   */
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@img/**",
      "node_modules/sharp/**",
      "node_modules/typescript/**",
      "node_modules/next/dist/compiled/amphtml-validator/**",
      "node_modules/next/dist/compiled/babel/**",
      "node_modules/next/dist/compiled/babel-packages/**",
      "node_modules/next/dist/compiled/next-devtools/**",
      "node_modules/next/dist/compiled/@next/font/**",
      "node_modules/next/dist/server/capsize-font-metrics.json",
      "node_modules/caniuse-lite/**",
    ],
  },
};

export default nextConfig;
