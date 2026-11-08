// 受保護路徑守門的判定（定案執行書 §4.2、§5.2；FE-11 能以純函式表達的案例 ①～⑦、⑩；CLAUDE.md「受保護路徑宣告區塊」）。
// ⑧⑨⑪ 屬工作流程與 GitHub 設定層，見 tests/ci/protected-paths.mjs 檔頭。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  DECLARATION_BEGIN,
  DECLARATION_END,
  classifyPath,
  evaluate,
  explainPath,
  parseDeclaration,
  type EvaluateInput,
  type PrFile,
} from '../ci/protected-paths.mjs';

const SCRIPT = fileURLToPath(new URL('../ci/protected-paths.mjs', import.meta.url));
const DESIGN = 'design/work';
const BUILDER = 'claude/happy-euler-evh676';
const BASE = '"$(git merge-base origin/main HEAD)"';
const co = (p: string) => `git --literal-pathspecs checkout ${BASE} -- '${p}'`;
const rm = (p: string) => `git --literal-pathspecs rm -- '${p}'`;

const M = (filename: string): PrFile => ({ filename, status: 'modified' });
const A = (filename: string): PrFile => ({ filename, status: 'added' });
const D = (filename: string): PrFile => ({ filename, status: 'removed' });
const R = (previous: string, filename: string): PrFile => ({ filename, status: 'renamed', previous_filename: previous });
const decl = (...paths: string[]) => ['PR 說明', DECLARATION_BEGIN, ...paths.map((p) => `- ${p}`), DECLARATION_END, ''].join('\n');
const run = (overrides: Partial<EvaluateInput>) =>
  evaluate({ isFork: false, headRef: BUILDER, files: [], body: '', listComplete: true, ...overrides });
