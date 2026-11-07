// FE-03 語法樹檢查（tests/ci/safe-html-checks.mjs）的正反案例。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RAW_HTML_FRAGMENTS, SAFE_HTML_FILE, checkSafeHtmlSource, isSafeHtmlModule } from '../ci/safe-html-checks.mjs';

const VIEW = 'src/views/ZzView.tsx';
const IMPORT = "import { SafeHtml } from '@/components/safe/SafeHtml';";
const DECL = 'declare const el: HTMLElement; declare const x: string; declare const item: { contentHtml: string };';
const check = (code: string, file = VIEW) => checkSafeHtmlSource(file, `${DECL}\n${code}\n`);
const SAFE_HTML_SOURCE = readFileSync(new URL('../../src/components/safe/SafeHtml.tsx', import.meta.url), 'utf8');

describe('通過的寫法', () => {
  it.each([
    ['正常呼叫', `${IMPORT}\nexport const a = <SafeHtml html={item.contentHtml} />;`],
    ['多層物件與 className', `${IMPORT}\ndeclare const p: { item: { contentHtml: string } };\nexport const a = <SafeHtml html={p.item.contentHtml} className="x" />;`],
    ['成對標籤', `${IMPORT}\nexport const a = <SafeHtml html={item.contentHtml}></SafeHtml>;`],
    ['註解裡提到禁用名稱', '// innerHTML、dangerouslySetInnerHTML、document.write、SafeHtml\n/* srcDoc __html */\nexport const a = 1;'],
    ['一般的 write 與 HTML 字樣', 'declare const s: { write(v: string): void };\ns.write("a");\nexport const html = "<b>";\nexport const htmlFor = "id";'],
    ['讀取 contentHtml', 'export const len = item.contentHtml.length;\nexport const { contentHtml } = item;'],
  ])('%s', (_label, code) => {
    expect(check(code)).toEqual([]);
  });

  it('src/server/** 可以產生 contentHtml', () => {
    expect(check("export const m = (r: { content_html: string }) => ({ contentHtml: r.content_html });", 'src/server/mappers.ts')).toEqual([]);
  });

  it('SafeHtml.tsx 現況通過（唯一的 dangerouslySetInnerHTML 與 __html）', () => {
    expect(checkSafeHtmlSource(SAFE_HTML_FILE, SAFE_HTML_SOURCE)).toEqual([]);
  });
});

