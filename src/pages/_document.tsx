// 受保護（src/pages/**）：HTML 外殼。<html lang="zh-Hant-TW">（v1 §6.3；比照 layouts/app.blade.php）。
import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="zh-Hant-TW">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
