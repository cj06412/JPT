# JPT v0 骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 JPT 的"地基"搭起来 —— 一个透明、置顶、无边框的角色窗口（占位红色矩形）在屏幕底部走来走去；点击它能弹出对话窗口；输入 hello 能调起本机的 `claude` CLI 拿到一段流式回复并渲染。

**Architecture:** Electron 主进程 + 两个独立 BrowserWindow（角色窗 / 对话窗）。React 前端通过 Vite 构建 ESM 模块。`ClaudeSession` 类用 Node 的 `child_process.spawn` 调起 `claude` CLI，按行解析 NDJSON 协议（沿用 lil-agents 的 `ClaudeSession.swift`）。所有跨进程通信走类型化的 IPC channels。本阶段不打包，只在 dev 模式跑通。

**Tech Stack:**
- Electron 33（桌面运行时）
- Vite 5 + `vite-plugin-electron` 0.28（前端 / 主进程构建）
- React 19 + TypeScript 5 strict mode
- Vitest 1（单元测试，纯逻辑）
- Node.js 20+（Windows installer 默认 LTS）
- `claude` CLI（Anthropic Claude Code，Windows 上安装：`npm i -g @anthropic-ai/claude-code` 或 `curl -fsSL https://claude.ai/install.sh | sh` 的 Windows 等价 PowerShell 命令）