describe('原始 HTML 輸出點', () => {
  it.each([
    ['innerHTML 指定', 'el.innerHTML = x;', 'innerHTML'],
    ['outerHTML +=', 'el.outerHTML += x;', 'outerHTML'],
    ['計算屬性字串', "el['innerHTML'] = x;", 'innerHTML'],
    ['樣板字串', 'el[`outerHTML`] = x;', 'outerHTML'],
    ['跳脫寫法', "el['\\u0069nnerHTML'] = x;", 'innerHTML'],
    ['跳脫識別字', 'el.\\u0069nnerHTML = x;', 'innerHTML'],
    ['Object.assign', 'Object.assign(el, { innerHTML: x });', 'innerHTML'],
    ['Reflect.set', "Reflect.set(el, 'innerHTML', x);", 'innerHTML'],
    ['insertAdjacentHTML', "el.insertAdjacentHTML('beforeend', x);", 'insertAdjacentHTML'],
    ['document.writeln', 'document.writeln(x);', 'writeln'],
    ['createContextualFragment', 'document.createRange().createContextualFragment(x);', 'createContextualFragment'],
    ['DOMParser', 'export const d = new DOMParser();', 'DOMParser'],
    ['parseFromString', "declare const p: { parseFromString(a: string, b: string): unknown };\np.parseFromString(x, 'text/html');", 'parseFromString'],
    ['setHTMLUnsafe', 'el.setHTMLUnsafe(x);', 'setHTMLUnsafe'],
    ['Document.parseHTMLUnsafe', 'Document.parseHTMLUnsafe(x);', 'parseHTMLUnsafe'],
    ["execCommand('insertHTML')", "document.execCommand('insertHTML', false, x);", 'insertHTML'],
    ['JSX srcDoc', 'export const a = <iframe srcDoc={x} />;', 'srcDoc'],
    ['JSX srcdoc（小寫）', 'export const a = <iframe srcdoc={x} />;', 'srcdoc'],
    ['JSX dangerouslySetInnerHTML', 'export const a = <div dangerouslySetInnerHTML={{ __html: x }} />;', 'dangerouslySetInnerHTML'],
    ['物件鍵 dangerouslySetInnerHTML', 'export const p = { dangerouslySetInnerHTML: { __html: x } };', 'dangerouslySetInnerHTML'],
    ['計算鍵 dangerouslySetInnerHTML', "export const p = { ['dangerouslySetInnerHTML']: 1 };", 'dangerouslySetInnerHTML'],
    ['字串 dangerouslySetInnerHTML', "export const k = 'dangerouslySetInnerHTML';", 'dangerouslySetInnerHTML'],
    ['拆字 dangerously', "export const k = 'dangerously' + 'SetInnerHTML';", 'dangerously'],
    ['__html', 'export const h = { __html: x };', '__html'],
    ['字串裡的 /* 不能把後面當成註解', "const a = '/*'; el.innerHTML = x; const b = '*/';\nexport { a, b };", 'innerHTML'],
    ['字串裡的 // 不能把後面當成註解', "const a = ' //'; el.innerHTML = x;\nexport { a };", 'innerHTML'],
  ])('%s', (_label, code, token) => {
    const problems = check(code);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toContain(`「${token}」`);
  });

  it.each([
    ['document.write', 'document.write(x);'],
    ["document['write']", "document['write'](x);"],
    ['window.document.write', 'window.document.write(x);'],
    ['ownerDocument.write', 'el.ownerDocument.write(x);'],
    ['contentDocument!.write', 'declare const f: HTMLIFrameElement;\nf.contentDocument!.write(x);'],
    ['(… as Document).write', 'declare const f: HTMLIFrameElement;\n(f.contentDocument as Document).write(x);'],
    ['Document.prototype.write', 'Document.prototype.write.call(document, x);'],
    ['解構 const { write } = document', 'const { write } = document;\nexport { write };'],
    ['解構指定 ({ write: w } = doc)', 'declare const doc: Document;\nlet w;\n({ write: w } = doc);\nexport { w };'],
  ])('%s', (_label, code) => {
    expect(check(code).join('\n')).toMatch(/write/);
  });

  it('其他 .mts／.jsx 檔一樣檢查', () => {
    expect(checkSafeHtmlSource('src/components/a.mts', 'export const f = (el: HTMLElement) => { el.innerHTML = "x"; };')).toHaveLength(1);
    expect(checkSafeHtmlSource('src/components/a.jsx', 'export const g = (x) => <iframe srcDoc={x} />;')).toHaveLength(1);
  });

  it('SafeHtml.tsx 也不得多出其他輸出點', () => {
    const problems = checkSafeHtmlSource(SAFE_HTML_FILE, `${SAFE_HTML_SOURCE}\nexport const z = (el: HTMLElement) => { el.innerHTML = 'x'; };\n`);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('innerHTML');
  });

  it('SafeHtml.tsx 不得有第二個 dangerouslySetInnerHTML', () => {
    const extra = `${SAFE_HTML_SOURCE}\nexport const z = (h: string) => <div dangerouslySetInnerHTML={{ __html: h }} />;\n`;
    expect(checkSafeHtmlSource(SAFE_HTML_FILE, extra).join('\n')).toMatch(/超出唯一輸出點的允許次數/);
  });

  it('語法錯誤時不放行', () => {
    expect(check('export const a = (;').join('\n')).toMatch(/語法錯誤/);
  });
});

