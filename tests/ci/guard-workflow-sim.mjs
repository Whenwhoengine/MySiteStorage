#!/usr/bin/env node
// 受保護（tests/**）：守門工作流程 .github/workflows/protected-paths.yml 的模擬測試（FE-11 中屬工作流程層的部分）。
// 判定邏輯本身由 tests/unit/protected-paths.test.ts 涵蓋；這裡驗證工作流程的 shell 步驟：
//   讀 PR、分頁讀變更檔、筆數比對、fork 判斷、舊提交作廢、留言只更新守門自己那一則、PR 欄位不會被當成指令執行。
// 做法：以假的 gh（依情境資料夾裡的檔案回應 API）取代真的 GitHub API，照 GitHub 的方式（bash -eo pipefail）
// 逐步執行工作流程裡的 run: 區塊。需要 bash 與 jq（GitHub 的 ubuntu runner 內建）。
// 真的 pull_request_target 事件、檢查結果綁在哪個提交、分支保護是否擋下合併，仍須以測試 PR 實測（F3 第 3 步）。
// exit code：0 全部符合預期；30 有情境不符；10 環境缺件（沒有 bash 或 jq）或工作流程格式讀不懂。
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = path.join(ROOT, '.github/workflows/protected-paths.yml');
const MARKER = '<!-- mysitestorage-protected-paths -->';

for (const tool of ['bash', 'jq']) {
  if (spawnSync(tool, ['--version'], { encoding: 'utf8' }).status !== 0) {
    process.stderr.write(`缺少 ${tool}，無法模擬工作流程\n`);
    process.exit(10);
  }
}

/** 從工作流程取出各步驟的 name、id 與 run 區塊（只支援本檔用到的「run: |」寫法；讀不懂就失敗）。 */
function readSteps(text) {
  const lines = text.split('\n');
  const steps = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const stepStart = /^(\s*)- name: (.+)$/.exec(line);
    if (stepStart) {
      current = { name: stepStart[2].trim(), id: null, run: null, indent: stepStart[1].length };
      steps.push(current);
      continue;
    }
    if (current === null) continue;
    const id = /^\s+id: (\S+)\s*$/.exec(line);
    if (id) current.id = id[1];
    const run = /^(\s+)run: \|\s*$/.exec(line);
    if (run) {
      const keyIndent = run[1].length;
      const body = [];
      let j = i + 1;
      for (; j < lines.length; j += 1) {
        const l = lines[j];
        if (l.trim() !== '' && l.length - l.trimStart().length <= keyIndent) break;
        body.push(l);
      }
      const indents = body.filter((l) => l.trim() !== '').map((l) => l.length - l.trimStart().length);
      const strip = Math.min(...indents);
      current.run = `${body.map((l) => l.slice(strip)).join('\n').trimEnd()}\n`;
      i = j - 1;
    }
  }
  return steps;
}

const steps = readSteps(readFileSync(WORKFLOW, 'utf8'));
const guardStep = steps.find((s) => s.id === 'guard');
const commentStep = steps.find((s) => s.name.startsWith('留言'));
const resultStep = steps.find((s) => s.name === '結果');
if (!guardStep?.run || !commentStep?.run || !resultStep?.run) {
  process.stderr.write('讀不到工作流程的「判定」「留言」「結果」三個步驟\n');
  process.exit(10);
}

// ── 假的 gh ──
const base = mkdtempSync(path.join(tmpdir(), 'guard-sim-'));
const binDir = path.join(base, 'bin');
mkdirSync(binDir);
writeFileSync(
  path.join(binDir, 'gh'),
  `#!/usr/bin/env bash
set -euo pipefail
[ "$1" = "api" ] || { echo "fake gh: only api" >&2; exit 2; }
shift
method=GET; input=""; jqexpr=""; slurp=0; target=""
while [ $# -gt 0 ]; do
  case "$1" in
    -X) method="$2"; shift 2 ;;
    --input) input="$2"; shift 2 ;;
    --jq) jqexpr="$2"; shift 2 ;;
    --paginate) shift ;;
    --slurp) slurp=1; shift ;;
    *) target="$1"; shift ;;
  esac
done
case "$method $target" in
  "GET repos/"*"/pulls/"*"/files?per_page=100")
    [ -f "$SIM/files_fail" ] && { echo "HTTP 502" >&2; exit 1; }
    [ "$slurp" = 1 ] || { echo "expected --slurp" >&2; exit 3; }
    cat "$SIM/files.json" ;;
  "GET repos/"*"/pulls/"*) cat "$SIM/pr.json" ;;
  "GET repos/"*"/issues/"*"/comments?per_page=100")
    if [ -n "$jqexpr" ]; then jq -r "$jqexpr" "$SIM/comments.json"; else cat "$SIM/comments.json"; fi ;;
  "PATCH repos/"*"/issues/comments/"*) echo "PATCH \${target##*/}" >> "$SIM/posted.log"; cp "$input" "$SIM/posted.json" ;;
  "POST repos/"*"/issues/"*"/comments") echo "POST" >> "$SIM/posted.log"; cp "$input" "$SIM/posted.json" ;;
  *) echo "fake gh: unexpected $method $target" >&2; exit 4 ;;
esac
`,
);
chmodSync(path.join(binDir, 'gh'), 0o755);

