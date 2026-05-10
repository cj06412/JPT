# JPT — Stardew Valley 风格的桌面 AI 伴侣（Windows）

| 字段 | 值 |
|---|---|
| 文档类型 | 设计稿 (Design Spec) |
| 项目代号 | JPT |
| 平台 | Windows 10 / 11 |
| 创建日期 | 2026-05-10 |
| 状态 | Draft（待用户 review） |
| 灵感来源 | [ryanstephen/lil-agents](https://github.com/ryanstephen/lil-agents)（macOS） |
| 关联文档 | `prompts.md`（GPT Image 提示词手册，实施阶段产出） |

---

## 1. 背景与定位

### 1.1 一句话定位

桌面上一个像素风的"小你"，在 Windows 任务栏上方走来走去，可以拖到右墙挂着、可以被拎起来；点击它弹出星露谷物语（Stardew Valley，下称 SDV）风格的对话框，背后是 Claude Code CLI 在跟用户聊学习和写作。**是一个开发者送给女朋友的会动的礼物，未来可能开放推广。**

### 1.2 与 lil-agents 的关系

`lil-agents` 是一个 macOS AppKit 应用：透明 HEVC 视频角色（Bruce / Jazz）走在 Dock 上方，点击弹出主题化终端，背后是本地 AI CLI（Claude / Codex / Copilot / Gemini / OpenCode）。

JPT 借鉴它的：
- `AgentSession` 协议抽象（spawn CLI + NDJSON 协议解析）
- `ShellEnvironment` 解析二进制路径的思路
- 透明 always-on-top 角色窗 + 独立 popover 对话窗的双窗结构
- 任务栏 / Dock 几何感知 + 多屏幕活跃屏检测

JPT 在它之上**重新做的**：
- 平台从 macOS → Windows（任务栏代替 Dock）
- 美术从透明 HEVC 视频 → SDV 像素 sprite + 立绘
- 开发栈从 AppKit / Swift → Electron + React + PixiJS
- AI 后端范围从 5 家 CLI 收敛到只支持 Claude Code（v1）
- 角色行为从单纯走路 → 走路 + 拖拽 + 挂壁 + 被拎
- 对话框从 lil-agents 的圆角玻璃终端 → SDV 经典 NPC 木牌对话

### 1.3 受众

| 角色 | 描述 |
|---|---|
| 开发者 | 应用统计研一在读，懂 JS/Python，初次接触 Rust/Electron 不抵触；会负责打包 + 部署到接收人电脑 |
| 接收人（"小屿"） | 开发者女朋友，普通 Windows 用户；不要求她装 Node、CLI 或任何开发工具；中文使用为主 |
| v2 推广受众 | 同样是非技术用户的礼物送出方 / 自用方；要求"双击 .exe 即用" |

### 1.4 一句话非目标

JPT **不是**一个通用 AI 助手 / SaaS / 编程工具。它是一份**特定关系下的礼物**，所有细节为这个关系服务。"通用化"留到 v2。

---

## 2. v1 / v1.5 / v2 范围

### 2.1 v1（必做，礼物可送的最小集）

| 模块 | 必做项 |
|---|---|
| **角色** | 1 个角色（"JPT"，外观是开发者本人）；5 个动画状态：idle / walk / cling / held / fall；单图 + CSS / Pixi 变换实现动画；预留多帧切换接口 |
| **窗口行为** | 透明、无边框、always-on-top；像素级 click-through；底部走来走去；拖到右墙吸附挂壁；鼠标可拎起 |
| **对话框** | SDV 经典 NPC 样式：左米色羊皮纸（流式文字）+ 右木框立绘 + 卷轴名牌；底部常驻输入栏（E1 方案） |
| **AI 后端** | spawn `claude.exe` 子进程，沿用 `lil-agents` 的 NDJSON 协议（`stream-json` in/out）；限制工具到 `WebFetch / WebSearch / TodoWrite` |
| **持久化** | 配置（角色名、用户称呼、字体大小、声音开关、自启）；对话历史按天落 JSONL |
| **打包** | `electron-builder` 出 NSIS 安装器（`JPT-Setup-1.0.0.exe`）；`electron-updater` 配通自动更新 |
| **首次运行** | SDV 信纸风格欢迎窗口（占位文案，开发者送出前替换）；引导走完最简交互 |
| **托盘** | Windows 系统托盘图标 + 菜单：和 JPT 说话 / 声音 / 字体大小 / 设置 / 检查更新 / 退出 |

### 2.2 v1.5（送出后开发者自己的迭代）

- **微信聊天记录 → SKILL.md 的人格抽取**（开发者自行实现；零代码改动，只换 `%APPDATA%\JPT\workdir\.claude\skills\JPT\SKILL.md` 文件）
- **4 帧走路 sprite sheet**（替换单图 + 变换的"走路"实现）
- **多张立绘**（默认 / 微笑 / 思考 / 困惑 共 4 张），按 `tool_use` / 完成 / 错误等事件切换
- **主动陪伴**：定时器 + 文案表（早安、喝水提醒、节日彩蛋）
- **音效**：完成音、点击音、打字音（CC0 SDV-flavored 音效包）
- **斜杠命令**：`/clear`、`/copy`、`/help`（继承 lil-agents）

### 2.3 v2（推广方向）

- 通用化：私货（角色名、用户名、欢迎信、SKILL.md）抽到首启配置
- 多 provider：OpenAI 兼容 API、DeepSeek 直连、本地 ollama
- 多角色：参考 [VPet](https://github.com/LorisYounger/VPet) 工坊
- macOS 版（Electron 跨平台一键，但要重做任务栏 → Dock 几何感知）
- 截屏感知 / 主动开口：参考 [Live2DPet](https://github.com/x380kkm/Live2DPet) 的 VLM 记忆模式

### 2.4 非功能性目标（v1 通过）

- 启动到第一帧 < 2 秒
- 内存常驻 < 200 MB
- 安装包 < 120 MB（Electron 给定值）
- 接收人机器零依赖（开发者预装 Node + Claude Code 一次到位）

---

## 3. 行为模型

### 3.1 角色状态机

```
                                    ┌──────────┐
                                    │  hidden  │  (启动前 / 退出后)
                                    └────┬─────┘
                                         │ launch
                                         ▼
                                    ┌──────────┐
                ┌──────────────────▶│   idle   │◀─────────────┐
                │                   └────┬─────┘              │
                │ random pause              │ idle ms 到时        │
                │ ms 到时                   ▼                  │
                │                   ┌──────────┐              │
                │                   │   walk   │              │
                │                   └────┬─────┘              │
                │ 走到边                  │                    │
                │ ◀─────────────────────┘                     │
                │                                              │
                │     ┌─── mousedown ────────────────────┐    │
                │     │                                   │    │
                │     ▼                                   │    │
                │  ┌──────────┐    mousemove   ┌──────────┐    │
                │  │   held   │───────────────▶│   held   │    │
                │  └────┬─────┘                └────┬─────┘    │
                │       │ mouseup                   │          │
                │       │                           │          │
                │       ▼                           │          │
                │   离右墙 < 30px ?                  │          │
                │       │                           │          │
                │       ├─── yes ──▶ ┌──────────┐   │          │
                │       │            │  cling   │───┼──── tap ──┘
                │       │            └──────────┘   │
                │       │                           │
                │       └─── no ───▶ ┌──────────┐   │
                │                    │   fall   │───┘
                │                    └────┬─────┘
                │                         │ landing squash 完成
                └─────────────────────────┘
```

- **idle**：默认 0.5–14 秒随机；偶尔抬头 / 伸懒腰（v1.5 加帧）；轻微垂直浮动（呼吸）
- **walk**：从屏幕底部一端走到另一端，速度 0.2–0.4（"散步"节奏，慢于 lil-agents）；身体微摇 + 反向脚部位移模拟走路
- **cling**：固定在屏幕右边缘，整体旋转 90°，轻微摇摆
- **held**：跟随鼠标，带轻微旋转 + 抖动
- **fall**：抛物线落到地板，落地 squash 1.4×0.6 → 1.0×1.0 回弹
- 在所有状态下，进入 **dialog open** 子状态时角色固定不动直到对话框关闭

### 3.2 用户输入交互

| 输入 | 响应 |
|---|---|
| 鼠标点击实体像素 | 切换打开 / 关闭对话框 |
| 鼠标在角色上按下并拖动 > 5px | 进入 held |
| 拖到右墙 30px 内松开 | 切到 cling |
| 拖到任意位置松开 | 切到 fall → walk |
| Escape（对话框聚焦时） | 关闭对话框 |
| 点击对话框外（屏幕其它区域） | 关闭对话框 |
| 系统托盘"和 JPT 说话" | 等同于点击角色 |

### 3.3 多屏幕 / DPI / 任务栏

- **活跃屏判定**（沿用 lil-agents 思路）：第一优先级是"屏幕 frame > visibleFrame"的屏（即任务栏在该屏上）；其次是主显示器
- **任务栏自动隐藏**：通过 `Win32.SHAppBarMessage(ABM_GETAUTOHIDEBAR)` 或 PowerShell 等价物检测；自动隐藏时角色仍贴底部（避开任务栏弹出位）
- **DPI**：Electron 自动 DPI 缩放；sprite 用 `image-rendering: pixelated` 保锐；测试 100% / 125% / 150% / 200% 四档
- **屏幕休眠 / 唤醒**：`powerMonitor` 监听 `suspend` / `resume`；唤醒后重新对齐任务栏几何
- **分辨率切换 / 接外屏**：`screen` 模块监听 `display-added` / `display-removed`；记忆角色所在屏 ID，断开就回主屏

### 3.4 像素级 click-through

实现路径：
1. 角色窗用 `setIgnoreMouseEvents(true, { forward: true })` —— 整窗鼠标透传，但事件仍 forward 给 renderer
2. Renderer 收到 `mousemove` 时，根据当前 sprite alpha map 判断像素是否实体
3. 如果实体：调用 `ipcRenderer.invoke('window:set-passthrough', false)` 让窗口"接管"鼠标
4. 如果离开实体像素：再调用 `'window:set-passthrough', true` 还回穿透
5. Sprite alpha map 在加载 sprite PNG 时一次性算出（每像素 alpha > 30/255 视为实体；阈值参考 [lil-agents `CharacterContentView.swift:43`](https://github.com/ryanstephen/lil-agents/blob/main/LilAgents/CharacterContentView.swift)）

降级方案（如果性能 / 稳定性问题）：把整个 sprite 包围盒视为可点击区域；舒适度损失轻微。

---

## 4. 视觉设计

### 4.1 对话框（锁定为 SDV 经典 NPC 样式）

参考：游戏中和塞巴斯蒂安、罗宾等 NPC 对话的对话框。

```
┌────────────────────────────────────────────────────────┐
│ [horizontally-grained warm wood frame, ~10px outline] │
│                                                        │
│  ┌────────────────────────┐  ┌──────────────────┐    │
│  │ ▸ 旧消息 (淡化)         │  │                  │    │
│  │ ▸ 旧消息 (淡化)         │  │   [立绘 64×64]   │    │
│  │                        │  │                  │    │
│  │ 最新消息 (加粗、流式)   │  │      [蓝点]      │    │
│  │                  ▾    │  │                  │    │
│  └────────────────────────┘  └──────────────────┘    │
│                              ┌──── ─────── ────┐     │
│                              │      JPT       │     │
│                              └──── ─────── ────┘     │
│  ┌────────────────────────────────────────┬──────┐   │
│  │ 说点什么…                              │  送  │   │  <- E1 输入栏
│  └────────────────────────────────────────┴──────┘   │
└────────────────────────────────────────────────────────┘
```

**关键样式参数：**
- 木框：`#a86930 → #d18646 → #b87632` 横向木纹渐变，外描边 `#3e2410`
- 米色羊皮纸：`#efc88c`，内嵌 1px 高光描边 `#f5d8a4`
- 卷轴名牌：`#d8b078`，左右各一个圆形铆钉延伸
- 像素级 box-shadow `4px 4px 0 rgba(0,0,0,0.4)` 制造"漂浮感"
- 字体：`Zpix` 中文像素字（OFL 协议，可商用）；fallback `Cubic 11`

### 4.2 美术资源规格

| 资源 | 文件 | 像素尺寸 | 实际渲染 | 数量 v1 | 数量 v1.5 |
|---|---|---|---|---|---|
| 行走 sprite | `assets/sprites/jpt-walk.png` | 24×32 | 4× = 96×128 | 1 静态 | 4 帧 sprite sheet |
| 立绘 portrait | `assets/sprites/jpt-portrait.png` | 64×64 | 4× = 256×256 | 1 默认 | 4 张表情（默认/微笑/思考/困惑） |
| 配色限制 | — | ≤ 60 色 indexed | — | — | — |
| 透明背景 | — | alpha 通道 | — | — | — |

调色板参考：[Stardew Valley palette on lospec](https://lospec.com/palette-list/stardew-valley)（约 48 色暖琥珀 + 冷蓝 + 草绿 + 木棕）

### 4.3 字体

- **Zpix（zhanyou-pixel）** — OFL 协议；中文像素字标杆；GitHub: [SolidZORO/zpix-pixel-font](https://github.com/SolidZORO/zpix-pixel-font)
- 备选 **Cubic 11** — 同 OFL 协议；GitHub: [ACh-K/Cubic-11](https://github.com/ACh-K/Cubic-11)
- 字体打包到 `assets/fonts/`；CSS 中 `@font-face` 加载

---

## 5. 架构

### 5.1 双进程双窗

```
┌─────────────────────────────────────────────────────────────┐
│ Electron Main Process (Node.js)                             │
│                                                             │
│  ├─ AppLifecycle           托盘图标 / 退出 / 自动更新         │
│  ├─ WindowManager          创建 / 销毁角色窗 + 对话窗        │
│  ├─ ScreenGeometry         任务栏检测 / DPI / 多屏           │
│  ├─ AgentSessionFactory    根据 provider 创建 session       │
│  │   └─ ClaudeSession      spawn `claude.exe` + NDJSON 解析 │
│  ├─ ConfigStore            electron-store: 设置项            │
│  └─ HistoryStore           对话历史按天 JSONL                │
│                                                             │
│  IPC 中转所有跨进程通信                                       │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│ Character Window         │      │ Dialog Window            │
│ (transparent, AOT)       │      │ (transparent, AOT)       │
│                          │      │                          │
│ React + PixiJS           │      │ React + react-markdown   │
│  ├─ SpriteRenderer       │      │  ├─ SDVFrame             │
│  ├─ StateMachine         │      │  ├─ PaperPanel (流式)    │
│  ├─ InputHandler         │      │  ├─ PortraitPanel        │
│  └─ EnvironmentTick      │      │  ├─ Nameplate            │
│      (60Hz, requestAnimation- │  └─ InputBar (E1)         │
│       Frame loop)        │      │                          │
└──────────────────────────┘      └──────────────────────────┘
```

### 5.2 IPC 协议（typed channels）

```typescript
// shared/ipc-types.ts
export interface IpcChannels {
  // Character → Main
  'character:click': void                          // 触发对话框开关
  'character:save-position': { x: number, y: number, state: CharState }
  'character:set-passthrough': boolean             // 像素级 click-through

  // Main → Character
  'character:show': void
  'character:hide': void

  // Dialog → Main
  'dialog:user-send': string                       // 用户输入消息
  'dialog:close': void
  'dialog:slash-command': '/clear' | '/copy' | '/help'

  // Main → Dialog
  'dialog:stream-token': string                    // Claude 流式 token
  'dialog:tool-use': { name: string, input: any }
  'dialog:tool-result': { summary: string, isError: boolean }
  'dialog:turn-complete': void
  'dialog:error': string

  // Settings
  'settings:get': void                             // → ConfigSnapshot
  'settings:set': Partial<ConfigSnapshot>
}
```

### 5.3 文件结构

```
JPT/
├── package.json
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/                  # Main process (Node.js)
│   │   ├── index.ts           # app.whenReady → window-manager.start()
│   │   ├── window-manager.ts  # createCharacterWindow / createDialogWindow
│   │   ├── screen-geometry.ts # 任务栏 / DPI / 活跃屏
│   │   ├── tray.ts            # 系统托盘菜单
│   │   ├── updater.ts         # electron-updater wrapper
│   │   ├── agent/
│   │   │   ├── session.ts     # AgentSession protocol
│   │   │   ├── claude.ts      # ClaudeSession (spawn + NDJSON)
│   │   │   └── shell-env.ts   # 找 claude.exe 路径
│   │   ├── config-store.ts    # electron-store wrapper
│   │   ├── history-store.ts   # JSONL append
│   │   └── ipc.ts             # IPC channel registration
│   ├── character/             # Character renderer
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── Sprite.tsx         # PixiJS wrapper
│   │   ├── StateMachine.ts    # idle/walk/cling/held/fall
│   │   ├── InputHandler.ts    # click/drag + alpha-map passthrough
│   │   └── ThinkingBubble.tsx # 头顶气泡
│   ├── dialog/                # Dialog renderer
│   │   ├── index.html
│   │   ├── App.tsx
│   │   ├── SDVFrame.tsx
│   │   ├── PaperPanel.tsx     # 米色羊皮纸 + 流式 markdown
│   │   ├── PortraitPanel.tsx
│   │   ├── Nameplate.tsx
│   │   ├── InputBar.tsx
│   │   ├── ToolUseCard.tsx    # tool_use 卷轴小卡
│   │   └── markdown.tsx       # react-markdown 配置
│   ├── settings/              # Settings window
│   │   ├── index.html
│   │   └── App.tsx
│   ├── welcome/               # 首次启动欢迎信
│   │   ├── index.html
│   │   └── App.tsx
│   └── shared/
│       ├── ipc-types.ts
│       ├── messages.ts        # AgentMessage / Role enum
│       ├── theme.ts           # SDV 配色 / 字体常量
│       └── config.ts          # ConfigSnapshot 类型
├── assets/
│   ├── sprites/
│   │   ├── jpt-walk.png       # 主 sprite（AI 生成 + Aseprite 后处理）
│   │   └── jpt-portrait.png   # 立绘
│   ├── sounds/                # v1.5 加（CC0 SDV-flavored）
│   ├── fonts/
│   │   └── zpix.ttf
│   └── icons/
│       └── tray-icon.ico
├── defaults/                  # v2 抽象时这里放可替换私货
│   ├── welcome-letter.txt
│   └── persona.md
├── docs/
│   └── superpowers/specs/
│       └── 2026-05-10-JPT-design.md  ← 本文档
└── prompts.md                 # GPT Image 提示词手册（separate gen）
```

### 5.4 关键依赖

| 包 | 版本 | 用途 |
|---|---|---|
| `electron` | ^33 | 框架 |
| `electron-builder` | ^25 | 打包 NSIS |
| `electron-updater` | ^6 | 自动更新 |
| `electron-store` | ^10 | 配置持久化 |
| `vite` | ^5 | 前端构建 |
| `vite-plugin-electron` | ^0.28 | Vite + Electron 集成 |
| `react` | ^19 | UI 框架 |
| `react-dom` | ^19 | |
| `pixi.js` | ^8 | 角色 sprite + 变换 |
| `react-markdown` | ^9 | 流式 Markdown 渲染 |
| `remark-gfm` | ^4 | Markdown GFM 扩展 |
| `@xstate/react` | ^4 | 状态机（可选） |

---

## 6. AI 集成

### 6.1 Claude CLI spawn 命令

```
claude.exe ^
  -p ^
  --output-format stream-json ^
  --input-format stream-json ^
  --verbose ^
  --dangerously-skip-permissions ^
  --allowed-tools "WebFetch,WebSearch,TodoWrite" ^
  --add-dir "%APPDATA%\JPT\workdir" ^
  --model claude-opus-4-7
```

**约束：**
- `--allowed-tools` 仅 `WebFetch / WebSearch / TodoWrite`，禁用 `Bash / Read / Edit` 等可能造成混乱或安全担心的工具
- `--add-dir` 指向用户工作目录；Claude Code 自动加载 `CLAUDE.md` 作为 always-on 系统提示
- `--model` 写死 Opus 4.7（v1 不暴露选择）
- **不使用** `--append-system-prompt` —— 持续人格统一通过 `CLAUDE.md` 注入（单一来源原则）

### 6.2 Claude 工作目录布局

```
%APPDATA%\JPT\workdir\
├── CLAUDE.md                       # ★ v1 always-on 人格（单一来源）
├── .claude\
│   └── settings.json               # Claude Code 项目级配置（v1 留空）
└── notes\                          # 让 AI 帮她记的东西可落地这
```

**v1.5 扩展（开发者送出后自己加）：**

```
%APPDATA%\JPT\workdir\
├── CLAUDE.md                       # 仍然是 always-on 基础人格
├── .claude\
│   ├── skills\
│   │   └── JPT-wechat\
│   │       ├── SKILL.md           # v1.5：微信抽取的语气样本 / 内部梗
│   │       └── references\         # 共同记忆 / 历史话题摘录
│   └── settings.json
└── notes\
```

**两层分工：**
- `CLAUDE.md` —— **always-on**，每次启动都注入 system prompt；放角色定位、关系称呼、擅长领域、风格指引等"基础人格"
- `SKILL.md` —— **按需触发**，Claude 检测到相关上下文才激活；放微信抽取的具体语气样本、梗、共同回忆等"风味增强"

v1.5 替换 / 扩展任一文件**不需要改代码**。

### 6.3 v1 `CLAUDE.md` 内容（开发者送出前最后一次定制）

```markdown
# JPT —— 小屿的男朋友的 AI 化身

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
```

### 6.4 工具调用视觉处理

`tool_use` 在对话框里渲染成 **米色卷轴小卡**，不污染主羊皮纸：

```
[羊皮纸主区]                    [立绘]
  让我查一下…
  ┌─ 🔍 在网上搜「江雪 创作背景」───┐
  │  从《唐诗鉴赏辞典》看到：         │
  │  柳宗元被贬永州时所作...         │
  └────────────────────────────────┘
  原来是这样：这首诗是他...
```

`TodoWrite`（Claude 自用进度工具）默认折叠成 `▸ 思考中...`，点开才展开。

### 6.5 上下文管理

- **每轮结束**：完整对话写入 `%APPDATA%\JPT\history\YYYY-MM-DD.jsonl`
- **会话长度**：保留最近 30 轮在 Claude 上下文里（约 30k token）；超出自动 truncate 旧的（保留 system prompt + skill）
- **`/clear`**：清空当前会话上下文（不删历史文件）
- **长期记忆**：v1 不做；v1.5 起在 `notes/memory.md` 里让 Claude 自己 `TodoWrite` 重要事

### 6.6 流式渲染节奏

- token 到达 → 立即 append 到当前消息节点
- 每 ~80ms 节流软滚动
- 空白等待 > 1.5s 没新 token：头顶气泡轮播 thinking phrase
- `type:"result"` 完成：解锁输入栏 + 完成音 + 立绘瞬切"微笑"（v1.5）

---

## 7. 美术资源生产

### 7.1 工作流

```
1. 准备 3 张开发者自拍：正面 / 半身 / 全身
2. 在 GPT Image（gpt-image-2）走 image-to-image 模式
3. 第一轮先出"立绘"（关键，决定脸像不像）
4. 立绘满意后，把 立绘+全身照 一起喂给"行走 sprite"提示词
5. 候选 4 张挑一张最像
6. Aseprite 二次处理：抠透明、palette quantize 到 ≤60 色、像素对齐
```

### 7.2 GPT Image 提示词

完整版本写在独立文件 `prompts.md` 里（实施阶段产出），核心模板：

**立绘 portrait**：
```
Stardew Valley NPC portrait of person in reference photo.
64x64 pixel art, head and shoulders, slight right angle.
Hand-drawn chunky pixels, no anti-aliasing.
~48 color warm earth palette. Solid pale blue (#c8d8e8) background.
Match hairstyle, hair color, glasses, face shape exactly.
Casual hoodie or shirt in dark navy or muted maroon.
Crisp pixel edges. Belongs in Pelican Town villagers gallery.
```

**行走 sprite**：
```
Stardew Valley walking sprite of same character as portrait.
16x32 pixel character (rendered at 4x). Front-facing, full body, idle pose.
Same color palette as portrait. Transparent background.
4 colors max for skin, 3-4 for hair, 4-6 for clothes.
Black 1px outline. Flat colors like Stardew villagers.
```

### 7.3 Plan B（如 GPT Image 出图不像）

按优先级：
1. 闲鱼 / 小红书 / Fiverr 找像素 commission（¥200–500，1 周）
2. [Pixela](https://pixelaai.com/) / [Retro Diffusion](https://www.retrodiffusion.ai/)（专做像素的 AI）
3. [LPC Universal Character Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/) 拼角色 + PS 改

### 7.4 验收 checklist

- [ ] 立绘背景：透明 / 浅蓝纯色（按使用场景）
- [ ] 立绘 64×64 实际像素（非放大模糊）
- [ ] sprite 透明背景 alpha 干净
- [ ] sprite + 立绘配色一致
- [ ] 像素边缘无反锯齿
- [ ] 总色数 ≤ 60（Aseprite Indexed 模式查）
- [ ] 没有水印 / 噪点

---

## 8. 配置与持久化

### 8.1 设置项（`config-store.ts`）

| 键 | 默认 | 类型 | 用户可改 |
|---|---|---|---|
| `claudeCliPath` | 自动检测 | string | 否（自动 / 失败时提示） |
| `characterDisplayName` | "JPT" | string | 是（设置窗口） |
| `userAddressName` | "小屿" | string | 是 |
| `personaDoc` | 占位人格内容（见 §6.3） | string (textarea，编辑时写入 `workdir/CLAUDE.md`) | 是（设置窗口"人格"标签） |
| `fontSize` | "medium" | "small" \| "medium" \| "large" | 是（托盘子菜单） |
| `soundsEnabled` | true | boolean | 是（托盘） |
| `launchAtStartup` | true | boolean | 是（设置窗口） |
| `proactiveMessages` (v1.5) | false | boolean | 是 |
| `pinnedScreenIndex` | -1 | number | 否（v1） |

### 8.2 存储位置

```
%APPDATA%\JPT\
├── config.json                 # electron-store
├── window-state.json           # 角色位置 / 状态 / 所在屏 ID
├── history\
│   ├── 2026-05-10.jsonl
│   ├── 2026-05-11.jsonl
│   └── ...
└── workdir\                    # Claude 工作目录（见 §6.2）
```

### 8.3 历史 JSONL 格式

```jsonl
{"ts":1715300000,"role":"user","text":"能讲讲柳宗元这首江雪吗？"}
{"ts":1715300012,"role":"assistant","text":"这首诗写于他被贬永州时..."}
{"ts":1715300018,"role":"toolUse","tool":"WebSearch","summary":"江雪 创作背景"}
{"ts":1715300024,"role":"toolResult","summary":"找到 5 条结果","isError":false}
```

---

## 9. 边界情况处理

| 情况 | 处理 |
|---|---|
| `claude.exe` 找不到 | 对话框显示一封 SDV 风格的"信"："JPT 生病了，需要男朋友看一下"；附加技术日志（path 检查路径）给开发者排查 |
| 网络断 | "嗯…我想想（有点慢）"气泡；超时 30s 后转为"我连不上家了，等等再试？" |
| API 余额不足 | 错误透传，包成 SDV 信展示 |
| 多显示器 | 沿用 lil-agents 活跃屏算法（含任务栏的屏幕优先） |
| 4K / 高 DPI | Electron 自带 DPI 缩放；sprite `image-rendering: pixelated` |
| 笔记本合盖 / 唤醒 | `powerMonitor` 监听 `suspend` / `resume`；恢复后重新对齐任务栏 |
| 任务栏自动隐藏 | 沿用 lil-agents `DockVisibility` 思路；`visibleFrame` vs `frame` 比较 |
| Claude 进程崩溃 | `processExit` 后弹气泡"JPT 打了个哈欠 / 重启中…"；自动重 spawn |
| 全屏游戏覆盖角色窗 | `setAlwaysOnTop(true, 'screen-saver')` 但全屏游戏仍盖（接受） |

---

## 10. 分期路线（验收标准）

### v0 — 骨架（地基日，只做不见人）
- [ ] Vite + Electron + React + TS 工程脚手架跑通
- [ ] 双窗结构：透明 AOT 角色窗 + 对话窗
- [ ] 占位红色矩形当 sprite，能在底部走来走去
- [ ] `ClaudeSession` 类，能 spawn `claude.exe`，stdin/stdout 通
- [ ] 一条静态消息端到端跑通：dialog → main → claude → dialog
- **验收**：用占位红框点开框，问 `hello` 拿到 Claude 回复

### v1.0 — 礼物可送
- [ ] AI 出立绘 + sprite，Aseprite 后处理上线
- [ ] 5 个动画状态全实现
- [ ] 拖拽 + 右墙吸附 + 像素级 click-through
- [ ] SDV 对话框 + E1 输入栏
- [ ] 流式 token + tool_use 卷轴卡片 + thinking 气泡
- [ ] 系统托盘菜单 + 设置窗口 + 首次欢迎信
- [ ] Zpix 字体集成
- [ ] 占位 `CLAUDE.md` + 占位欢迎信文案
- [ ] electron-builder 出 NSIS 安装器；electron-updater 配通
- **验收**：开发者装到接收人机器，对方从开包到第一句对话不需要解释

### v1.5 — 灵魂注入
- [ ] 微信聊天记录 → `.claude/skills/JPT-wechat/SKILL.md` 抽取流程（开发者自行）
- [ ] 4 帧走路 sprite sheet
- [ ] 4 张表情立绘切换
- [ ] 主动陪伴定时器 + 文案表
- [ ] 音效（CC0 SDV-flavored）
- [ ] `/clear` `/copy` `/help` 斜杠命令

### v2 — 推广
- 通用化、多 provider、多角色、macOS、截屏感知

---

## 11. 风险清单

| 风险 | 概率 | 缓解 |
|---|---|---|
| GPT Image 出图不像开发者 | 中 | Plan B：闲鱼定制 / 像素专用 AI / LPC 拼图 |
| Electron 像素级 click-through 在 Win11 边角 | 中 | v0 阶段端到端验证；不行降级到 sprite 包围盒矩形可点击 |
| Claude Code Windows 安装坑 | 低 | 开发者一次到位；ShellEnvironment 多路径兼容 |
| 中文像素字体协议 | 中 | Zpix / Cubic 11 都是 OFL，安全 |
| 任务栏自动隐藏 / 多屏 DPI 边角 | 中 | 沿用 lil-agents 算法；v0 多配置跑过 |
| 全屏游戏覆盖角色窗 | 低 | 接受，文档说明 |
| Claude 进程意外退出 | 低 | 自动重启 + 气泡提示 |

---

## 12. 交付清单（v1.0 送出那一刻）

- [ ] `JPT-Setup-1.0.0.exe`（NSIS 安装器，签好名）
- [ ] 桌面图标（SDV 风邮筒）
- [ ] 接收人机器装好 Node.js LTS + Claude Code CLI + Anthropic API key 写入 env
- [ ] 第一次启动看到的 SDV 信（开发者提前替换的真实文案）
- [ ] `%APPDATA%\JPT\workdir\CLAUDE.md` 真实人格 v1（替换占位）
- [ ] （可选）实体卡片："双击桌面那个邮筒"

---

## 13. v2 推广留口（v1 写法已为 v2 改造预留）

| v1 写法 | v2 改造路径 |
|---|---|
| API key 写接收人 env | 设置面板里收集 |
| `claude.exe` 路径自动检测 | 失败时弹引导窗口 |
| 占位欢迎信 / `CLAUDE.md` 内嵌私货 | 抽到 `defaults/` 下可替换文件 |
| 项目名 / 角色名硬编码（"JPT"） | 首次启动让用户填 |

---

## 14. 后续工作

1. 用户 review 本设计稿
2. 修订（如有）
3. 用 `superpowers:writing-plans` 出实施计划：把 v0 → v1.0 拆成可一步一步执行的 plan，每一步带验收标准
4. 启动 v0 骨架开发