/** 去掉程式碼區塊後的留言文字（來自 PR 的字串不得出現在這裡）。 */
const outsideCode = (message: string) => message.replace(/^(`{3,})text\n[\s\S]*?\n\1$/gm, '');

const tempDirs: string[] = [];
const makeTemp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'protected-paths-'));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('classifyPath：開放區', () => {
  it.each([
    'src/views/HomeView.tsx',
    'src/views/article/ArticleView.tsx',
    'src/components/SiteHeader.tsx',
    'src/components/safe-styles.ts',
    'src/components/safety/Badge.tsx',
    'src/components/ui.ts',
    'src/styles/globals.css',
    'public/design/hero.webp',
    'public/design/首頁背景.png',
  ])('%s 是開放區', (p) => {
    expect(classifyPath(p)).toBe('open');
  });
});

describe('classifyPath：受保護區（AI_RULES「你不可以改」與其他所有路徑）', () => {
  it.each([
    'src/pages/index.tsx',
    'src/pages/[...path].tsx',
    'src/server/api-client.ts',
    'src/lib/content/types.ts',
    'src/components/safe/SafeHtml.tsx',
    'src/components/safe/SiteLink.tsx',
    'src/components/safe/nested/Deep.tsx',
    'src/instrumentation.ts',
    'contracts/SOURCE.json',
    'mocks/manifest.json',
    'tests/ci/protected-paths.mjs',
    'public/fonts/a.woff2',
    'public/mock-media/a.webp',
    'public/robots.txt',
    '.github/workflows/ci.yml',
    'package.json',
    'package-lock.json',
    '.npmrc',
    'next.config.mjs',
    'postcss.config.mjs',
    'tsconfig.json',
    'eslint.config.mjs',
    '.gitignore',
    '.gitattributes',
    '.nvmrc',
    'AI_RULES.md',
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'brand-new-root-file.txt',
    'src/new-dir/x.ts',
  ])('%s 是受保護區', (p) => {
    expect(classifyPath(p)).toBe('protected');
  });

  it('src/components/safe 本身（沒有副檔名的檔案）也受保護', () => {
    expect(classifyPath('src/components/safe')).toBe('protected');
  });
});

describe('classifyPath：大小寫與怪路徑一律當受保護', () => {
  it.each([
    ['src/components/Safe/SafeHtml.tsx', 'Windows 不分大小寫，會與 safe/ 撞在一起'],
    ['src/components/SAFE/SafeHtml.tsx', '全大寫'],
    ['src/components/ｓａｆｅ/SafeHtml.tsx', '全形字母'],
    ['src/components/ſafe/SafeHtml.tsx', '長 s（NFKC 後是 s）'],
    ['SRC/views/HomeView.tsx', '開放區前綴大小寫不同'],
    ['src/Views/HomeView.tsx', '開放區前綴大小寫不同'],
    ['Public/design/a.png', '開放區前綴大小寫不同'],
    ['src/views/../pages/index.tsx', '.. 路徑段'],
    ['src/views/./HomeView.tsx', '. 路徑段'],
    ['./src/views/HomeView.tsx', '以 ./ 開頭'],
    ['/src/views/HomeView.tsx', '前導斜線'],
    ['src/views/', '以斜線結尾'],
    ['src/views//HomeView.tsx', '連續斜線'],
    ['src\\views\\HomeView.tsx', '反斜線'],
    ['src/views\\..\\pages\\index.tsx', '反斜線藏 ..'],
    ['src/components/safe./SafeHtml.tsx', '路徑段以句點結尾（Windows 會變成 safe）'],
    ['src/components/safe /SafeHtml.tsx', '路徑段以空白結尾（Windows 會變成 safe）'],
    ['src/views/a.tsx:stream', 'NTFS 替代資料流'],
    ['src/views/a\u0000.tsx', 'NUL'],
    ['src/views/a\n.tsx', '換行'],
    [`src/views/${String.fromCodePoint(0x202e)}gnp.tsx`, '雙向文字控制字元'],
    [`src/components/sa${String.fromCodePoint(0x200b)}fe/x.tsx`, '零寬空白'],
    ['src/views/con.tsx', 'Windows 保留裝置名稱'],
    ['', '空字串'],
  ])('%j 受保護（%s）', (p) => {
    expect(classifyPath(p)).toBe('protected');
  });

  it.each([
    'src/views/eslint.config.mjs',
    'src/views/.eslintrc.json',
    'src/components/.gitattributes',
    'src/styles/.gitignore',
    'src/views/package.json',
    'src/views/tsconfig.json',
    'src/views/AGENTS.md',
    'src/views/claude.md',
    'src/components/.claude/settings.json',
    'public/design/postcss.config.mjs',
    'src/styles/tailwind.config.ts',
  ])('%s：工具設定或 AI 規則檔放在開放區內也受保護', (p) => {
    expect(explainPath(p)).toEqual({ kind: 'protected', reason: '工具設定或 AI 規則檔（放在開放區內也受保護）' });
  });

  it('怪路徑的原因會寫明', () => {
    expect(explainPath('/src/views/a.tsx').reason).toContain('怪路徑');
    expect(explainPath('src/components/Safe/a.tsx').reason).toContain('src/components/safe');
    expect(explainPath('src/pages/index.tsx')).toEqual({ kind: 'protected', reason: null });
    expect(explainPath('src/views/a.tsx')).toEqual({ kind: 'open', reason: null });
  });
});

describe('parseDeclaration', () => {
  it.each([null, undefined, '', '只是普通的 PR 說明\n沒有宣告'])('沒有宣告標記時回傳 null（%j）', (body) => {
    expect(parseDeclaration(body)).toBeNull();
  });

  it('解析 CLAUDE.md 的範例格式', () => {
    expect(parseDeclaration(decl('package.json', 'src/server/api-client.ts'))).toEqual({
      valid: true,
      paths: ['package.json', 'src/server/api-client.ts'],
      errors: [],
    });
  });

  it('接受 CRLF、標記行前後空白、行尾空白與空白行', () => {
    const body = `說明\r\n  ${DECLARATION_BEGIN}  \r\n- package.json   \r\n\r\n- src/pages/[...path].tsx\r\n${DECLARATION_END}\r\n`;
    expect(parseDeclaration(body)).toEqual({ valid: true, paths: ['package.json', 'src/pages/[...path].tsx'], errors: [] });
  });

  it('空的區塊是有效的空清單', () => {
    expect(parseDeclaration(decl())).toEqual({ valid: true, paths: [], errors: [] });
  });

  it('區塊放在 ```text 圍欄裡也能解析', () => {
    expect(parseDeclaration(['```text', DECLARATION_BEGIN, '- package.json', DECLARATION_END, '```'].join('\n'))?.paths).toEqual([
      'package.json',
    ]);
  });

  it.each([
    ['只有開始標記', `${DECLARATION_BEGIN}\n- package.json`],
    ['只有結束標記', `- package.json\n${DECLARATION_END}`],
    ['兩個區塊', `${decl('a')}\n${decl('b')}`],
    ['結束在開始之前', `${DECLARATION_END}\n- package.json\n${DECLARATION_BEGIN}`],
    ['標記少了空白', `<!--protected-change:begin-->\n- package.json\n${DECLARATION_END}`],
    ['標記與其他文字同一行', `請看 ${DECLARATION_BEGIN}\n- package.json\n${DECLARATION_END}`],
    ['標記大小寫不同', `<!-- PROTECTED-CHANGE:BEGIN -->\n- package.json\n<!-- PROTECTED-CHANGE:END -->`],
    ['只有寫錯的標記', '<!-- protected-change: begin -->'],
    ['用 * 當項目符號', decl().replace(DECLARATION_END, `* package.json\n${DECLARATION_END}`)],
    ['沒有項目符號', decl().replace(DECLARATION_END, `package.json\n${DECLARATION_END}`)],
    ['縮排的項目', decl().replace(DECLARATION_END, `  - package.json\n${DECLARATION_END}`)],
    ['「-」後兩個空白', decl().replace(DECLARATION_END, `-  package.json\n${DECLARATION_END}`)],
    ['「-」後沒有空白', decl().replace(DECLARATION_END, `-package.json\n${DECLARATION_END}`)],
    ['只有「- 」', decl().replace(DECLARATION_END, `- \n${DECLARATION_END}`)],
    ['反引號', decl('`package.json`')],
    ['單引號', decl("'package.json'")],
    ['雙引號', decl('"package.json"')],
    ['重複列出', decl('package.json', 'package.json')],
  ])('格式錯誤要判失敗：%s', (_label, body) => {
    const parsed = parseDeclaration(body);
    expect(parsed).not.toBeNull();
    expect(parsed?.valid).toBe(false);
    expect(parsed?.errors.length).toBeGreaterThan(0);
  });
});