**参考实现：** [ryanstephen/lil-agents](https://github.com/ryanstephen/lil-agents) 的 [ClaudeSession.swift](https://github.com/ryanstephen/lil-agents/blob/main/LilAgents/ClaudeSession.swift)、[AgentSession.swift](https://github.com/ryanstephen/lil-agents/blob/main/LilAgents/AgentSession.swift)、[ShellEnvironment.swift](https://github.com/ryanstephen/lil-agents/blob/main/LilAgents/ShellEnvironment.swift)。

**开发平台：Windows 10 / 11**。所有透明 AOT 窗口、任务栏几何、`claude.cmd` 路径解析都在 Windows 原生测试。终端用 PowerShell 或 Windows Terminal。macOS / Linux 支持留到 v2。

> **注**：Tasks 1 & 2 的代码（package.json / tsconfig / vite.config / electron entries）是跨平台的，已经在 macOS 上写好提交了（commits `51e28f4`、`d189793`）。在 Windows 上 `git pull` + `npm install` 后 `npm run dev` 应该直接能跑出"800×600 红色矩形"。如果 OK，Tasks 1 & 2 的 Windows 验收同时完成，从 Task 3 接着做。

---

## 文件结构（v0 终态）

```
JPT/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── electron/
│   ├── main.ts                  # 主进程入口
│   ├── preload.ts               # 共用 preload（暴露 ipcRenderer）
│   ├── window-manager.ts        # 创建 / 销毁角色窗 + 对话窗
│   └── agent/
│       ├── session.ts           # AgentSession 接口
│       ├── claude.ts            # ClaudeSession (spawn + NDJSON)
│       ├── ndjson.ts            # 纯函数：行流 → JSON 对象流
│       └── shell-env.ts         # 找 claude 二进制路径
├── src/
│   ├── shared/
│   │   ├── ipc.ts               # IPC channel 名 + payload 类型
│   │   └── messages.ts          # AgentMessage / Role
│   ├── character/
│   │   ├── index.html
│   │   ├── main.tsx             # React 入口
│   │   ├── App.tsx              # 占位红框 + 走路 tick
│   │   └── state-machine.ts     # 纯函数：tick(state, dt) → state
│   └── dialog/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx              # 输入栏 + 消息列表（无 SDV 样式）
└── tests/
    ├── ndjson.test.ts
    ├── state-machine.test.ts
    └── shell-env.test.ts
```

**职责划分：**
- `electron/` 跑在主进程（Node 上下文，可访问 `child_process` / `BrowserWindow`）
- `src/character/` 和 `src/dialog/` 跑在两个不同的 renderer 进程（浏览器上下文）
- `src/shared/` 是两边都引用的纯类型 / 常量
- `tests/` 是 Vitest 跑的纯逻辑单测，不需要 Electron 运行时

---

## Windows 踩坑预案（开始前过一遍，避免后面 debug 没头绪）

| 坑 | 出在哪 | 预防 |
|---|---|---|
| **`spawn` `.cmd` shim 失败 / 挂死** | Task 9：`claude` 通过 npm 全局装时 `%APPDATA%\npm\claude.cmd` 是个 batch 脚本；Node `spawn` 默认拒绝直接运行 `.cmd` | Task 9 已为 `.cmd`/`.bat` 加 `shell: true` + `windowsVerbatimArguments` |
| **`setIgnoreMouseEvents` 的 `forward: true`** | Task 6+ 像素级 click-through | `forward: true` **只在 Windows / Linux 有用**，macOS 上是 no-op；Windows 上 [issue #23042](https://github.com/electron/electron/issues/23042) 提到版本 6.1.9+ 行为变过，需要测试 |
| **任务栏自动隐藏 / 居中（Win11）** | Task 3, 5：任务栏几何 | `screen.getPrimaryDisplay().workArea` 已经把任务栏占的高度从 workArea 里减掉了，所以"贴底"逻辑在 Win11 上和老 Windows 一致；但任务栏 autohide 时 workArea = full screen，角色会贴到屏幕底；这是可接受的（v1 再做 SHAppBarMessage 检测） |
| **`always-on-top` 'screen-saver' level** | Task 3：透明角色窗 | Windows 上 'screen-saver' 是 ZBID_DESKTOP；普通应用不会盖，但全屏游戏 / 全屏 PPT 会盖；接受 |
| **DPI 缩放（100% / 125% / 150% / 200%）** | Task 3, 5：窗口位置和大小 | Electron 默认 per-monitor DPI aware；测试时四档都过一遍肉眼看 |
| **路径分隔符** | 所有用到路径的地方 | 全程用 `path.join()` / `path.resolve()`，**不要硬编码 `/` 或 `\\`** |
| **HiDPI 鼠标坐标** | Task 5+ | Electron `screen.getCursorScreenPoint()` 返回 DIP 坐标；`win.setPosition(x, y)` 也是 DIP；不需要乘 scale |
| **claude.cmd 路径不在 PATH** | Task 8 | npm 全局 bin 目录有时不在 SYSTEM PATH（只在 USER PATH）；`process.env.PATH` 在 GUI app 里可能拿不到完整 PATH；Task 8 fallback 列表已覆盖常见位置 |
| **首次 `npm install electron` 卡** | Task 1 | `.npmrc` 已配 `electron_mirror=https://npmmirror.com/mirrors/electron/`；如果你网络好可以删掉这一行直接走 GitHub Releases |

**SSH key for GitHub on Windows：** 如果 Windows 机器还没生成 SSH key，先：
```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
# 把 ~/.ssh/id_ed25519.pub 内容贴到 https://github.com/settings/keys
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `.npmrc`

- [ ] **Step 1.1: Create package.json**

All commands assume current directory is JPT repo root (e.g. `C:\Users\<you>\Code\JPT`). On Windows use PowerShell or Windows Terminal.

Create `package.json`:

```json
{
  "name": "jpt",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^33.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 1.2: Create .npmrc to pin Electron download**

Create `.npmrc`:

```
electron_mirror=https://npmmirror.com/mirrors/electron/
```

> 在国内 npm install electron 经常被 GitHub Releases 限速。这一行让 npm 从 npmmirror 下二进制。如果用的是其他网络环境也可以删掉这个文件。

- [ ] **Step 1.3: Create tsconfig.json (renderer side, strict)**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "types": ["vite/client", "node"],
    "paths": {
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src", "electron", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 1.4: Create tsconfig.node.json (build tooling)**

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 1.5: Install dependencies**

Run:
```bash
npm install
```

Expected: completes without errors, creates `node_modules/` and `package-lock.json`. May take 30s-2min for first Electron download.

- [ ] **Step 1.6: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json .npmrc
git commit -m "chore: scaffold electron + react + ts project"
```

---

## Task 2: Vite config + Vitest config + bare-bones entries

**Files:**
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/character/index.html`
- Create: `src/character/main.tsx`
- Create: `src/character/App.tsx`
- Create: `src/dialog/index.html`
- Create: `src/dialog/main.tsx`
- Create: `src/dialog/App.tsx`

- [ ] **Step 2.1: Vite config with electron plugin**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    rollupOptions: {
      input: {
        character: path.resolve(__dirname, 'src/character/index.html'),
        dialog: path.resolve(__dirname, 'src/dialog/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
```

- [ ] **Step 2.2: Vitest config (uses Vite config)**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
})
```

- [ ] **Step 2.3: Bare-bones electron main**

Create `electron/main.ts`:

```ts
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

function createBootstrapWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(`${VITE_DEV_SERVER_URL}/src/character/index.html`)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'src/character/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  createBootstrapWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Step 2.4: Empty preload (we'll wire IPC later)**

Create `electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('jpt', {
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrapped = (_: unknown, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.off(channel, wrapped)
  },
})
```

- [ ] **Step 2.5: Character entry HTML + bootstrap**

Create `src/character/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>JPT — Character</title>
  <style>
    html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

Create `src/character/main.tsx`:

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
```

Create `src/character/App.tsx`:

```tsx
import React from 'react'

export function App() {
  return (
    <div
      style={{
        width: 96,
        height: 128,
        background: 'red',
        position: 'absolute',
        left: 0,
        top: 0,
      }}
    />
  )
}
```

- [ ] **Step 2.6: Dialog entry HTML + bootstrap**

Create `src/dialog/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>JPT — Dialog</title>
  <style>
    html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; }
    body { background: #efc88c; font-family: -apple-system, system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

Create `src/dialog/main.tsx`:

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const root = createRoot(document.getElementById('root')!)
root.render(<App />)
```

Create `src/dialog/App.tsx`:

```tsx
import React from 'react'

export function App() {
  return <div style={{ padding: 16 }}>Dialog placeholder</div>
}
```

- [ ] **Step 2.7: Run dev to verify Electron boots**

Run:
```bash
npm run dev
```

Expected: A 800×600 window opens showing a red square in the top-left corner. Close it (Alt+F4 on the window, or Ctrl+C in the terminal where `npm run dev` is running) to end the test.

- [ ] **Step 2.8: Commit**

```bash
git add vite.config.ts vitest.config.ts electron src
git commit -m "feat: vite + electron bootstrap with placeholder character window"
```

---

## Task 3: Two-window architecture (transparent, AOT, frameless)

**Files:**
- Create: `electron/window-manager.ts`
- Modify: `electron/main.ts`

- [ ] **Step 3.1: Window manager with two windows**

Create `electron/window-manager.ts`:

```ts
import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(__dirname, '..', 'dist')

const PRELOAD_PATH = path.join(__dirname, 'preload.js')

export interface JPTWindows {
  character: BrowserWindow
  dialog: BrowserWindow
}

export function createWindows(): JPTWindows {
  const character = createCharacterWindow()
  const dialog = createDialogWindow()
  return { character, dialog }
}

function createCharacterWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { workArea } = display

  const win = new BrowserWindow({
    width: 96,
    height: 128,
    x: workArea.x + 100,
    y: workArea.y + workArea.height - 128,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 'screen-saver' level keeps character above almost everything
  // (real fullscreen apps still cover it — accepted tradeoff)
  win.setAlwaysOnTop(true, 'screen-saver')

  loadRenderer(win, 'character')
  return win
}

function createDialogWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 720,
    height: 360,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false, // hidden until character is clicked
    resizable: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  loadRenderer(win, 'dialog')
  return win
}

function loadRenderer(win: BrowserWindow, name: 'character' | 'dialog') {
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(`${VITE_DEV_SERVER_URL}/src/${name}/index.html`)
  } else {
    win.loadFile(path.join(RENDERER_DIST, `src/${name}/index.html`))
  }
}
```

- [ ] **Step 3.2: Wire main.ts to use WindowManager**

Replace `electron/main.ts`:

```ts
import { app } from 'electron'
import { createWindows, JPTWindows } from './window-manager'

let windows: JPTWindows | null = null

app.whenReady().then(() => {
  windows = createWindows()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  windows?.character.destroy()
  windows?.dialog.destroy()
})
```

- [ ] **Step 3.3: Run dev and verify both windows**

Run:
```bash
npm run dev
```

Expected:
- A small (96×128) red square appears at the bottom-left of the primary display, **above** the dock/taskbar
- The window has no title bar or frame
- The dialog window is invisible (hidden)
- Press Alt+F4 on the window, or Ctrl+C in the terminal, to quit

- [ ] **Step 3.4: Commit**

```bash
git add electron/main.ts electron/window-manager.ts
git commit -m "feat: two-window architecture (transparent AOT character + hidden dialog)"
```

---

## Task 4: Walking state machine (pure logic, TDD)

**Files:**
- Create: `tests/state-machine.test.ts`
- Create: `src/character/state-machine.ts`

- [ ] **Step 4.1: Write failing tests**

Create `tests/state-machine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tick, initialState, CharState } from '../src/character/state-machine'

describe('state-machine', () => {
  it('starts in idle facing right', () => {
    const s = initialState()
    expect(s.mode).toBe('idle')
    expect(s.facing).toBe(1)
  })

  it('idle transitions to walk after pause expires', () => {
    const s0 = { ...initialState(), pauseUntilMs: 100 }
    const s1 = tick(s0, { now: 50, dt: 16, leftBound: 0, rightBound: 1000 })
    expect(s1.mode).toBe('idle')
    const s2 = tick(s0, { now: 150, dt: 16, leftBound: 0, rightBound: 1000 })
    expect(s2.mode).toBe('walk')
  })

  it('walk advances x by speed * dt in facing direction', () => {
    const s: CharState = {
      mode: 'walk',
      x: 100,
      facing: 1,
      pauseUntilMs: 0,
      speed: 0.05, // px per ms
    }
    const next = tick(s, { now: 1000, dt: 100, leftBound: 0, rightBound: 1000 })
    expect(next.x).toBeCloseTo(105, 5)
  })

  it('walk reverses facing at right bound', () => {
    const s: CharState = {
      mode: 'walk',
      x: 990,
      facing: 1,
      pauseUntilMs: 0,
      speed: 0.05,
    }
    const next = tick(s, { now: 1000, dt: 1000, leftBound: 0, rightBound: 1000 })
    expect(next.facing).toBe(-1)
    expect(next.mode).toBe('idle')
  })

  it('walk reverses facing at left bound', () => {
    const s: CharState = {
      mode: 'walk',
      x: 10,
      facing: -1,
      pauseUntilMs: 0,
      speed: 0.05,
    }
    const next = tick(s, { now: 1000, dt: 1000, leftBound: 0, rightBound: 1000 })
    expect(next.facing).toBe(1)
    expect(next.mode).toBe('idle')
  })
})
```

- [ ] **Step 4.2: Run test, verify failure**

Run:
```bash
npm test -- state-machine
```

Expected: tests fail because `src/character/state-machine.ts` doesn't exist yet.

- [ ] **Step 4.3: Implement state machine**

Create `src/character/state-machine.ts`:

```ts
export type CharMode = 'idle' | 'walk'

export interface CharState {
  mode: CharMode
  x: number              // pixel position
  facing: 1 | -1         // 1 = right, -1 = left
  pauseUntilMs: number   // monotonic timestamp; idle ends when now >= pauseUntilMs
  speed: number          // px per ms (0.05 ≈ 50 px/sec, "散步" 节奏)
}

export interface TickInput {
  now: number            // monotonic ms (performance.now())
  dt: number             // ms since last tick
  leftBound: number      // walking floor left edge
  rightBound: number     // walking floor right edge
}

export function initialState(): CharState {
  return {
    mode: 'idle',
    x: 0,
    facing: 1,
    pauseUntilMs: 0,
    speed: 0.05,
  }
}

export function tick(state: CharState, input: TickInput): CharState {
  if (state.mode === 'idle') {
    if (input.now >= state.pauseUntilMs) {
      return { ...state, mode: 'walk' }
    }
    return state
  }

  // mode === 'walk'
  const nextX = state.x + state.facing * state.speed * input.dt

  if (state.facing === 1 && nextX >= input.rightBound) {
    return {
      ...state,
      mode: 'idle',
      x: input.rightBound,
      facing: -1,
      pauseUntilMs: input.now + randomPauseMs(),
    }
  }
  if (state.facing === -1 && nextX <= input.leftBound) {
    return {
      ...state,
      mode: 'idle',
      x: input.leftBound,
      facing: 1,
      pauseUntilMs: input.now + randomPauseMs(),
    }
  }

  return { ...state, x: nextX }
}

function randomPauseMs(): number {
  // 0.5–14s 随机停顿，避免规律性
  return 500 + Math.random() * 13_500
}
```

- [ ] **Step 4.4: Run test, verify pass**

Run:
```bash
npm test -- state-machine
```

Expected: all 5 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add src/character/state-machine.ts tests/state-machine.test.ts
git commit -m "feat(character): walking state machine (idle/walk + bounce off bounds)"
```

---

## Task 5: Wire state machine into character window

**Files:**
- Modify: `src/character/App.tsx`
- Create: `electron/ipc.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`

- [ ] **Step 5.1: Define IPC channels for character → main position update**

Create `electron/ipc.ts`:

```ts
import { ipcMain, BrowserWindow } from 'electron'
import { JPTWindows } from './window-manager'

export function registerIpcHandlers(windows: JPTWindows) {
  // Character window asks main to move it
  ipcMain.on('character:set-position', (_event, x: number, y: number) => {
    windows.character.setPosition(Math.round(x), Math.round(y))
  })

  // Character window asks main for its bounds (screen geometry)
  ipcMain.handle('character:get-walk-bounds', () => {
    const { screen } = require('electron') as typeof import('electron')
    const display = screen.getPrimaryDisplay()
    const { workArea } = display
    return {
      leftBound: workArea.x,
      rightBound: workArea.x + workArea.width - 96, // 96 = char width
      floorY: workArea.y + workArea.height - 128,    // 128 = char height
    }
  })
}
```

- [ ] **Step 5.2: Hook IPC registration into main**

Replace `electron/main.ts`:

```ts
import { app } from 'electron'
import { createWindows, JPTWindows } from './window-manager'
import { registerIpcHandlers } from './ipc'

let windows: JPTWindows | null = null

app.whenReady().then(() => {
  windows = createWindows()
  registerIpcHandlers(windows)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  windows?.character.destroy()
  windows?.dialog.destroy()
})
```

- [ ] **Step 5.3: Type the global preload bridge**

Create `src/shared/preload-types.d.ts`:

```ts
declare global {
  interface Window {
    jpt: {
      send: (channel: string, ...args: unknown[]) => void
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    }
  }
}

export {}
```

Modify `tsconfig.json` to include this typing — already covered by `"include": ["src", ...]`. No edit needed.

- [ ] **Step 5.4: Animate character window via tick loop**

Replace `src/character/App.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react'
import { initialState, tick, CharState } from './state-machine'
import '@shared/preload-types'

interface WalkBounds {
  leftBound: number
  rightBound: number
  floorY: number
}

export function App() {
  const [state, setState] = useState<CharState>(() => initialState())
  const stateRef = useRef(state)
  const boundsRef = useRef<WalkBounds | null>(null)
  stateRef.current = state

  useEffect(() => {
    let mounted = true
    window.jpt
      .invoke<WalkBounds>('character:get-walk-bounds')
      .then((b) => {
        if (!mounted) return
        boundsRef.current = b
        // Initialize x at left edge
        setState((s) => ({ ...s, x: b.leftBound }))
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const bounds = boundsRef.current
      if (bounds) {
        const next = tick(stateRef.current, {
          now,
          dt,
          leftBound: bounds.leftBound,
          rightBound: bounds.rightBound,
        })
        if (next !== stateRef.current) {
          setState(next)
          window.jpt.send('character:set-position', next.x, bounds.floorY)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        width: 96,
        height: 128,
        background: 'red',
        transform: `scaleX(${state.facing})`,
        transformOrigin: 'center',
      }}
    />
  )
}
```

- [ ] **Step 5.5: Run dev, verify red square walks**

Run:
```bash
npm run dev
```

Expected: red square slides slowly along the bottom of the primary display, hits the right edge, pauses, reverses, walks back. Pause times are random 0.5–14s. Quit with Ctrl+C in terminal.

- [ ] **Step 5.6: Commit**

```bash
git add electron/ipc.ts electron/main.ts src/character/App.tsx src/shared/preload-types.d.ts
git commit -m "feat(character): walking animation driven by raf tick loop"
```

---

## Task 6: Click character → toggle dialog window

**Files:**
- Modify: `electron/window-manager.ts`
- Modify: `electron/ipc.ts`
- Modify: `src/character/App.tsx`

- [ ] **Step 6.1: Make character window focusable for clicks**

Modify `electron/window-manager.ts` — change the `focusable: false` to `focusable: true` on the character window:

In `createCharacterWindow()`, change:
```ts
    focusable: false,
```
to:
```ts
    focusable: true,
```

- [ ] **Step 6.2: Add show/hide IPC handlers + position dialog**

Modify `electron/ipc.ts` — add inside `registerIpcHandlers`:

```ts
  // Character clicked → toggle dialog visibility
  ipcMain.on('character:click', () => {
    if (windows.dialog.isVisible()) {
      windows.dialog.hide()
    } else {
      // Position dialog above-and-to-the-right of character
      const charBounds = windows.character.getBounds()
      const { screen } = require('electron') as typeof import('electron')
      const { workArea } = screen.getPrimaryDisplay()
      const dialogW = 720
      const dialogH = 360
      let x = charBounds.x + charBounds.width + 10
      let y = charBounds.y - dialogH + charBounds.height
      // Keep on-screen
      if (x + dialogW > workArea.x + workArea.width) {
        x = charBounds.x - dialogW - 10
      }
      if (y < workArea.y) {
        y = workArea.y
      }
      windows.dialog.setBounds({ x, y, width: dialogW, height: dialogH })
      windows.dialog.show()
      windows.dialog.focus()
    }
  })

  // Dialog requests close (Esc / outside click)
  ipcMain.on('dialog:close', () => {
    windows.dialog.hide()
  })
```

The full `electron/ipc.ts` should now be:

```ts
import { ipcMain } from 'electron'
import { JPTWindows } from './window-manager'

export function registerIpcHandlers(windows: JPTWindows) {
  ipcMain.on('character:set-position', (_event, x: number, y: number) => {
    windows.character.setPosition(Math.round(x), Math.round(y))
  })

  ipcMain.handle('character:get-walk-bounds', () => {
    const { screen } = require('electron') as typeof import('electron')
    const display = screen.getPrimaryDisplay()
    const { workArea } = display
    return {
      leftBound: workArea.x,
      rightBound: workArea.x + workArea.width - 96,
      floorY: workArea.y + workArea.height - 128,
    }
  })

  ipcMain.on('character:click', () => {
    if (windows.dialog.isVisible()) {
      windows.dialog.hide()
      return
    }
    const charBounds = windows.character.getBounds()
    const { screen } = require('electron') as typeof import('electron')
    const { workArea } = screen.getPrimaryDisplay()
    const dialogW = 720
    const dialogH = 360
    let x = charBounds.x + charBounds.width + 10
    let y = charBounds.y - dialogH + charBounds.height
    if (x + dialogW > workArea.x + workArea.width) {
      x = charBounds.x - dialogW - 10
    }
    if (y < workArea.y) {
      y = workArea.y
    }
    windows.dialog.setBounds({ x, y, width: dialogW, height: dialogH })
    windows.dialog.show()
    windows.dialog.focus()
  })

  ipcMain.on('dialog:close', () => {
    windows.dialog.hide()
  })
}
```

- [ ] **Step 6.3: Click handler in character renderer**

Modify `src/character/App.tsx` — add `onClick` to the rendered div:

Change the return statement from:
```tsx
  return (
    <div
      style={{
        width: 96,
        height: 128,
        background: 'red',
        transform: `scaleX(${state.facing})`,
        transformOrigin: 'center',
      }}
    />
  )
```
to:
```tsx
  return (
    <div
      style={{
        width: 96,
        height: 128,
        background: 'red',
        transform: `scaleX(${state.facing})`,
        transformOrigin: 'center',
        cursor: 'pointer',
      }}
      onClick={() => window.jpt.send('character:click')}
    />
  )
```

- [ ] **Step 6.4: Esc closes dialog (renderer side)**

Modify `src/dialog/App.tsx`:

```tsx
import React, { useEffect } from 'react'
import '@shared/preload-types'

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.jpt.send('dialog:close')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return <div style={{ padding: 16 }}>Dialog placeholder — Esc 关闭</div>
}
```

- [ ] **Step 6.5: Run dev and verify click toggles dialog**

Run:
```bash
npm run dev
```

Expected:
- Red square walks
- Click on red square → 720×360 beige dialog window appears next to it
- Click on red square again → dialog hides
- Press Esc while dialog is focused → dialog hides

- [ ] **Step 6.6: Commit**

```bash
git add electron/window-manager.ts electron/ipc.ts src/character/App.tsx src/dialog/App.tsx
git commit -m "feat: click character to toggle dialog window"
```

---

## Task 7: NDJSON line parser (pure logic, TDD)

**Files:**
- Create: `tests/ndjson.test.ts`
- Create: `electron/agent/ndjson.ts`

- [ ] **Step 7.1: Write failing tests**

Create `tests/ndjson.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { NdjsonBuffer } from '../electron/agent/ndjson'

describe('NdjsonBuffer', () => {
  it('emits a single JSON object on a complete line', () => {
    const buf = new NdjsonBuffer()
    const out = buf.append('{"type":"hello"}\n')
    expect(out).toEqual([{ type: 'hello' }])
  })

  it('buffers a partial line until newline arrives', () => {
    const buf = new NdjsonBuffer()
    expect(buf.append('{"type":"hel')).toEqual([])
    expect(buf.append('lo"}\n')).toEqual([{ type: 'hello' }])
  })

  it('emits multiple objects from a chunk with multiple newlines', () => {
    const buf = new NdjsonBuffer()
    const out = buf.append('{"a":1}\n{"b":2}\n{"c":3}\n')
    expect(out).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })

  it('skips empty lines silently', () => {
    const buf = new NdjsonBuffer()
    const out = buf.append('{"a":1}\n\n{"b":2}\n')
    expect(out).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('throws on malformed JSON in a complete line', () => {
    const buf = new NdjsonBuffer()
    expect(() => buf.append('{not json}\n')).toThrow()
  })

  it('handles a chunk that completes one line and starts another', () => {
    const buf = new NdjsonBuffer()
    expect(buf.append('{"a":1}')).toEqual([])
    expect(buf.append('\n{"b":2')).toEqual([{ a: 1 }])
    expect(buf.append('}\n')).toEqual([{ b: 2 }])
  })
})
```

- [ ] **Step 7.2: Run tests, verify failure**

Run:
```bash
npm test -- ndjson
```

Expected: tests fail because `electron/agent/ndjson.ts` doesn't exist.

- [ ] **Step 7.3: Implement NdjsonBuffer**

Create `electron/agent/ndjson.ts`:

```ts
/**
 * Stateful line buffer for NDJSON streams.
 *
 * Claude CLI emits one JSON object per line on stdout. Our `child_process`
 * 'data' events arrive as arbitrary chunks (sometimes mid-line). This buffer
 * accumulates partial lines until a newline arrives, then parses each
 * complete line as JSON.
 *
 * Mirrors the `lineBuffer` + `processOutput` pattern in lil-agents'
 * ClaudeSession.swift:159-168.
 */
export class NdjsonBuffer {
  private buf = ''

  append(chunk: string): unknown[] {
    this.buf += chunk
    const out: unknown[] = []
    let nl: number
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).trim()
      this.buf = this.buf.slice(nl + 1)
      if (line.length === 0) continue
      out.push(JSON.parse(line))
    }
    return out
  }
}
```

- [ ] **Step 7.4: Run tests, verify pass**

Run:
```bash
npm test -- ndjson
```

Expected: all 6 tests pass.

- [ ] **Step 7.5: Commit**

```bash
git add electron/agent/ndjson.ts tests/ndjson.test.ts
git commit -m "feat(agent): NdjsonBuffer for streaming line-delimited JSON"
```

---

## Task 8: Find `claude` binary (cross-platform shell env)

**Files:**
- Create: `tests/shell-env.test.ts`
- Create: `electron/agent/shell-env.ts`

- [ ] **Step 8.1: Write failing tests**

Create `tests/shell-env.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findBinaryInPaths } from '../electron/agent/shell-env'
import * as fs from 'node:fs'

vi.mock('node:fs')

describe('findBinaryInPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the first existing path', () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => p === '/usr/local/bin/claude'
    )
    const result = findBinaryInPaths('claude', [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      '/Users/x/.local/bin/claude',
    ])
    expect(result).toBe('/usr/local/bin/claude')
  })

  it('returns null if no path matches', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = findBinaryInPaths('claude', [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ])
    expect(result).toBeNull()
  })

  it('returns the earliest match in the input array', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true) // every path exists
    const result = findBinaryInPaths('claude', [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ])
    expect(result).toBe('/opt/homebrew/bin/claude')
  })
})
```

- [ ] **Step 8.2: Run tests, verify failure**

Run:
```bash
npm test -- shell-env
```

Expected: tests fail (module doesn't exist).

- [ ] **Step 8.3: Implement shell-env**

Create `electron/agent/shell-env.ts`:

```ts
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Pure helper: find the first existing executable path from a candidate list.
 * Easier to test than the full PATH-aware resolver below.
 */
export function findBinaryInPaths(
  _name: string,
  candidates: string[]
): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Resolve `claude` binary path.
 *
 * On Windows: .cmd shim from npm global, or installer location.
 * On macOS / Linux: ~/.local/bin (Claude installer), or homebrew, or npm global.
 *
 * Mirrors lil-agents' ShellEnvironment.swift findBinary fallbacks.
 */
export function resolveClaudePath(): string | null {
  const home = os.homedir()
  const isWindows = process.platform === 'win32'

  const candidates: string[] = isWindows
    ? [
        path.join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        path.join(home, '.local', 'bin', 'claude.exe'),
      ]
    : [
        path.join(home, '.local', 'bin', 'claude'),
        path.join(home, '.claude', 'local', 'bin', 'claude'),
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
      ]

  const direct = findBinaryInPaths('claude', candidates)
  if (direct) return direct

  // Fallback: scan PATH from current process env
  const pathVar = process.env.PATH || ''
  const sep = isWindows ? ';' : ':'
  const ext = isWindows ? '.exe' : ''
  const pathDirs = pathVar.split(sep).filter(Boolean)
  for (const dir of pathDirs) {
    const candidate = path.join(dir, `claude${ext}`)
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}
```

- [ ] **Step 8.4: Run tests, verify pass**

Run:
```bash
npm test -- shell-env
```

Expected: all 3 tests pass.

- [ ] **Step 8.5: Commit**

```bash
git add electron/agent/shell-env.ts tests/shell-env.test.ts
git commit -m "feat(agent): resolveClaudePath with cross-platform fallbacks"
```

---

## Task 9: AgentSession protocol + ClaudeSession (spawn + parse)

**Files:**
- Create: `src/shared/messages.ts`
- Create: `electron/agent/session.ts`
- Create: `electron/agent/claude.ts`

- [ ] **Step 9.1: Shared message types**

Create `src/shared/messages.ts`:

```ts
export type AgentRole = 'user' | 'assistant' | 'error' | 'toolUse' | 'toolResult'

export interface AgentMessage {
  role: AgentRole
  text: string
}
```

- [ ] **Step 9.2: AgentSession interface**

Create `electron/agent/session.ts`:

```ts
import type { AgentMessage } from '../../src/shared/messages'

export interface AgentSessionCallbacks {
  onText: (chunk: string) => void
  onError: (msg: string) => void
  onSessionReady: () => void
  onTurnComplete: () => void
  onProcessExit: () => void
}

export interface AgentSession {
  isRunning(): boolean
  isBusy(): boolean
  history(): AgentMessage[]
  start(): Promise<void>
  send(message: string): void
  terminate(): void
  setCallbacks(cb: Partial<AgentSessionCallbacks>): void
}
```

- [ ] **Step 9.3: ClaudeSession implementation**

Create `electron/agent/claude.ts`:

```ts
import { spawn, ChildProcess } from 'node:child_process'
import { resolveClaudePath } from './shell-env'
import { NdjsonBuffer } from './ndjson'
import type { AgentMessage } from '../../src/shared/messages'
import type { AgentSession, AgentSessionCallbacks } from './session'

/**
 * Speaks Claude Code's stream-json protocol over stdin/stdout.
 * Protocol mirror: lil-agents ClaudeSession.swift, particularly the
 * `parseLine` switch on `type` ∈ {system, assistant, user, result}.
 */
export class ClaudeSession implements AgentSession {
  private proc: ChildProcess | null = null
  private buffer = new NdjsonBuffer()
  private running = false
  private busy = false
  private currentResponseText = ''
  private msgs: AgentMessage[] = []
  private cb: Partial<AgentSessionCallbacks> = {}

  isRunning() { return this.running }
  isBusy() { return this.busy }
  history() { return this.msgs }

  setCallbacks(cb: Partial<AgentSessionCallbacks>) {
    this.cb = { ...this.cb, ...cb }
  }

  async start(): Promise<void> {
    const binary = resolveClaudePath()
    if (!binary) {
      const msg = 'Claude CLI not found.\n\nInstall on Windows:\n  npm install -g @anthropic-ai/claude-code'
      this.cb.onError?.(msg)
      this.msgs.push({ role: 'error', text: msg })
      return
    }

    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
      '--allowed-tools', 'WebFetch,WebSearch,TodoWrite',
    ]

    // Windows-specific: spawn() refuses to execute .cmd / .bat scripts directly.
    // npm-installed claude is a `claude.cmd` shim, so we need shell:true on Windows
    // when the resolved binary is a batch file. Without this, spawn throws EINVAL
    // or hangs silently.
    const isBatch = /\.(cmd|bat)$/i.test(binary)
    const proc = spawn(binary, args, {
      env: { ...process.env, TERM: 'dumb' },
      shell: isBatch,
      windowsHide: true,
      windowsVerbatimArguments: isBatch,
    })

    proc.stdout?.setEncoding('utf-8')
    proc.stderr?.setEncoding('utf-8')

    proc.stdout?.on('data', (chunk: string) => {
      try {
        const events = this.buffer.append(chunk)
        for (const ev of events) this.handleEvent(ev as Record<string, unknown>)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.cb.onError?.(`NDJSON parse error: ${msg}`)
      }
    })

    proc.stderr?.on('data', (chunk: string) => {
      this.cb.onError?.(chunk)
    })

    proc.on('exit', () => {
      this.running = false
      this.busy = false
      this.cb.onProcessExit?.()
    })

    this.proc = proc
    this.running = true
  }

  send(message: string): void {
    if (!this.proc?.stdin || !this.running) {
      this.cb.onError?.('Cannot send: process not running')
      return
    }
    this.busy = true
    this.currentResponseText = ''
    this.msgs.push({ role: 'user', text: message })

    const payload = {
      type: 'user',
      message: { role: 'user', content: message },
    }
    this.proc.stdin.write(JSON.stringify(payload) + '\n')
  }

  terminate(): void {
    this.proc?.kill()
    this.proc = null
    this.running = false
    this.busy = false
  }

  private handleEvent(ev: Record<string, unknown>): void {
    const type = ev.type as string

    if (type === 'system' && ev.subtype === 'init') {
      this.cb.onSessionReady?.()
      return
    }

    if (type === 'assistant') {
      const message = ev.message as { content?: Array<Record<string, unknown>> } | undefined
      const blocks = message?.content ?? []
      for (const block of blocks) {
        if (block.type === 'text' && typeof block.text === 'string') {
          this.currentResponseText += block.text
          this.cb.onText?.(block.text)
        }
      }
      return
    }

    if (type === 'result') {
      this.busy = false
      const finalText =
        typeof ev.result === 'string' && ev.result.length > 0
          ? ev.result
          : this.currentResponseText
      if (finalText.length > 0) {
        this.msgs.push({ role: 'assistant', text: finalText })
      }
      this.currentResponseText = ''
      this.cb.onTurnComplete?.()
      return
    }
  }
}
```

- [ ] **Step 9.4: Type-check the new modules**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors. If there are errors related to imports, check tsconfig.json `paths` and ensure they resolve.

- [ ] **Step 9.5: Commit**

```bash
git add src/shared/messages.ts electron/agent/session.ts electron/agent/claude.ts
git commit -m "feat(agent): ClaudeSession (spawn claude CLI + parse stream-json events)"
```

---

## Task 10: End-to-end IPC: dialog ↔ main ↔ claude

**Files:**
- Modify: `electron/ipc.ts`
- Modify: `electron/main.ts`
- Modify: `src/dialog/App.tsx`

- [ ] **Step 10.1: Wire ClaudeSession into main + IPC**

Replace `electron/ipc.ts` (full file):

```ts
import { ipcMain, screen } from 'electron'
import type { JPTWindows } from './window-manager'
import type { AgentSession } from './agent/session'

export function registerIpcHandlers(windows: JPTWindows, session: AgentSession) {
  // Character → main: position update
  ipcMain.on('character:set-position', (_event, x: number, y: number) => {
    windows.character.setPosition(Math.round(x), Math.round(y))
  })

  // Character → main: walk bounds query
  ipcMain.handle('character:get-walk-bounds', () => {
    const display = screen.getPrimaryDisplay()
    const { workArea } = display
    return {
      leftBound: workArea.x,
      rightBound: workArea.x + workArea.width - 96,
      floorY: workArea.y + workArea.height - 128,
    }
  })

  // Character → main: click toggles dialog
  ipcMain.on('character:click', () => {
    if (windows.dialog.isVisible()) {
      windows.dialog.hide()
      return
    }
    const charBounds = windows.character.getBounds()
    const { workArea } = screen.getPrimaryDisplay()
    const dialogW = 720
    const dialogH = 360
    let x = charBounds.x + charBounds.width + 10
    let y = charBounds.y - dialogH + charBounds.height
    if (x + dialogW > workArea.x + workArea.width) {
      x = charBounds.x - dialogW - 10
    }
    if (y < workArea.y) y = workArea.y
    windows.dialog.setBounds({ x, y, width: dialogW, height: dialogH })
    windows.dialog.show()
    windows.dialog.focus()
  })

  // Dialog → main: close request
  ipcMain.on('dialog:close', () => {
    windows.dialog.hide()
  })

  // Dialog → main: send user message
  ipcMain.on('dialog:user-send', (_event, message: string) => {
    session.send(message)
  })

  // Wire session callbacks → dialog renderer
  session.setCallbacks({
    onText: (chunk) => {
      windows.dialog.webContents.send('dialog:stream-token', chunk)
    },
    onTurnComplete: () => {
      windows.dialog.webContents.send('dialog:turn-complete')
    },
    onError: (msg) => {
      windows.dialog.webContents.send('dialog:error', msg)
    },
    onProcessExit: () => {
      windows.dialog.webContents.send('dialog:error', 'Claude process exited')
    },
  })
}
```

- [ ] **Step 10.2: Bootstrap session in main**

Replace `electron/main.ts`:

```ts
import { app } from 'electron'
import { createWindows, JPTWindows } from './window-manager'
import { registerIpcHandlers } from './ipc'
import { ClaudeSession } from './agent/claude'

let windows: JPTWindows | null = null
let session: ClaudeSession | null = null

app.whenReady().then(async () => {
  windows = createWindows()
  session = new ClaudeSession()
  registerIpcHandlers(windows, session)
  await session.start()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  session?.terminate()
  windows?.character.destroy()
  windows?.dialog.destroy()
})
```

- [ ] **Step 10.3: Dialog renderer with input + streaming output**

Replace `src/dialog/App.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react'
import '@shared/preload-types'

interface Msg {
  role: 'user' | 'assistant' | 'error'
  text: string
}

export function App() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentAssistantIdx = useRef<number | null>(null)

  // Esc closes; auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.jpt.send('dialog:close')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Wire IPC events from main
  useEffect(() => {
    const offToken = window.jpt.on('dialog:stream-token', (...args: unknown[]) => {
      const chunk = args[0] as string
      setMsgs((prev) => {
        const next = [...prev]
        if (currentAssistantIdx.current === null) {
          next.push({ role: 'assistant', text: chunk })
          currentAssistantIdx.current = next.length - 1
        } else {
          const i = currentAssistantIdx.current
          next[i] = { ...next[i], text: next[i].text + chunk }
        }
        return next
      })
    })
    const offComplete = window.jpt.on('dialog:turn-complete', () => {
      currentAssistantIdx.current = null
      setBusy(false)
    })
    const offError = window.jpt.on('dialog:error', (...args: unknown[]) => {
      const msg = args[0] as string
      setMsgs((prev) => [...prev, { role: 'error', text: msg }])
      currentAssistantIdx.current = null
      setBusy(false)
    })
    return () => {
      offToken()
      offComplete()
      offError()
    }
  }, [])

  const onSend = () => {
    const text = input.trim()
    if (!text || busy) return
    setMsgs((p) => [...p, { role: 'user', text }])
    setInput('')
    setBusy(true)
    window.jpt.send('dialog:user-send', text)
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        gap: 8,
        background: '#efc88c',
        border: '4px solid #3e2410',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: '#fff4dc',
          padding: 12,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {msgs.length === 0 && (
          <div style={{ opacity: 0.5 }}>说点什么试试…（Esc 关闭）</div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 8,
              color: m.role === 'error' ? '#a02a2a' : '#2a1a08',
            }}
          >
            <strong>
              {m.role === 'user' ? '我：' : m.role === 'error' ? '错误：' : 'JPT：'}
            </strong>{' '}
            {m.text}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSend()
          }}
          placeholder={busy ? 'JPT 思考中…' : '说点什么…'}
          style={{
            flex: 1,
            padding: 8,
            fontSize: 14,
            border: '2px solid #3e2410',
            background: '#fff4dc',
          }}
        />
        <button
          disabled={busy}
          onClick={onSend}
          style={{
            padding: '6px 14px',
            background: '#d8b078',
            border: '2px solid #3e2410',
            cursor: 'pointer',
          }}
        >
          送
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 10.4: Run dev and verify end-to-end**

Run:
```bash
npm run dev
```

Expected:
- Red square walks at the bottom
- Click red square → dialog opens
- Input is focused; type `hello` and press Enter
- Within a few seconds, "JPT：" appears with streaming text from Claude
- After complete, the input unlocks and you can send another message
- Press Esc → dialog hides; click red square again → dialog returns

If `claude` is not on PATH or not installed: dialog will show an error message instead.

- [ ] **Step 10.5: Commit**

```bash
git add electron/ipc.ts electron/main.ts src/dialog/App.tsx
git commit -m "feat: end-to-end dialog ↔ main ↔ claude wired with streaming"
```

---

## Task 11: v0 acceptance + regression test

**Files:**
- Create: `docs/v0-acceptance.md`

- [ ] **Step 11.1: Run unit tests**

Run:
```bash
npm test
```

Expected: all tests pass (`ndjson`, `state-machine`, `shell-env`).

- [ ] **Step 11.2: Document v0 acceptance run**

Create `docs/v0-acceptance.md`:

```markdown
# v0 Acceptance Log

Source spec: `docs/superpowers/specs/2026-05-10-JPT-design.md` §10 (v0 验收)

## Acceptance criteria

- [x] Vite + Electron + React + TS scaffolding runs
- [x] Two windows: transparent AOT character window + transparent AOT dialog window
- [x] Placeholder red rectangle walks back-and-forth at the bottom of primary display
- [x] `ClaudeSession` spawns `claude` CLI; stdin/stdout connected
- [x] Static end-to-end message: dialog → main → claude → dialog (streaming)
- [x] User can click character to open dialog, type "hello", receive Claude response

## How to run (Windows)

```powershell
# from JPT repo root
npm install   # first time only
npm run dev   # opens character + dialog windows
```

## How to test

1. Wait for the red square to appear at the bottom of the primary display (above the taskbar)
2. Wait for it to walk left and right
3. Click the red square → dialog window appears
4. Type `hello` → press Enter
5. Watch Claude's response stream in
6. Press Esc → dialog hides
7. Press Ctrl+C in the terminal to quit
```

- [ ] **Step 11.3: Commit**

```bash
git add docs/v0-acceptance.md
git commit -m "docs: v0 acceptance log"
```

- [ ] **Step 11.4: Push to GitHub**

```bash
git push origin main
```

Expected: all v0 commits pushed.

---

## v0 完成。下一步

v0 跑通后写 v1.0 plan：

- 真 sprite 替换占位红框（AI 生成 + Aseprite 后处理）
- 像素级 click-through（alpha map）
- 拖拽 / 挂壁 / 拎起 状态机扩展
- SDV 风格对话框（木框 / 立绘 / 卷轴名牌 / 流式 Markdown / tool_use 卡片）
- thinking 气泡 / 完成音
- 系统托盘菜单 + 设置窗口 + 首次欢迎信
- electron-builder 打包 + electron-updater 自更新
- Zpix 字体集成
- `%APPDATA%\JPT\workdir\CLAUDE.md` always-on 人格落地
- 任务栏 / 多屏 / DPI 边角处理

每一项的具体步骤会在下一份 plan 里展开。