describe('SafeHtml 的用法', () => {
  it.each([
    ['改名匯入', "import { SafeHtml as Html } from '@/components/safe/SafeHtml';\nexport const a = <Html html={item.contentHtml} />;", '只能原名匯入'],
    ['預設匯入', "import Html from '@/components/safe/SafeHtml';\nexport { Html };", '不得以預設匯入'],
    ['命名空間匯入', "import * as NS from '@/components/safe/SafeHtml';\nexport const a = <NS.SafeHtml html={item.contentHtml} />;", '命名空間'],
    ['相對路徑與大小寫不同也算同一模組', "import { SafeHtml as H } from '../components/safe/safehtml.tsx';\nexport { H };", '只能原名匯入'],
    ['其他模組匯入成 SafeHtml', `import { Evil as SafeHtml } from './evil';\nexport const a = <SafeHtml html={item.contentHtml} />;`, '只能指'],
    ['轉匯出', "export { SafeHtml } from '@/components/safe/SafeHtml';", '不得轉匯出'],
    ['全部轉匯出', "export * from '@/components/safe/SafeHtml';", '不得轉匯出'],
    ['動態匯入', "export const m = import('@/components/safe/SafeHtml');", '只能出現在靜態 import'],
    ['樣板字串動態匯入', 'export const m = import(`@/components/safe/SafeHtml`);', '只能出現在靜態 import'],
    ['指給別的名稱', `${IMPORT}\nconst Html = SafeHtml;\nexport const a = <Html html={item.contentHtml} />;`, '只能寫成 JSX 標籤'],
    ['本地轉匯出', `${IMPORT}\nexport { SafeHtml };`, '只能寫成 JSX 標籤'],
    ['當成值傳遞', `${IMPORT}\nimport { createElement } from 'react';\nexport const a = createElement(SafeHtml, { html: item.contentHtml });`, '只能寫成 JSX 標籤'],
    ['另行宣告同名元件', 'function SafeHtml(p: { html: string }) { return <div>{p.html}</div>; }\nexport const a = <SafeHtml html={item.contentHtml} />;', '只能寫成 JSX 標籤'],
    ['沒有匯入就用 <SafeHtml>', 'export const a = <SafeHtml html={item.contentHtml} />;', '卻沒有'],
    ['展開屬性蓋掉 html', `${IMPORT}\nexport const a = <SafeHtml html={item.contentHtml} {...{ html: x }} />;`, '不得使用 {...展開}'],
    ['html 接其他值', `${IMPORT}\nexport const a = <SafeHtml html={x} />;`, '只能接 API 欄位 contentHtml'],
    ['html 接字串', `${IMPORT}\nexport const a = <SafeHtml html="<b>x</b>" />;`, '只能接 API 欄位 contentHtml'],
    ['html 用 ?.', `${IMPORT}\nexport const a = <SafeHtml html={item?.contentHtml} />;`, '只能接 API 欄位 contentHtml'],
    ['html 用 []', `${IMPORT}\nexport const a = <SafeHtml html={item['contentHtml']} />;`, '只能接 API 欄位 contentHtml'],
    ['html 用函式呼叫的結果', `${IMPORT}\ndeclare const get: () => { contentHtml: string };\nexport const a = <SafeHtml html={get().contentHtml} />;`, '只能接 API 欄位 contentHtml'],
    ['沒有 html', `${IMPORT}\nexport const a = <SafeHtml />;`, '恰好有一個 html 屬性'],
  ])('%s', (_label, code, expected) => {
    expect(check(code).join('\n')).toContain(expected);
  });
});

describe('contentHtml 只由 src/server/** 產生', () => {
  it.each([
    ['物件鍵', "const fake = { contentHtml: '<img src=x onerror=alert(1)>' };\nexport { fake };"],
    ['簡寫物件鍵', 'const contentHtml = x;\nexport const fake = { contentHtml };'],
    ['展開後覆寫', 'export const fake = { ...item, contentHtml: x };'],
    ['計算鍵', "export const fake = { ['contentHtml']: x };"],
    ['指定', 'item.contentHtml = x;'],
    ['字串', "Object.defineProperty(item, 'contentHtml', { value: x });"],
    ['類別欄位', 'export class Fake { contentHtml = x; }'],
  ])('%s', (_label, code) => {
    expect(check(code).join('\n')).toMatch(/contentHtml/);
  });

  it('src/lib 的型別宣告不受影響', () => {
    expect(checkSafeHtmlSource('src/lib/content/types.ts', 'export interface EntryItem { contentHtml: string }\nexport type T = { contentHtml: string };')).toEqual([]);
  });
});

describe('輔助判定', () => {
  it.each([
    ['@/components/safe/SafeHtml', true],
    ['../components/safe/SafeHtml.tsx', true],
    ['./SAFEHTML', true],
    ['src/components/safe/SafeHtml.js', true],
    ['@/components/safe/SafeHtmlWrapper', false],
    ['@/components/safe/SiteLink', false],
  ])('isSafeHtmlModule(%s) = %s', (specifier, expected) => {
    expect(isSafeHtmlModule(specifier)).toBe(expected);
  });

  it('與 eslint.config.mjs 的 RAW_HTML_FRAGMENTS 一致', () => {
    const config = readFileSync(new URL('../../eslint.config.mjs', import.meta.url), 'utf8');
    expect(RAW_HTML_FRAGMENTS.flags).toBe('i');
    expect(config).toContain(`'${RAW_HTML_FRAGMENTS.source}'`);
  });
});