describe('evaluate：設計分支（design/ 開頭）', () => {
  it('① 只改開放區 → 通過', () => {
    const r = run({ headRef: DESIGN, files: [M('src/views/HomeView.tsx'), A('src/components/NewCard.tsx'), M('src/styles/globals.css'), A('public/design/a.png')] });
    expect(r).toMatchObject({ ok: true, kind: 'design', reason: 'pass', protectedFiles: [], restoreCommands: [] });
  });

  it('② 改受保護檔 → 失敗，附正體中文說明與單檔還原指令', () => {
    const r = run({ headRef: DESIGN, files: [M('src/views/HomeView.tsx'), M('src/pages/index.tsx')] });
    expect(r).toMatchObject({ ok: false, kind: 'design', reason: 'design-protected', protectedFiles: ['src/pages/index.tsx'] });
    expect(r.restoreCommands).toEqual(['git fetch origin main', co('src/pages/index.tsx')]);
    expect(r.message).toContain('這個檔案受保護，請交給施工者');
    expect(r.message).toContain('src/pages/index.tsx');
  });

  it('③ 改 .github/ → 失敗', () => {
    const r = run({ headRef: DESIGN, files: [M('.github/workflows/ci.yml'), A('.github/workflows/evil.yml')] });
    expect(r.ok).toBe(false);
    expect(r.protectedFiles).toEqual(['.github/workflows/ci.yml', '.github/workflows/evil.yml']);
    expect(r.restoreCommands).toEqual(['git fetch origin main', co('.github/workflows/ci.yml'), rm('.github/workflows/evil.yml')]);
  });

  it('④ 把檔案從開放區改名移出 → 失敗，整筆改名復原', () => {
    const r = run({ headRef: DESIGN, files: [R('src/views/HomeView.tsx', 'src/pages/HomeView.tsx')] });
    expect(r).toMatchObject({ ok: false, reason: 'design-protected', protectedFiles: ['src/pages/HomeView.tsx'] });
    expect(r.restoreCommands).toEqual(['git fetch origin main', co('src/views/HomeView.tsx'), rm('src/pages/HomeView.tsx')]);
  });

  it('從受保護區改名移入開放區 → 失敗（舊路徑受保護）', () => {
    const r = run({ headRef: DESIGN, files: [R('src/components/safe/SafeHtml.tsx', 'src/components/SafeHtml.tsx')] });
    expect(r).toMatchObject({ ok: false, protectedFiles: ['src/components/safe/SafeHtml.tsx'] });
    expect(r.restoreCommands).toEqual(['git fetch origin main', co('src/components/safe/SafeHtml.tsx'), rm('src/components/SafeHtml.tsx')]);
  });

  it('開放區內改名 → 通過', () => {
    expect(run({ headRef: DESIGN, files: [R('src/views/A.tsx', 'src/components/A.tsx')] }).ok).toBe(true);
  });

  it('每種 status 的還原指令', () => {
    const r = run({
      headRef: DESIGN,
      files: [
        M('src/pages/[slug].tsx'),
        { filename: 'package.json', status: 'changed' },
        D('src/lib/format.ts'),
        A('src/pages/new.tsx'),
        { filename: 'src/server/copy.ts', status: 'copied', previous_filename: 'src/server/api-client.ts' },
        { filename: 'src/server/same.ts', status: 'unchanged' },
      ],
    });
    expect(r.restoreCommands).toEqual([
      'git fetch origin main',
      co('src/pages/[slug].tsx'),
      co('package.json'),
      co('src/lib/format.ts'),
      rm('src/pages/new.tsx'),
      rm('src/server/copy.ts'),
      co('src/server/same.ts'),
    ]);
    // 複製的來源檔沒有被修改，不列入
    expect(r.protectedFiles).not.toContain('src/server/api-client.ts');
  });

  it('從受保護區複製到開放區只檢查新路徑 → 通過', () => {
    const files = [{ filename: 'src/components/MyHtml.tsx', status: 'copied', previous_filename: 'src/components/safe/SafeHtml.tsx' }];
    expect(run({ headRef: DESIGN, files }).ok).toBe(true);
  });

  it('檔名含單引號時正確跳脫', () => {
    const r = run({ headRef: DESIGN, files: [M("src/pages/it's.tsx")] });
    expect(r.restoreCommands[1]).toBe(`git --literal-pathspecs checkout ${BASE} -- 'src/pages/it'\\''s.tsx'`);
  });

  it('怪路徑不產生還原指令，改請施工者處理', () => {
    const r = run({ headRef: DESIGN, files: [A('src/views/a\n.tsx'), M('src/pages/index.tsx')] });
    expect(r.ok).toBe(false);
    expect(r.restoreCommands).toEqual(['git fetch origin main', co('src/pages/index.tsx')]);
    expect(r.message).toContain('無法安全產生還原指令');
  });

  it('PR 說明有宣告也不放行', () => {
    const r = run({ headRef: DESIGN, files: [M('package.json')], body: decl('package.json') });
    expect(r).toMatchObject({ ok: false, reason: 'design-protected' });
    expect(r.message).toContain('也不會放行');
  });

  it.each(['Design/work', 'DESIGN/work', 'refs/heads/design/work'])('分支名 %s 也算設計分支', (headRef) => {
    expect(run({ headRef, files: [M('package.json')], body: decl('package.json') }).kind).toBe('design');
  });

  it.each(['design', 'designer/work', 'claude/design/work'])('分支名 %s 不算設計分支', (headRef) => {
    expect(run({ headRef }).kind).toBe('builder');
  });
});

