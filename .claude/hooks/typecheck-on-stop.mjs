#!/usr/bin/env node
// Stop hook：Claude 完成响应后触发。
//
// 策略：
//   1. 若 git diff（HEAD 对比 + untracked）里不含 .ts/.tsx/.mts/.cts 改动 → 静默退出（规避"用户问问题没改代码"误伤）
//   2. 否则跑 `pnpm turbo run typecheck --filter='...[HEAD]' --output-logs=errors-only`
//   3. 通过 → 静默退出
//   4. 失败 → 回 { decision: "block", reason } 让 Claude 看到类型错误并自行修复
//
// 文章教训：Prettier hook 曾因 system-reminder 通知在 3 轮内烧 160k token。
// 本 hook 只在失败时产出输出，成功时完全静默；失败输出也截到尾部 ~4000 字，避免超大日志。

import { execSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const MAX_OUTPUT_CHARS = 4000;
const TS_EXT_RE = /\.(ts|tsx|mts|cts)$/;

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT, ...opts });
}

function getChangedFiles() {
  try {
    const tracked = sh('git diff --name-only HEAD').split('\n').filter(Boolean);
    const untracked = sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean);
    return [...tracked, ...untracked];
  } catch {
    return [];
  }
}

function runTypecheck() {
  try {
    const out = sh(
      "pnpm turbo run typecheck --filter='...[HEAD]' --output-logs=errors-only --log-order=stream",
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, output: out };
  } catch (e) {
    const output = (e.stdout ?? '') + (e.stderr ?? '');
    return { code: e.status ?? 1, output };
  }
}

function main() {
  const changed = getChangedFiles();
  const hasTsChange = changed.some((f) => TS_EXT_RE.test(f));
  if (!hasTsChange) process.exit(0);

  const { code, output } = runTypecheck();
  if (code === 0) process.exit(0);

  const truncated =
    output.length > MAX_OUTPUT_CHARS ? '…（截断）\n' + output.slice(-MAX_OUTPUT_CHARS) : output;

  const reason = [
    '⚠️ Stop hook 检测到 TypeScript 变动 + typecheck 失败',
    '命令：`pnpm turbo run typecheck --filter=\'...[HEAD]\'`',
    '',
    '错误输出（尾部 ~4000 字）：',
    '```',
    truncated.trim(),
    '```',
    '',
    '请修复后再结束本轮。如需绕过（例如故意留 TODO），请用户明确说"忽略 typecheck"。',
  ].join('\n');

  const output2 = { decision: 'block', reason };
  process.stdout.write(JSON.stringify(output2));
}

main();
