# JPT

> Stardew Valley 风格的 Windows 桌面 AI 伴侣。

## 这是什么

桌面任务栏上方一个像素小人,会走会站会被你拖来拖去、挂在右墙、点一下从墙上掉下来。点它弹出星露谷物语风格的木框对话框,背后是 **Claude Code CLI**(或 Codex)作为子进程在跟你聊天。每条回复都来自一个**持久人格**(`workdir/CLAUDE.md`),立绘随对话情绪切换(开心/思考/困惑/伤心)。

灵感来源:[ryanstephen/lil-agents](https://github.com/ryanstephen/lil-agents)(macOS 版)。

## 状态

✅ **v1.5 — 灵魂注入** 已完成,礼物可送阶段。

主要功能都已上线 + 实测验证:对话框流式回复、永远在线人格、5 帧距离驱动走路、4 种动作专属美术、5 表情立绘随对话切换、伤心关键词触发、新 SDV 风格对话框、首启信、性能修复(空闲 CPU < 10% / 不增长)。

## 特性

- **像素小人**(96×128 透明置顶窗,Win 任务栏上方活动)
  - 站立 2 帧呼吸(CSS 关键帧、零 React 重渲染、合成器驱动)
  - 走路 5 帧距离驱动循环(走过 N px 切一帧,脚不打滑;过渡帧上下颠 2px)
  - 拖动 / 挂右墙 / 点挂壁掉落 / 落地 / 摔回地面 —— 每种状态独立美术(`jpt-hanging`/`watching`/`droping1-2`/`landing`)
  - 站 10 秒 → 走 5 秒 自循环;空闲时 rAF 自挂起,几乎零 CPU
- **SDV 对话框**(720×246,jpt-dialog.png 框 + chatbox 输入 + send 发送)
  - 流式 token + Markdown 渲染 + SDV 风格 tool_use 卷轴卡片
  - 立绘按事件切换:发消息→思考、回复完→开心、出错→困惑、**小屿说丧气话→伤心**(整轮保持)
  - 点对话框外 / Esc / `/clear`(重启会话)/ `/copy`(复制上条) / `/help`
- **双后端 AgentManager**:`claude`(默认,人格隔离 `cwd=workdir` + `--setting-sources project,local`)/ `codex`(实验)
- **持久人格**:`%APPDATA%\jpt\workdir\CLAUDE.md`(claude)和 `codex-workdir\AGENTS.md`(codex 自动同步)。每轮必注入,从不破角色
- **托盘菜单**:开对话框 / 设置 / 检查更新 / 退出
- **设置窗**:改人格(实时落地到 CLAUDE.md 并重启会话)、声音开关、字号、主动陪伴、后端切换
- **首启欢迎信**(letter.png 信纸 + 自定义文案,关闭即上岗,标记写入不复弹)
- **NSIS 安装器** + **electron-updater** 自动更新
- **历史归档**:每天 JSONL 写入 `%APPDATA%\jpt\history\YYYY-MM-DD.jsonl`(含 user/assistant/tool_use/tool_result/error)

## 架构

```
┌──────────────────────────────────────────────────────────┐
│  Electron main process                                    │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Tray /   │  │ AgentManager │  │ ConfigStore        │  │
│  │ menus    │  │  ├ ClaudeSession (claude CLI 子进程) │  │
│  │          │  │  └ CodexBackend (codex app-server)   │  │
│  └──────────┘  └──────┬───────┘  └────────────────────┘  │
└────────────────────────┼──────────────────────────────────┘
                         │  IPC
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   character 窗         dialog 窗       settings/welcome 窗
   (透明 / 96×128)    (透明 / 720×246)    (frameless)
```

- **持续负载安全**:rAF 在 idle 时 self-suspend(setTimeout 等到下次走路),输入/对话事件 `kickRef` 唤醒,空闲 CPU 从 ~52%→~9% 一个核且 10 分钟不增长
- **崩溃自愈**:electron-store 配 `clearInvalidConfig: true` —— 坏 config 静默重置,不再 bricking
- **人格隔离**:spawn claude 时 `cwd=workdir` + `--setting-sources project,local` + `--strict-mcp-config` —— JPT 只看 `<workdir>/CLAUDE.md` 和 `<workdir>/.claude/`,绝不继承用户全局的 `~/.claude/`

## 技术栈

- **Electron 33** + **Vite 5** + **React 19** + **TypeScript 5 strict**
- **Vitest 1** —— 101 单测覆盖纯逻辑(state-machine / sprite-sheet / scheduler / config-store / slash / proactive / ndjson / physics / alpha-map / shell-env)
- **electron-store v10**(运行时配置)+ **electron-updater**(自动更新)
- **Claude Code CLI**(spawn 子进程 + NDJSON stream-json 协议;persona 隔离)/ **Codex app-server**(实验后端)
- **electron-builder**(NSIS Windows 安装器)
- 渲染:单图 + CSS transform(透明 + 软件合成,无 PixiJS;CSS 关键帧驱动空闲动画,合成器零 React 开销)

## 快速开始

```powershell
npm install
npm run dev              # 启动 Vite + Electron(开发模式)
npm test                 # 跑 101 单元测试
npm run build:installer  # 出 release\JPT-Setup-1.5.0.exe(NSIS)
```

打包前置:Windows 上若 electron-builder 缓存未填,需手动放 winCodeSign / nsis / nsis-resources 到 `%LOCALAPPDATA%\electron-builder\Cache\`(详见 `docs/v1-acceptance.md`)。

## 平台

Windows 10 / 11(v1);macOS / Linux 留给 v2。

## 运行时数据布局

```
%APPDATA%\jpt\
├── config.json                          # electron-store 配置(损坏自愈)
├── workdir\
│   ├── CLAUDE.md                        # claude 后端的永远在线人格
│   └── .claude\skills\<name>\SKILL.md   # 项目级 skill(按需触发的风味增强)
├── codex-workdir\
│   └── AGENTS.md                        # codex 后端人格(由 CLAUDE.md 自动同步)
├── history\YYYY-MM-DD.jsonl             # 按日归档对话
└── .first-run-shown                     # 首启欢迎信写入后不复弹
```

## 文档

- 📐 [设计稿(spec)](docs/superpowers/specs/2026-05-10-JPT-design.md)
- 🗺️ v1.5 计划与验收:`docs/superpowers/plans/2026-05-15-JPT-v1.5.md`、`docs/v1.5-acceptance.md`、`docs/v1.5-stage{1,2,3}-acceptance.md`
- 🎨 美术提示词手册:[`prompts.md`](prompts.md)(GPT-Image 5 帧走路 / 立绘 / Aseprite 后处理)
- 💬 微信人格抽取:[`docs/wechat-persona-guide.md`](docs/wechat-persona-guide.md)

## License

私人项目,暂不开放许可证。