describe('evaluate：施工者分支', () => {
  it('⑤ 改受保護檔、沒有宣告 → 失敗', () => {
    const r = run({ files: [M('package.json')], body: '更新相依套件' });
    expect(r).toMatchObject({ ok: false, kind: 'builder', reason: 'declaration-missing', missing: ['package.json'] });
    expect(r.message).toContain(DECLARATION_BEGIN);
    expect(r.restoreCommands).toEqual([]);
  });

  it('PR 說明為 null（GitHub 回傳空說明）→ 視同沒有宣告', () => {
    expect(run({ files: [M('package.json')], body: null }).reason).toBe('declaration-missing');
  });

  it('⑥ 宣告與實際清單一致 → 通過，訊息開頭寫「合併前請核對」並列出清單', () => {
    const files = [M('package.json'), M('src/server/api-client.ts'), M('src/views/HomeView.tsx')];
    const r = run({ files, body: decl('src/server/api-client.ts', 'package.json') });
    expect(r).toMatchObject({ ok: true, kind: 'builder', reason: 'pass', protectedFiles: ['package.json', 'src/server/api-client.ts'], missing: [], extra: [] });
    expect(r.message.startsWith('### 合併前請核對')).toBe(true);
    expect(r.message).toContain('src/server/api-client.ts');
  });

  it('⑦ 宣告少列 → 失敗', () => {
    const r = run({ files: [M('package.json'), M('package-lock.json')], body: decl('package.json') });
    expect(r).toMatchObject({ ok: false, reason: 'declaration-mismatch', missing: ['package-lock.json'], extra: [] });
  });

  it('⑦ 宣告多列 → 失敗', () => {
    const r = run({ files: [M('package.json')], body: decl('package.json', 'src/server/api-client.ts') });
    expect(r).toMatchObject({ ok: false, reason: 'declaration-mismatch', missing: [], extra: ['src/server/api-client.ts'] });
  });

  it('⑦ 宣告列了開放區的檔案也算多列', () => {
    const r = run({ files: [M('package.json'), M('src/views/HomeView.tsx')], body: decl('package.json', 'src/views/HomeView.tsx') });
    expect(r).toMatchObject({ ok: false, extra: ['src/views/HomeView.tsx'] });
  });

  it('比對逐字相等：./ 前綴或大小寫不同都不算', () => {
    expect(run({ files: [M('package.json')], body: decl('./package.json') }).ok).toBe(false);
    expect(run({ files: [M('README.md')], body: decl('readme.md') }).ok).toBe(false);
  });

  it('改名時舊路徑與新路徑都要宣告', () => {
    const files = [R('src/server/a.ts', 'src/server/b.ts')];
    expect(run({ files, body: decl('src/server/b.ts') })).toMatchObject({ ok: false, missing: ['src/server/a.ts'] });
    expect(run({ files, body: decl('src/server/a.ts', 'src/server/b.ts') }).ok).toBe(true);
  });

  it('從開放區改名移入受保護區時只宣告新路徑', () => {
    const files = [R('src/views/A.tsx', 'src/pages/A.tsx')];
    expect(run({ files, body: decl('src/pages/A.tsx') }).ok).toBe(true);
  });

  it('沒改到受保護路徑、沒有宣告 → 通過', () => {
    expect(run({ files: [M('src/views/HomeView.tsx')], body: '調整首頁' })).toMatchObject({ ok: true, reason: 'pass' });
  });

  it('沒改到受保護路徑、宣告是空的 → 通過', () => {
    expect(run({ files: [M('src/views/HomeView.tsx')], body: decl() }).ok).toBe(true);
  });

  it('沒改到受保護路徑、宣告不是空的 → 失敗', () => {
    const r = run({ files: [M('src/views/HomeView.tsx')], body: decl('package.json') });
    expect(r).toMatchObject({ ok: false, reason: 'declaration-not-empty', extra: ['package.json'] });
  });

  it('宣告區塊格式錯誤 → 失敗（即使內容與實際一致，或沒改到受保護路徑）', () => {
    const malformed = decl('package.json').replace(DECLARATION_END, '');
    expect(run({ files: [M('package.json')], body: malformed }).reason).toBe('declaration-invalid');
    expect(run({ files: [M('src/views/A.tsx')], body: `${DECLARATION_BEGIN}\n${DECLARATION_BEGIN}\n${DECLARATION_END}` }).reason).toBe(
      'declaration-invalid',
    );
    expect(run({ files: [M('package.json')], body: decl('`package.json`') }).reason).toBe('declaration-invalid');
  });
});

