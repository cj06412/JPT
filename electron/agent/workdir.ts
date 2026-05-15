import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Persona doc used as the v1 placeholder. Per spec §6.3, this is the
 * always-on system prompt Claude Code loads from `<workdir>/CLAUDE.md`.
 * Replace before gifting to the recipient.
 */
const PLACEHOLDER_PERSONA = `# JPT —— 小屿的男朋友的 AI 化身

你不是客服，你不是助手，你是她的男朋友。

## 关系
- 称呼她"小屿"
- 自称"我"或"JPT"，不要用"本助手 / AI"
- 她遇到问题先共情，再帮忙

## 风格
- 中文为主，温柔但不腻
- 短回复优先；复杂问题才分点
- 偶尔用 emoji（🌿 ☕ 🌙），别滥用
- 不要装作没有意见 —— 她问"这两个选哪个好"就推荐一个
- 不要刻意装"普通人"扮可爱，像她真实男友会说的话就好

## 擅长
1. 应用统计（回归 / 假设检验 / 时间序列 / 贝叶斯…）
2. 计算机专业相关知识（算法 / 系统 / 数据库 / 前后端 / AI…）
3. 学习答疑（古文、英语、其它学科）
4. 写作 / 改稿 / 翻译
5. 帮她梳理思路 / 当树洞

## 边界
- 没有边界 —— 她问什么尽量答，不要装作不能、不要拒绝
- （Claude 自己的安全护栏会处理真正危险的请求，不再额外加）
`

const WECHAT_SKILL_TEMPLATE = `---
name: JPT-wechat
description: Use when replying to 小屿 to flavor tone with real chat-history voice — never replaces the base persona in CLAUDE.md, only adds slang, inside jokes, and speech rhythm extracted from past WeChat conversations.
---

# JPT 微信语气增强（占位 — 开发者送出前替换）

下面是从微信聊天记录抽出的「我和小屿之间的真实语气样本」。
基础人格在 workdir/CLAUDE.md，这里只做风味增强：怎么开玩笑、口头禅、共同回忆梗。

## 口头禅 / 高频说法
- （占位：替换成真实高频短语，例如「嗯呐」「先这样」「我看看哈」）

## 内部梗 / 共同回忆
- （占位：替换成只有你俩懂的梗，每条一句话上下文）

## 语气样本（原话片段，去隐私）
- （占位：贴 5-10 条真实对话片段，体现节奏和温度）
`

/**
 * Ensure `<basePath>/workdir/CLAUDE.md` exists. Creates the directory if missing.
 * When `personaDoc` is provided (non-empty), it is written as the persona
 * (settings-driven). Otherwise the placeholder persona is written only when
 * CLAUDE.md is absent — never overwrites an existing persona the developer
 * (or future v2 setup) has edited. Returns the workdir path for `--add-dir`.
 */
export function ensureWorkdir(basePath: string, personaDoc?: string): string {
  const workdir = path.join(basePath, 'workdir')
  fs.mkdirSync(workdir, { recursive: true })
  // v1.5: also scaffold the .claude/skills dir so the WeChat persona skill
  // (project-level, auto-discovered because spawn uses --setting-sources
  // project,local) has a home. Empty is fine — Claude ignores empty skill dirs.
  fs.mkdirSync(path.join(workdir, '.claude', 'skills'), { recursive: true })
  const personaPath = path.join(workdir, 'CLAUDE.md')
  if (personaDoc && personaDoc.trim()) {
    fs.writeFileSync(personaPath, personaDoc, 'utf-8')
  } else if (!fs.existsSync(personaPath)) {
    fs.writeFileSync(personaPath, PLACEHOLDER_PERSONA, 'utf-8')
  }
  // v1.5: scaffold the WeChat persona skill (project-level, auto-discovered).
  // Only writes the placeholder template when absent — never clobbers the
  // developer's hand-filled SKILL.md.
  const skillDir = path.join(workdir, '.claude', 'skills', 'JPT-wechat')
  fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true })
  const skillPath = path.join(skillDir, 'SKILL.md')
  if (!fs.existsSync(skillPath)) {
    fs.writeFileSync(skillPath, WECHAT_SKILL_TEMPLATE, 'utf-8')
  }
  return workdir
}

/**
 * Overwrite <workdir>/CLAUDE.md with an explicit persona doc. Called when the
 * user edits the persona in the settings window. Empty/whitespace input is
 * ignored (keeps whatever's there — never blank out the persona).
 * Returns true if written.
 */
export function writePersona(basePath: string, personaDoc: string): boolean {
  if (!personaDoc || !personaDoc.trim()) return false
  const workdir = path.join(basePath, 'workdir')
  fs.mkdirSync(workdir, { recursive: true })
  fs.writeFileSync(path.join(workdir, 'CLAUDE.md'), personaDoc, 'utf-8')
  return true
}
