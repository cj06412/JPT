# CLAUDE.md · JPT 项目交接背景

> 这份文件是给在 Windows 机器上启动 Claude Code 的接班人看的。
> 内容是从一个 macOS 上的 brainstorming + writing-plans + subagent-driven 半执行会话整理出来的。
> 项目所有正式产物（spec、plan）在 `docs/superpowers/`，**这份是补充上下文，不是规范**。

---

## 1. 项目一句话定位

JPT —— 一个 Stardew Valley 风格的 Windows 桌面 AI 伴侣。屏幕底部一个像素小人走来走去（外观是开发者本人化身），可拖、可挂在右墙、可被鼠标拎起；点它弹 SDV 经典 NPC 风格对话框，背后是 `claude` CLI 在跟用户聊学习 / 写作。

**是开发者送给女朋友的一份会动的礼物，未来可能开放推广。**

灵感来源：[ryanstephen/lil-agents](https://github.com/ryanstephen/lil-agents)（macOS 版）。我们做的是 Windows 重制 + 美术风格全换 + 行为模型扩展。

---

## 2. 涉及的人

| 角色 | 谁 | 备注 |
|---|---|---|
| 开发者 | `cj06412`（曹俊） | 研一应用统计，写过 Python / JS，初次写 Electron 不抗拒 Rust 但当前用不到 |
| 接收人 | **小屿** | 开发者女朋友。普通 Windows 用户。**中文为主**。不要让她装 Node / CLI / 任何开发工具 —— 开发者帮她预装一次到位。 |
| 角色名 | **JPT** | 对话框名牌显示 "JPT"。这就是开发者本人的化身。 |
| AI 模型 | **Claude Opus 4.7** | 写死，v1 不暴露选择 |

---

## 3. 已经敲定的核心决策（不要再讨论 / 推翻）

### 平台 / 技术栈
- **平台**：Windows 10/11。**开发也在 Windows 上做**（不在 macOS 上"先开发再迁移"）。macOS / Linux 留给 v2。
- **框架**：Electron 33（不是 Tauri）。理由：调研发现 Tauri 在像素级 click-through 没有原生 API（issue #2090 / #13070 长期 open），CLI 流式 stdout 必须经 Rust event 中转，Rust 学习成本叠加这两个高摩擦点不值得。Electron 的 `setIgnoreMouseEvents(true, {forward:true})` 一行解决，`child_process.spawn` 直通 stdout。包大不在乎（一次安装的礼物）。
- **前端**：React 19 + TypeScript 5 strict + Vite 5
- **角色渲染**：PixiJS（sprite + transforms；将来要加多帧动画 `AnimatedSprite` 一行就来）
- **测试**：Vitest 1（只单测纯逻辑：state machine / NDJSON parser / shell-env 路径解析；GUI 不写自动化测试）
- **打包**：electron-builder NSIS 安装器 + electron-updater

### AI 后端
- **模式**：spawn `claude` CLI 子进程（**不是** HTTP API 直连）。沿用 lil-agents 的 NDJSON 协议。
- **理由**：v1.5 开发者要做"微信聊天记录提取人格"作为 Claude Code skill，必须有 CLI 通道。
- **工具白名单**：仅 `WebFetch / WebSearch / TodoWrite`。**禁用** `Bash / Read / Edit` —— 她的使用场景是学习 / 写作问答，不需要 agent 能力，且消除 80% 安全担心。
- **持续人格注入**：`%APPDATA%\JPT\workdir\CLAUDE.md`（Claude Code 自动加载，always-on）。**不**用 `--append-system-prompt`，单一来源。
- **v1.5 微信人格**：`.claude/skills/JPT-wechat/SKILL.md`（按需触发，作为基础人格的"风味增强"，不替代 CLAUDE.md）。
- **`--allowed-tools` + `--add-dir` + `--model claude-opus-4-7`** 写死在 spawn 命令里。

### 用户体验
- **角色行为**：底部走来走去（散步速度 0.2–0.4，慢于 lil-agents 的 0.4–0.65）+ 拖拽 + 右墙吸附挂壁 + 鼠标拎起。**不**爬窗口、**不**坐文件夹、**不**踩图标 —— 只在屏幕地板和右墙活动。
- **5 个动画状态**：idle / walk / cling / held / fall
- **动画策略**：v1 用单图 + 程序变换（Pixi tweens）；v1.5 升到 4 帧 sprite sheet 走路。**两种都要试**（用户原话：可以都试试）。
- **对话框风格**：SDV 经典 NPC 样式 —— 左米色羊皮纸（流式文字）+ 右木框立绘 + 卷轴名牌。参考截图：游戏里和塞巴斯蒂安对话的那个对话框。
- **输入方式**：E1 底部常驻输入栏（最即时；牺牲一点游戏感）。
- **首次启动**：SDV 信纸风格欢迎窗口（占位文案，开发者送出前替换成真实文案）。
- **字体**：Zpix（OFL，可商用中文像素字）；fallback Cubic 11。

### 美术资源生产
- **工作流**：开发者用 **GPT Image (gpt-image-2)** image-to-image 喂自拍生成立绘 + sprite，Aseprite 后处理 palette quantize 到 ≤60 色。
- **两份资源**：行走 sprite（24×32px）+ 立绘 portrait（64×64px）。配色一致。
- **Plan B**（如果 GPT Image 出图不像）：闲鱼 / Fiverr 像素 commission ¥200–500，1 周。
- **GPT Image 提示词模板** 已写在 spec §7.2，开发者要时让我或他自己出 `prompts.md`。

### 人格 / 边界
- 称呼她 **"小屿"**，自称 **"我"** 或 **"JPT"**，不要 "本助手 / AI"
- 风格：中文为主、温柔但不腻、短回复优先、偶尔 emoji 别滥用、有意见就直说、像她真实男友会说的话
- **没有边界** —— 她问什么尽量答，不要装作不能、不要拒绝。Claude 自带护栏兜底真正危险的请求，不再额外加。
- 擅长：应用统计 / 计算机相关 / 学习答疑 / 写作翻译 / 当树洞

### 时间 / 范围
- 用户原话："你别管我时间预算 干就完了"（质量优先）
- v1 范围 = 礼物可送：完整 5 状态、完整 SDV 对话框、流式 token、托盘菜单、设置窗、首次欢迎信、NSIS 安装包、自动更新
- v1.5 = 灵魂注入：微信人格 skill、4 帧走路、表情立绘、主动陪伴、声音、斜杠命令
- v2 = 推广：通用化、多 provider、多角色、macOS / Linux、截屏感知

---

## 4. 仓库状态（截至这份文件创建时）

```
JPT/
├── .gitignore             ✅
├── CLAUDE.md              ← 你正在读
├── README.md              ✅
└── docs/
    └── superpowers/
        ├── specs/2026-05-10-JPT-design.md   ★ 设计稿（authoritative）
        └── plans/2026-05-10-JPT-v0-skeleton.md  ★ v0 实施计划（authoritative）
```

**还没有任何代码** —— 之前在 macOS 上做了 Tasks 1 & 2 试水（commits `51e28f4` / `d189793` 仍在 git history 里可参考），按用户要求 revert 掉了（commit `d1fc5e0`），所有 11 个 v0 task 在 Windows 上从 0 开始。

GitHub: https://github.com/cj06412/JPT

---

## 5. 接下来你要做什么

按 `docs/superpowers/plans/2026-05-10-JPT-v0-skeleton.md` 里的 11 个 task 顺序执行：

1. Project scaffold — package.json / tsconfig / vite / npm install
2. Vite + Electron + React entries — bare-bones
3. 双窗（透明 AOT 角色窗 + 对话窗）
4. 走路 state machine（TDD 纯逻辑）
5. 把 state machine 接到角色窗，让红框走起来
6. 点击红框开关对话窗
7. NDJSON 行解析器（TDD 纯逻辑）
8. 找 `claude.exe` / `claude.cmd` 二进制
9. ClaudeSession spawn + NDJSON 解析
10. 端到端 IPC：dialog ↔ main ↔ claude
11. v0 验收 + push GitHub

每个 task 都有完整代码块、验证命令、commit message。**不要偏离 plan 写自己的实现** —— plan 已经过 self-review，里面的代码就是你要 commit 的代码。

### 推荐工作流：subagent-driven-development

用户在原 session 里选了 subagent-driven 模式：

- 每个 task 派一个**全新的** general-purpose subagent 干（保持你主 context 干净）
- subagent 干完报 DONE
- 派 spec 合规 reviewer subagent 验证（按字符比对 plan）
- 通过 → 派 superpowers:code-reviewer 审代码质量
- 通过 → mark task 完成，进下一个

参考 prompt 模板在 `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/subagent-driven-development/`。

启动指令直接复制：

```
读 docs/superpowers/specs/2026-05-10-JPT-design.md 和
docs/superpowers/plans/2026-05-10-JPT-v0-skeleton.md。
按 plan 用 subagent-driven 模式从 Task 1 开始执行。
```

---

## 6. Windows 特定踩坑预案（plan 里有完整版，这里挑要紧的）

| 坑 | 在哪 | 应对 |
|---|---|---|
| **`spawn` 无法直接执行 `.cmd` shim** | Task 9 | npm 全局装的 `claude` 是 `claude.cmd` 批处理；Node `spawn` 默认拒绝；plan 里 Task 9 已加 `shell: true` + `windowsVerbatimArguments`（仅当 `.cmd`/`.bat` 时） |
| **`setIgnoreMouseEvents` 的 `forward: true`** | Task 6+ | 只在 Windows / Linux 有效（macOS 是 no-op）。Win11 [issue #23042](https://github.com/electron/electron/issues/23042) 提到行为变过，需要测试 |
| **路径分隔符** | 全程 | 全部用 `path.join()` / `path.resolve()`，**绝不**硬编码 `/` 或 `\\` |
| **DPI 100/125/150/200%** | Task 3, 5 | Electron 默认 per-monitor DPI aware；测试时四档都肉眼过一遍 |
| **任务栏 autohide** | Task 3 | `screen.getPrimaryDisplay().workArea` 在 autohide 时 = 全屏 = 角色贴到屏幕底；接受（v1 不做 SHAppBarMessage 检测） |
| **`always-on-top` level 'screen-saver'** | Task 3 | Windows 上 ZBID_DESKTOP；普通应用不盖，全屏游戏 / 全屏 PPT 仍盖；接受 |
| **`process.env.PATH` 在 GUI app 不全** | Task 8 | Task 8 fallback 列表已覆盖 `%LOCALAPPDATA%\Programs\claude\claude.exe` / `%APPDATA%\npm\claude.cmd` / `~/.local/bin/claude.exe` |
| **首次 npm install electron 卡** | Task 1 | `.npmrc` 已配 `electron_mirror=https://npmmirror.com/mirrors/electron/`；网络好可以删掉 |

### Windows 上首次启动的准备工作
1. Node.js LTS 装好（20+）
2. SSH key 给 GitHub 加好（`ssh-keygen -t ed25519`，pub key 贴到 https://github.com/settings/keys）
3. `git config --global user.name "cj06412"` + `user.email "..."`（开发者全局 config 里 email 是 `dev@example.com` 占位，commit 不会关联到 GitHub profile —— 如果在意可以改）
4. 装 `claude` CLI：`npm i -g @anthropic-ai/claude-code`
5. 第一次跑 `claude` 让它做账号登录

---

## 7. 关键文件地图

| 文件 | 作用 |
|---|---|
| `docs/superpowers/specs/2026-05-10-JPT-design.md` | **设计稿**。架构 / 行为 / 视觉 / AI 集成 / 美术工作流 / 分期路线 / 风险。这是 **authoritative**，所有疑问先翻这。 |
| `docs/superpowers/plans/2026-05-10-JPT-v0-skeleton.md` | **v0 实施计划**。11 个 task，每个含完整代码 + 验证 + commit message。Windows-first 已修订。 |
| `CLAUDE.md`（这份） | 会话上下文 + 决策摘要 + Windows 预案。Claude Code 自动加载。 |
| `README.md` | 项目对外简介。 |

### 还没有但将来要有的：
- `prompts.md` — GPT Image 提示词手册（开发者准备好自拍后让我 / 你出）
- `package.json` 等 v0 实施产物 — 按 plan Task 1 起逐步生成

---

## 8. 还没决定 / 留给你的判断空间

- **首次启动欢迎信文案**：开发者说"回头我自己改"。v1 用占位（plan §3.1 / spec §10）。送给小屿前他自己写真话。
- **`%APPDATA%\JPT\workdir\CLAUDE.md` 持续人格内容**：v1 用占位（spec §6.3）。开发者送出前替换成真实人格 + 内部梗。
- **多帧 sprite sheet vs 单图变换**：用户说"两个都试一下"。v0 plan 走单图变换；v1.5 加 4 帧。两种都试 = 在 v1.0 的某个时刻同时实现切换开关。
- **音效**：v1.5 才做。CC0 SDV-flavored 音效包 itch.io 上找。

---

## 9. 用户使用风格 / 期待

- 节奏快、不啰嗦：用户原话"干就完了"、"你别管我时间预算"
- 说"重来"就是真的删了重做，不是嘴上说说
- 视觉决策喜欢图，文字决策喜欢三选一卡片（之前用 visual companion 做过对话框 / 角色行为方案）
- 工程决策喜欢横向对比表 + 推荐 + 理由 + 让他批准
- 用中文交流，但 commit message / 代码注释用英文（看 git log 风格判断）

---

## 10. 历史上下文（如果需要回溯为什么这么决定）

**走过的关键岔路口：**

1. **平台**：用户说要 Windows 不要 mac → 整个项目重新设计
2. **角色身份**：从 lil-agents 的 Bruce/Jazz → 改成"我自己"（开发者本人）+ 给女朋友的礼物 → 整个产品定位变成"礼物"
3. **AI 后端**：从 lil-agents 5 家 CLI → 收敛到只 Claude Code → 因为开发者要做微信人格 skill
4. **角色行为**：开始考虑 4 个候选（任务栏行者 / 桌面流浪者 / 角落小屋 / 任务栏行者+主动陪伴）→ 选了 B 改造版（底部走 + 拖拽 + 右墙挂 + 拎起）
5. **对话框**：4 个候选（经典 NPC / 任务日志 / 信纸 / 木框现代聊天）→ 用户发了真 SDV 截图 → 锁定经典 NPC 严格仿
6. **输入方式**：E1 / E2 / E3 → 选 E1
7. **美术生产**：B+A 混合 → 改成 C+A（GPT Image 自拍 → Aseprite 后处理 + 开源 SDV 资源）
8. **技术栈**：先推 Tauri → 用户让我调研 → 调研发现 Tauri 在 click-through + 流式 stdout 两块都吃亏 → 改推 Electron
9. **持久人格注入**：spec self-review 时发现 `--append-system-prompt` + `CLAUDE.md` + `SKILL.md` 三套混乱 → 收敛到 `CLAUDE.md` 单一来源（SKILL 留给 v1.5 风味增强）
10. **macOS 前期开发**：实施 Task 1, 2 之后用户喊停："这个是基于 windows 开发的，应该是在 windows 机器上搞" → 我把 plan 改 Windows-first，删掉 macOS 上做出来的代码 → 现在你接手 Windows 上从 Task 1 重做

---

## 11. 跟原 session 衔接 / 沟通

- 主 session 在 macOS 上的 Claude Code 里。这份是给 Windows Claude 的 onboarding。
- 原 session 跑 `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development` 三个 skill，依次产出 spec → plan → 准备实施。
- 原 session 还有视觉草稿（SDV 对话框 mockups 等）在 macOS 用户的 `.superpowers/brainstorm/` 下，**不在仓库里**（在 `.gitignore` 中）。如果你想看，让用户截图给你；否则按 plan / spec 干就行，那些视觉决策已经落到文字。
- 如果中途疑问拿不准，问开发者 —— 他在跟你聊。