describe('evaluate：他人 fork 的 PR', () => {
  it('⑩ 改受保護檔 → 失敗，有宣告也一樣', () => {
    const r = run({ isFork: true, headRef: 'main', files: [M('src/server/api-client.ts')], body: decl('src/server/api-client.ts') });
    expect(r).toMatchObject({ ok: false, kind: 'fork', reason: 'fork-protected', protectedFiles: ['src/server/api-client.ts'] });
  });

  it('fork 的分支名是 design/ 開頭也照 fork 判定', () => {
    expect(run({ isFork: true, headRef: DESIGN, files: [M('package.json')] }).kind).toBe('fork');
  });

  it('只改開放區 → 通過', () => {
    expect(run({ isFork: true, headRef: 'patch-1', files: [M('src/views/HomeView.tsx')] })).toMatchObject({ ok: true, kind: 'fork' });
  });
});

describe('evaluate：清單不完整與輸入格式', () => {
  it.each([
    ['施工者', { headRef: BUILDER }],
    ['設計', { headRef: DESIGN }],
    ['fork', { isFork: true }],
  ])('清單不完整一律失敗（%s，即使沒有任何受保護變更）', (_label, overrides) => {
    const r = run({ ...overrides, files: [M('src/views/HomeView.tsx')], listComplete: false });
    expect(r).toMatchObject({ ok: false, reason: 'list-incomplete' });
  });

  it('listComplete 不是 true（例如沒給）也算不完整', () => {
    const input = { isFork: false, headRef: BUILDER, files: [], body: '' } as unknown as EvaluateInput;
    expect(evaluate(input).reason).toBe('list-incomplete');
  });

  it.each([
    ['files 不是陣列', { files: {} }],
    ['項目不是物件', { files: ['package.json'] }],
    ['缺 filename', { files: [{ status: 'modified' }] }],
    ['filename 是空字串', { files: [{ filename: '', status: 'modified' }] }],
    ['不認得的 status', { files: [{ filename: 'src/views/a.tsx', status: 'moved' }] }],
    ['改名缺 previous_filename', { files: [{ filename: 'src/views/a.tsx', status: 'renamed' }] }],
    ['isFork 不是布林值', { isFork: 'false' }],
    ['headRef 是空字串', { headRef: '' }],
    ['body 不是文字', { body: 42 }],
  ])('輸入格式不對一律失敗：%s', (_label, overrides) => {
    const r = run(overrides as unknown as Partial<EvaluateInput>);
    expect(r).toMatchObject({ ok: false, reason: 'invalid-input' });
  });

  it('evaluate 不帶參數也不會丟例外', () => {
    expect(evaluate(undefined as unknown as EvaluateInput)).toMatchObject({ ok: false, kind: 'invalid', reason: 'invalid-input' });
  });
});

