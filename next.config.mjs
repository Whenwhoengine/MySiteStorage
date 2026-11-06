// 受保護設定檔：只有施工者可以改（AI_RULES.md「你不可以改」）。
// 依據：mysite docs/MySiteReact前端專案v1.md §6.1、§6.6、§6.9；定案執行書 §5 M-11、M-17。

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 減少指紋（v1 §6.1）
  poweredByHeader: false,
  // 正式映像用 standalone（v1 §4.6、§6.9）
  output: 'standalone',
  // 圖片最佳化關閉：內容圖一律一般 <img>，寬高由 API 提供（v1 §6.1）
  images: { unoptimized: true },
  // 正式產物不帶原始碼地圖（v1 §6.9）
  productionBrowserSourceMaps: false,
  // 假資料讀取器以 fs 讀 mocks/；不得被追蹤進 standalone（v1 §6.9、M-17、FE-09）
  outputFileTracingExcludes: {
    '*': ['mocks/**', 'public/mock-media/**', 'tests/**', 'contracts/**'],
  },
  webpack(config, { dev }) {
    // MyDyad 元件標記器只在開發模式掛上；正式建置不得出現 data-dyad-id（v1 §6.5 第 5 點、FE-09）
    if (dev) {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: '@dyad-sh/nextjs-webpack-component-tagger',
      });
    }
    return config;
  },
};

export default nextConfig;
