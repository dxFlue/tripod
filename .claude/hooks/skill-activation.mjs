#!/usr/bin/env node
// UserPromptSubmit hook：读 .claude/skills/skill-rules.json，
// 按 keyword / intentPattern 匹配用户 prompt，命中则通过 additionalContext
// 提示 Claude 激活对应 skill。不阻塞、不拦截——只增强上下文。
//
// 输入（stdin JSON）：Claude Code 投递的事件对象，含 { prompt, hook_event_name, ... }
// 输出（stdout JSON）：{ hookSpecificOutput: { hookEventName, additionalContext } }

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const RULES_PATH = path.join(REPO_ROOT, '.claude', 'skills', 'skill-rules.json');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parseJsonOrEmpty(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadRules() {
  try {
    return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
  } catch {
    return { skills: {} };
  }
}

function matchSkill(prompt, config) {
  const triggers = config.promptTriggers ?? {};
  const keywords = Array.isArray(triggers.keywords) ? triggers.keywords : [];
  const intentPatterns = Array.isArray(triggers.intentPatterns) ? triggers.intentPatterns : [];

  for (const kw of keywords) {
    if (typeof kw === 'string' && kw.length > 0 && prompt.includes(kw)) {
      return { hit: kw, kind: 'keyword' };
    }
  }
  for (const src of intentPatterns) {
    if (typeof src !== 'string') continue;
    let re;
    try {
      re = new RegExp(src, 'i');
    } catch {
      continue;
    }
    if (re.test(prompt)) {
      return { hit: src, kind: 'pattern' };
    }
  }
  return null;
}

function priorityRank(p) {
  if (p === 'high') return 0;
  if (p === 'medium') return 1;
  return 2;
}

function main() {
  const input = parseJsonOrEmpty(readStdin());
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  if (prompt.length === 0) process.exit(0);

  const rules = loadRules();
  const skills = rules.skills ?? {};
  const matched = [];

  for (const [name, config] of Object.entries(skills)) {
    const hit = matchSkill(prompt, config);
    if (hit) {
      matched.push({
        name,
        priority: config.priority ?? 'medium',
        hit: hit.hit,
        kind: hit.kind,
      });
    }
  }

  if (matched.length === 0) process.exit(0);

  matched.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  const lines = matched.map(
    (m) => `- \`${m.name}\`（${m.kind === 'keyword' ? '关键词' : '意图正则'} 命中：${m.hit}）`,
  );

  const additionalContext = [
    '🎯 **skill 自动激活提示**',
    '',
    '当前 prompt 匹配到以下 skill，请优先用 Skill 工具调用（除非用户明确说不用）：',
    '',
    ...lines,
    '',
    '规则来源：`.claude/skills/skill-rules.json`。',
  ].join('\n');

  const output = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  };

  process.stdout.write(JSON.stringify(output));
}

main();