describe('訊息：來自 PR 的字串只放在程式碼區塊內', () => {
  it('檔名含反引號、@提及與 HTML 時，圍欄加長且文字不外露', () => {
    const evil = 'src/pages/```@everyone<img src=x>.tsx';
    const r = run({ headRef: DESIGN, files: [M(evil)] });
    expect(r.message).toContain('````text');
    expect(r.message).toContain(evil);
    expect(outsideCode(r.message)).not.toContain('@everyone');
    expect(outsideCode(r.message)).not.toContain('<img');
  });

  it('宣告內容的錯誤訊息不回顯 PR 文字', () => {
    const r = run({ files: [M('package.json')], body: `${DECLARATION_BEGIN}\n+ @everyone\n${DECLARATION_END}` });
    expect(r.reason).toBe('declaration-invalid');
    expect(r.message).not.toContain('@everyone');
  });
});

describe('命令列', () => {
  const dir = makeTemp();
  const write = (name: string, content: string) => {
    const file = path.join(dir, name);
    writeFileSync(file, content);
    return file;
  };
  const cli = (args: string[]) => {
    const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
    return { code: res.status, stdout: res.stdout, stderr: res.stderr };
  };
  const filesOpen = write('open.json', JSON.stringify([M('src/views/HomeView.tsx')]));
  const filesProtected = write('protected.json', JSON.stringify([M('package.json')]));
  const emptyBody = write('empty.txt', '');
  const declBody = write('decl.txt', `${String.fromCodePoint(0xfeff)}${decl('package.json')}`);

  it('通過 → exit 0，標準輸出是 JSON', () => {
    const r = cli([`--files=${filesOpen}`, `--body=${emptyBody}`, `--head-ref=${DESIGN}`]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: true, kind: 'design' });
  });

  it('未通過 → exit 30', () => {
    const r = cli([`--files=${filesProtected}`, `--body=${emptyBody}`, `--head-ref=${DESIGN}`]);
    expect(r.code).toBe(30);
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: false, reason: 'design-protected' });
  });

  it('施工者宣告一致 → exit 0（說明檔開頭的 BOM 會去掉）', () => {
    expect(cli([`--files=${filesProtected}`, `--body=${declBody}`, `--head-ref=${BUILDER}`]).code).toBe(0);
  });

  it('--fork 與 --incomplete', () => {
    expect(JSON.parse(cli([`--files=${filesProtected}`, `--body=${declBody}`, `--head-ref=x`, '--fork']).stdout).reason).toBe('fork-protected');
    const r = cli([`--files=${filesOpen}`, `--body=${emptyBody}`, `--head-ref=${BUILDER}`, '--incomplete']);
    expect(r.code).toBe(30);
    expect(JSON.parse(r.stdout).reason).toBe('list-incomplete');
  });

  it('接受分頁的陣列的陣列（gh api --paginate --slurp）', () => {
    const pages = write('pages.json', JSON.stringify([[M('src/views/A.tsx')], [M('package.json')]]));
    const r = cli([`--files=${pages}`, `--body=${emptyBody}`, `--head-ref=${DESIGN}`]);
    expect(r.code).toBe(30);
    expect(JSON.parse(r.stdout).protectedFiles).toEqual(['package.json']);
  });

  it('分支名含 shell 特殊字元時照字面處理', () => {
    const r = cli([`--files=${filesOpen}`, `--body=${emptyBody}`, '--head-ref=feature/$(touch x)`id`']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).kind).toBe('builder');
  });

  it('結構不對的清單 → exit 30（invalid-input）', () => {
    const bad = write('bad-entries.json', JSON.stringify({ files: [] }));
    const r = cli([`--files=${bad}`, `--body=${emptyBody}`, `--head-ref=${BUILDER}`]);
    expect(r.code).toBe(30);
    expect(JSON.parse(r.stdout).reason).toBe('invalid-input');
  });

  it.each([
    ['缺 --files', [`--body=${emptyBody}`, '--head-ref=x']],
    ['缺 --body', [`--files=${filesOpen}`, '--head-ref=x']],
    ['缺 --head-ref', [`--files=${filesOpen}`, `--body=${emptyBody}`]],
    ['--head-ref 是空的', [`--files=${filesOpen}`, `--body=${emptyBody}`, '--head-ref=']],
    ['不認得的參數', [`--files=${filesOpen}`, `--body=${emptyBody}`, '--head-ref=x', '--yes']],
    ['多餘的位置參數', [`--files=${filesOpen}`, `--body=${emptyBody}`, '--head-ref=x', 'extra']],
    ['布林參數帶值', [`--files=${filesOpen}`, `--body=${emptyBody}`, '--head-ref=x', '--fork=false']],
    ['檔案清單不存在', [`--files=${path.join(dir, 'nope.json')}`, `--body=${emptyBody}`, '--head-ref=x']],
    ['檔案清單不是 JSON', [`--files=${emptyBody}`, `--body=${emptyBody}`, '--head-ref=x']],
    ['說明檔不存在', [`--files=${filesOpen}`, `--body=${path.join(dir, 'nope.txt')}`, '--head-ref=x']],
  ])('參數錯 → exit 10（%s）', (_label, args) => {
    const r = cli(args);
    expect(r.code).toBe(10);
    expect(r.stdout).toBe('');
  });

  it('--help → exit 0', () => {
    const r = cli(['--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('用法');
  });
});