// ── 情境資料 ──
const HEAD = 'a'.repeat(40);
const SELF = 'Whenwhoengine/MySiteStorage';
function pr({ ref = 'claude/work', body = '', changed = 1, fork = false, deletedFork = false, sha = HEAD } = {}) {
  return {
    head: { sha, ref, repo: deletedFork ? null : { full_name: fork ? 'someone/MySiteStorage' : SELF } },
    base: { repo: { full_name: SELF } },
    body,
    changed_files: changed,
  };
}
const file = (filename, status = 'modified', previous) => ({ filename, status, ...(previous ? { previous_filename: previous } : {}) });
const declare = (...paths) => ['說明', '<!-- protected-change:begin -->', ...paths.map((p) => `- ${p}`), '<!-- protected-change:end -->'].join('\n');

function runStep(step, sim, env) {
  const output = path.join(sim, `output-${steps.indexOf(step)}.txt`);
  const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', step.run], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      HOME: process.env.HOME ?? '',
      SIM: sim,
      RUNNER_TEMP: path.join(sim, 'tmp'),
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: path.join(sim, 'summary.md'),
      ...env,
    },
  });
  const out = {};
  if (existsSync(output)) {
    for (const line of readFileSync(output, 'utf8').split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1);
    }
  }
  return { code: result.status, stderr: result.stderr, out };
}

let counter = 0;
function simulate({ prJson, files, comments = [], filesFail = false }) {
  counter += 1;
  const sim = path.join(base, `case-${counter}`);
  mkdirSync(path.join(sim, 'tmp'), { recursive: true });
  writeFileSync(path.join(sim, 'pr.json'), JSON.stringify(prJson));
  const pages = [];
  for (let i = 0; i < files.length; i += 100) pages.push(files.slice(i, i + 100));
  writeFileSync(path.join(sim, 'files.json'), JSON.stringify(pages.length > 0 ? pages : [[]]));
  writeFileSync(path.join(sim, 'comments.json'), JSON.stringify(comments));
  if (filesFail) writeFileSync(path.join(sim, 'files_fail'), '');
  const env = { GH_TOKEN: 'fake', REPO: SELF, PR_NUMBER: '7', EVENT_HEAD_SHA: HEAD };
  // 依工作流程的條件串起三個步驟：判定失敗就停；留言只在 stale == 'false' 時跑；前面都成功才跑結果
  const guard = runStep(guardStep, sim, env);
  const comment = guard.code === 0 && guard.out.stale === 'false' ? runStep(commentStep, sim, env) : null;
  const verdict = guard.code === 0 && (comment === null || comment.code === 0) ? runStep(resultStep, sim, { OK: guard.out.ok ?? '' }) : null;
  const posted = existsSync(path.join(sim, 'posted.log')) ? readFileSync(path.join(sim, 'posted.log'), 'utf8').trim() : '';
  const body = existsSync(path.join(sim, 'posted.json')) ? JSON.parse(readFileSync(path.join(sim, 'posted.json'), 'utf8')).body : '';
  const jobOk = guard.code === 0 && (comment === null || comment.code === 0) && verdict?.code === 0;
  return { jobOk, posted, body, out: guard.out, stderr: `${guard.stderr}${comment?.stderr ?? ''}` };
}

const cases = [];
const scenario = (name, input, expect) => cases.push({ name, input, expect });

scenario('施工者分支、宣告與實際一致 → 通過，留言開頭「合併前請核對」', {
  prJson: pr({ body: declare('package.json', 'src/server/api-client.ts'), changed: 3 }),
  files: [file('package.json'), file('src/server/api-client.ts'), file('src/views/HomeView.tsx')],
}, (r) => r.jobOk && r.posted === 'POST' && r.body.startsWith(MARKER) && r.body.includes('合併前請核對') && r.body.includes('`aaaaaaa`'));
scenario('施工者分支、沒有宣告 → 失敗', { prJson: pr({ body: '沒有區塊' }), files: [file('package.json')] },
  (r) => !r.jobOk && r.posted === 'POST' && r.body.includes('沒有受保護路徑宣告區塊'));
scenario('設計分支改到受保護檔 → 失敗，附還原指令', {
  prJson: pr({ ref: 'design/work', changed: 2 }),
  files: [file('src/views/HomeView.tsx'), file('src/pages/[slug].tsx', 'added')],
}, (r) => !r.jobOk && r.body.includes("git --literal-pathspecs rm -- 'src/pages/[slug].tsx'"));
scenario('設計分支只改開放區 → 通過', { prJson: pr({ ref: 'design/work' }), files: [file('src/views/HomeView.tsx')] }, (r) => r.jobOk && r.posted === 'POST');
scenario('fork 改到受保護檔（有宣告也不放行）→ 失敗', { prJson: pr({ fork: true, body: declare('package.json') }), files: [file('package.json')] },
  (r) => !r.jobOk && r.body.includes('fork'));
scenario('fork 已刪除（head.repo 為 null）→ 當 fork', { prJson: pr({ deletedFork: true, body: declare('package.json') }), files: [file('package.json')] },
  (r) => !r.jobOk && r.body.includes('fork'));
scenario('讀到的筆數與 changed_files 不同 → 失敗', { prJson: pr({ changed: 2 }), files: [file('src/views/HomeView.tsx')] },
  (r) => !r.jobOk && r.body.includes('沒有從 GitHub 完整讀到'));
scenario('變更檔 API 失敗 → 失敗', { prJson: pr(), files: [file('src/views/HomeView.tsx')], filesFail: true },
  (r) => !r.jobOk && r.body.includes('沒有從 GitHub 完整讀到'));
scenario('超過 API 上限 3000 筆 → 失敗', { prJson: pr({ changed: 3001 }), files: Array.from({ length: 3001 }, (_, i) => file(`src/views/v${i}.tsx`)) },
  (r) => !r.jobOk);
scenario('分頁 250 筆都在開放區 → 通過', { prJson: pr({ changed: 250 }), files: Array.from({ length: 250 }, (_, i) => file(`src/styles/s${i}.css`, 'added')) },
  (r) => r.jobOk);
scenario('檢查開始前 PR 又有新提交 → 本次作廢、不留言、工作失敗', { prJson: pr({ sha: 'b'.repeat(40) }), files: [file('src/views/HomeView.tsx')] },
  (r) => !r.jobOk && r.posted === '' && r.out.stale === 'true');
scenario('已有守門留言 → 更新同一則；別人帶同樣標記的留言不理會', {
  prJson: pr(),
  files: [file('src/views/HomeView.tsx')],
  comments: [
    { id: 11, user: { login: 'mallory' }, body: `${MARKER}\n假的` },
    { id: 22, user: { login: 'github-actions[bot]' }, body: `${MARKER}\n舊結果` },
  ],
}, (r) => r.jobOk && r.posted === 'PATCH 22');
scenario('只有別人帶標記的留言 → 另外新增一則', {
  prJson: pr(),
  files: [file('src/views/HomeView.tsx')],
  comments: [{ id: 11, user: { login: 'mallory' }, body: `${MARKER}\n假的` }],
}, (r) => r.jobOk && r.posted === 'POST');
const canary = path.join(base, 'INJECTED');
const evil = `$(touch ${canary})\`touch ${canary}\`;touch ${canary}`;
scenario('分支名、說明、檔名帶 shell 與工作流程指令 → 一律只當文字', {
  prJson: pr({ ref: `claude/${evil}`, body: `::error::x\n${evil}\n${declare('package.json')}`, changed: 2 }),
  files: [file('package.json'), file(`src/views/${evil}.tsx`)],
}, (r) => !existsSync(canary) && r.posted === 'POST');
scenario('分支名以 - 開頭 → 不被當成參數', { prJson: pr({ ref: '--fork' }), files: [file('src/views/HomeView.tsx')] },
  (r) => r.jobOk && r.body.includes('沒有改到受保護路徑'));
scenario('PR 說明為 null → 當成空白', { prJson: pr({ body: null }), files: [file('src/styles/globals.css')] }, (r) => r.jobOk);
scenario('改名：受保護區 → 開放區，只宣告新路徑 → 失敗（舊路徑受保護）', {
  prJson: pr({ body: declare('src/views/x.ts') }),
  files: [file('src/views/x.ts', 'renamed', 'src/lib/x.ts')],
}, (r) => !r.jobOk && r.body.includes('src/lib/x.ts'));
scenario('改名：開放區 → 受保護區，宣告新路徑 → 通過', {
  prJson: pr({ body: declare('src/lib/x.ts') }),
  files: [file('src/lib/x.ts', 'renamed', 'src/views/x.ts')],
}, (r) => r.jobOk);

let failed = 0;
for (const { name, input, expect } of cases) {
  const result = simulate(input);
  const ok = expect(result);
  if (!ok) failed += 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`);
  if (!ok) process.stdout.write(`  jobOk=${result.jobOk} posted=${JSON.stringify(result.posted)} stderr=${JSON.stringify(result.stderr.slice(0, 300))}\n`);
}
rmSync(base, { recursive: true, force: true });
process.stdout.write(`\n守門工作流程模擬：${cases.length - failed}/${cases.length} 個情境符合預期\n`);
process.exit(failed === 0 ? 0 : 30);