describe('還原指令在真的 git 儲存庫裡有效', () => {
  const STATUS: Record<string, string> = { M: 'modified', A: 'added', D: 'removed', T: 'changed' };
  // 不讀使用者自己的 git 設定：指向一個空檔案。不用 /dev/null：部分 Git for Windows 版本讀取空裝置會出錯。
  const emptyGitConfig = path.join(makeTemp(), 'empty-gitconfig');
  writeFileSync(emptyGitConfig, '');
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: emptyGitConfig,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  };
  const git = (cwd: string, ...args: string[]) => {
    const res = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    if (res.status !== 0) throw new Error(`git ${args.join(' ')} 失敗：${res.stderr}`);
    return res.stdout;
  };
  /**
   * 還原指令約定以 Git Bash 執行（委託人的本機 Claude Code 在 Git Bash 裡跑）。
   * Windows 上直接呼叫 `bash` 可能解析成 WSL 的 System32\bash.exe（Linux 環境、找不到 Windows 的 git），
   * 所以從 git 自己的安裝位置找 Git Bash：git --exec-path 是 <Git>/mingw64（或 ucrt64）/libexec/git-core。
   */
  const gitBash = (): string => {
    if (process.platform !== 'win32') return 'bash';
    const root = path.resolve(git(tmpdir(), '--exec-path').trim(), '..', '..', '..');
    const candidates = [path.join(root, 'bin', 'bash.exe'), path.join(root, 'usr', 'bin', 'bash.exe')];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (found === undefined) throw new Error(`找不到 Git Bash（找過：${candidates.join('、')}）`);
    return found;
  };
  const put = (root: string, rel: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  };
  /** 以三點差異（與 GitHub PR 相同，以合併基準計算）轉成「列出 PR 變更檔」API 的格式。 */
  const prFiles = (cwd: string): PrFile[] => {
    const fields = git(cwd, 'diff', '--name-status', '-z', '-M', 'origin/main...HEAD').split('\0').filter((x) => x !== '');
    const files: PrFile[] = [];
    for (let i = 0; i < fields.length; ) {
      const code = fields[i] ?? '';
      if (code.startsWith('R')) {
        files.push({ filename: fields[i + 2] ?? '', status: 'renamed', previous_filename: fields[i + 1] ?? '' });
        i += 3;
      } else {
        files.push({ filename: fields[i + 1] ?? '', status: STATUS[code[0] ?? ''] ?? 'unknown' });
        i += 2;
      }
    }
    return files;
  };

  it('各種 status 還原後守門通過，開放區的修改保留，main 之後的新版本不被覆蓋', () => {
    const root = makeTemp();
    const origin = path.join(root, 'origin');
    const work = path.join(root, 'work');
    mkdirSync(origin);
    git(origin, 'init', '-q', '-b', 'main');
    const base: Record<string, string> = {
      'src/pages/[slug].tsx': 'base slug\n',
      'src/pages/s.tsx': 'base s\n',
      "src/pages/it's.tsx": 'base quote\n',
      'src/components/safe/X.tsx': 'base safe\n',
      'src/views/A.tsx': 'base A\n',
      'src/views/B.tsx': 'base B\n',
      'package.json': '{}\n',
    };
    for (const [rel, content] of Object.entries(base)) put(origin, rel, content);
    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '-m', 'base');
    git(root, 'clone', '-q', origin, work);
    git(work, 'checkout', '-q', '-b', DESIGN);

    // 設計分支的意外改動
    put(work, 'src/pages/[slug].tsx', 'design slug\n');
    put(work, 'src/views/B.tsx', 'design B\n');
    put(work, 'src/pages/new.tsx', 'design new\n');
    git(work, 'rm', '-q', "src/pages/it's.tsx");
    git(work, 'mv', 'src/components/safe/X.tsx', 'src/components/X.tsx');
    git(work, 'mv', 'src/views/A.tsx', 'src/pages/A.tsx');
    git(work, 'add', '-A');
    // 權限變更直接記在 index：Windows 的 core.filemode=false 看不到檔案系統的 chmod。
    // 必須放在 git add -A 之後；放在之前，Linux（core.filemode=true）的 add 會依工作樹的 644 把它蓋回去。
    git(work, 'update-index', '--chmod=+x', 'package.json');
    git(work, 'commit', '-q', '-m', 'design');

    // main 之後又改了同一個受保護檔（design/work 尚未合併最新 main）
    put(origin, 'src/pages/[slug].tsx', 'newer main slug\n');
    git(origin, 'commit', '-q', '-am', 'main moves on');

    const before = run({ headRef: DESIGN, files: prFiles(work) });
    expect(before.ok).toBe(false);
    expect(before.protectedFiles).toEqual(
      ['package.json', 'src/components/safe/X.tsx', 'src/pages/A.tsx', "src/pages/it's.tsx", 'src/pages/new.tsx', 'src/pages/[slug].tsx'].sort(),
    );

    const restored = spawnSync(gitBash(), ['-e', '-c', before.restoreCommands.join('\n')], { cwd: work, env, encoding: 'utf8' });
    expect(restored.status, restored.stderr).toBe(0);
    git(work, 'commit', '-q', '-m', 'restore');

    const after = run({ headRef: DESIGN, files: prFiles(work) });
    expect(after).toMatchObject({ ok: true, protectedFiles: [] });
    expect(prFiles(work)).toEqual([M('src/views/B.tsx')]);
    // 萬用字元沒有誤中 s.tsx；main 的新版本合併後仍會保留（以合併基準取回）
    expect(readFileSync(path.join(work, 'src/pages/s.tsx'), 'utf8')).toBe('base s\n');
    expect(readFileSync(path.join(work, 'src/pages/[slug].tsx'), 'utf8')).toBe('base slug\n');
  });
});
