# Codex Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default Codex backend to JPT while keeping Claude as a switchable fallback.

**Architecture:** Introduce an `AgentManager` that owns exactly one active backend. Claude keeps its current stream-json implementation; Codex uses a long-lived `codex app-server --listen stdio://` process, one resumable Codex thread, JPT-style streaming callbacks, and a hard guard that blocks whole-file deletion.

**Tech Stack:** Electron main process, React renderers, TypeScript strict mode, Node `child_process`, stdio JSON-RPC, Vitest.

---

## File Structure

- `src/shared/config.ts` — add backend and Codex workdir settings.
- `electron/config-store.ts` — read/write the new config fields.
- `tests/config-store.test.ts` — verify new defaults and persistence.
- `electron/agent/session.ts` — rename the conceptual interface from session-specific to backend-neutral and add `clear()`.
- `electron/agent/claude.ts` — keep behavior, add `id = 'claude'` and `clear()`.
- `electron/agent/shell-env.ts` — resolve both Claude and Codex binaries.
- `tests/shell-env.test.ts` — verify binary resolution remains deterministic.
- `src/dialog/slash.ts` — parse `/backend` and `/workdir`.
- `tests/slash.test.ts` — cover new slash commands.
- `electron/agent/codex-protocol.ts` — local minimal app-server JSON-RPC and notification types.
- `electron/agent/codex-jsonrpc.ts` — stdio JSON-RPC framing, request tracking, and notification dispatch.
- `tests/codex-jsonrpc.test.ts` — test line buffering and response matching with fakes.
- `electron/agent/codex-guard.ts` — block whole-file deletion from commands and diffs.
- `tests/codex-guard.test.ts` — verify delete guard behavior.
- `electron/agent/codex-event-mapper.ts` — convert Codex notifications into JPT backend callbacks.
- `tests/codex-event-mapper.test.ts` — verify delta/completion/error mapping and guard interrupt.
- `electron/agent/codex.ts` — implement `CodexBackend`.
- `tests/codex-backend.test.ts` — test lifecycle with a fake app-server client.
- `electron/agent/manager.ts` — implement `AgentManager`.
- `tests/agent-manager.test.ts` — verify switching, clear, lazy start, and single-active behavior.
- `electron/ipc.ts` — accept `AgentManager`, route backend/workdir slash commands, and react to settings changes.
- `electron/main.ts` — create manager instead of a raw `ClaudeSession`.
- `src/dialog/App.tsx` — handle new slash command results.
- `src/settings/App.tsx` — expose backend and Codex workdir controls.

Do not copy generated Codex app-server schema files into the repo. The generated files are large and unstable; this implementation uses a minimal local protocol surface that matches the methods JPT calls.

---

## Stage 1: Settings, Slash Parsing, and Interface Shape

### Task 1: Config Defaults for Dual Backends

**Files:**
- Modify: `src/shared/config.ts`
- Modify: `electron/config-store.ts`
- Modify: `tests/config-store.test.ts`

- [ ] **Step 1.1: Write config tests first**

Add these assertions to `tests/config-store.test.ts` inside `returns defaults when nothing is set`:

```ts
expect(snap.agentBackend).toBe('codex')
expect(snap.codexWorkdir).toBe('')
expect(snap.codexIdleTimeoutMs).toBe(20 * 60_000)
expect(snap.codexNoDeleteFiles).toBe(true)
expect(snap.codexThreadId).toBe('')
```

Add this test below the existing persistence test:

```ts
it('persists Codex backend settings', () => {
  store.update({
    agentBackend: 'claude',
    codexWorkdir: 'C:\\Users\\LeoinTube\\project',
    codexThreadId: 'thread-123',
  })
  const snap = store.snapshot()
  expect(snap.agentBackend).toBe('claude')
  expect(snap.codexWorkdir).toBe('C:\\Users\\LeoinTube\\project')
  expect(snap.codexThreadId).toBe('thread-123')
})
```

- [ ] **Step 1.2: Run the failing config test**

Run:

```powershell
npm test -- tests/config-store.test.ts
```

Expected: TypeScript or test failure because `agentBackend`, `codexWorkdir`, `codexIdleTimeoutMs`, `codexNoDeleteFiles`, and `codexThreadId` do not exist yet.

- [ ] **Step 1.3: Add config fields**

Modify `src/shared/config.ts`:

```ts
export type FontSize = 'small' | 'medium' | 'large'
export type AgentBackendId = 'codex' | 'claude'

export interface ConfigSnapshot {
  characterDisplayName: string
  userAddressName: string
  fontSize: FontSize
  soundsEnabled: boolean
  launchAtStartup: boolean
  personaDoc: string
  proactiveMessages: boolean
  agentBackend: AgentBackendId
  codexWorkdir: string
  codexIdleTimeoutMs: number
  codexNoDeleteFiles: true
  codexThreadId: string
}

export const DEFAULT_CONFIG: ConfigSnapshot = {
  characterDisplayName: 'JPT',
  userAddressName: '小屿',
  fontSize: 'medium',
  soundsEnabled: true,
  launchAtStartup: true,
  personaDoc: '',
  proactiveMessages: false,
  agentBackend: 'codex',
  codexWorkdir: '',
  codexIdleTimeoutMs: 20 * 60_000,
  codexNoDeleteFiles: true,
  codexThreadId: '',
}
```

Modify `electron/config-store.ts` `snapshot()` to include:

```ts
agentBackend: this.store.get('agentBackend', DEFAULT_CONFIG.agentBackend)!,
codexWorkdir: this.store.get('codexWorkdir', DEFAULT_CONFIG.codexWorkdir)!,
codexIdleTimeoutMs: this.store.get('codexIdleTimeoutMs', DEFAULT_CONFIG.codexIdleTimeoutMs)!,
codexNoDeleteFiles: this.store.get('codexNoDeleteFiles', DEFAULT_CONFIG.codexNoDeleteFiles)!,
codexThreadId: this.store.get('codexThreadId', DEFAULT_CONFIG.codexThreadId)!,
```

- [ ] **Step 1.4: Run config tests**

Run:

```powershell
npm test -- tests/config-store.test.ts
```

Expected: PASS.

- [ ] **Step 1.5: Commit**

```powershell
git add src/shared/config.ts electron/config-store.ts tests/config-store.test.ts
git commit -m "feat(config): add Codex backend settings"
```

### Task 2: Backend and Workdir Slash Commands

**Files:**
- Modify: `src/dialog/slash.ts`
- Modify: `tests/slash.test.ts`

- [ ] **Step 2.1: Write slash parser tests first**

Replace the type expectations in `tests/slash.test.ts` with additional tests:

```ts
it('parses /backend without argument', () => {
  expect(parseSlash('/backend')).toEqual({ cmd: 'backend' })
})

it('parses /backend codex and /backend claude', () => {
  expect(parseSlash('/backend codex')).toEqual({ cmd: 'backend', backend: 'codex' })
  expect(parseSlash('/backend claude')).toEqual({ cmd: 'backend', backend: 'claude' })
})

it('unknown /backend target returns help', () => {
  expect(parseSlash('/backend gpt')).toEqual({ cmd: 'help' })
})

it('parses /workdir without path', () => {
  expect(parseSlash('/workdir')).toEqual({ cmd: 'workdir' })
})

it('parses /workdir with a Windows path', () => {
  expect(parseSlash('/workdir C:\\Users\\LeoinTube\\JPT')).toEqual({
    cmd: 'workdir',
    path: 'C:\\Users\\LeoinTube\\JPT',
  })
})
```

- [ ] **Step 2.2: Run the failing slash tests**

Run:

```powershell
npm test -- tests/slash.test.ts
```

Expected: FAIL because parser only knows `clear`, `copy`, and `help`.

- [ ] **Step 2.3: Implement parser**

Replace `src/dialog/slash.ts` with:

```ts
import type { AgentBackendId } from '@shared/config'

export type SlashCmd = 'clear' | 'copy' | 'help' | 'backend' | 'workdir'

export type SlashParsed =
  | { cmd: 'clear' | 'copy' | 'help' }
  | { cmd: 'backend'; backend?: AgentBackendId }
  | { cmd: 'workdir'; path?: string }

const HELP_TEXT = `可用命令：
/clear — 清空当前对话（不删历史文件）
/copy — 复制最后一条 JPT 回复
/backend — 显示当前 AI 后端
/backend codex — 切到 Codex
/backend claude — 切到 Claude
/workdir — 显示当前 Codex 工作目录
/workdir C:\\path\\to\\project — 设置 Codex 工作目录
/help — 显示这个帮助`

export function parseSlash(input: string): SlashParsed | null {
  const t = input.trim()
  if (!t.startsWith('/')) return null
  const [, rawWord = '', rest = ''] = t.match(/^\/(\S+)(?:\s+([\s\S]*))?$/) ?? []
  const word = rawWord.toLowerCase()
  if (word === 'clear') return { cmd: 'clear' }
  if (word === 'copy') return { cmd: 'copy' }
  if (word === 'help') return { cmd: 'help' }
  if (word === 'backend') {
    const backend = rest.trim().toLowerCase()
    if (!backend) return { cmd: 'backend' }
    if (backend === 'codex' || backend === 'claude') return { cmd: 'backend', backend }
    return { cmd: 'help' }
  }
  if (word === 'workdir') {
    const path = rest.trim()
    return path ? { cmd: 'workdir', path } : { cmd: 'workdir' }
  }
  return { cmd: 'help' }
}

export function slashHelpText(): string {
  return HELP_TEXT
}
```

- [ ] **Step 2.4: Run slash tests**

Run:

```powershell
npm test -- tests/slash.test.ts
```

Expected: PASS.

- [ ] **Step 2.5: Commit**

```powershell
git add src/dialog/slash.ts tests/slash.test.ts
git commit -m "feat(dialog): parse backend and workdir slash commands"
```

### Task 3: Backend-Neutral Session Interface

**Files:**
- Modify: `electron/agent/session.ts`
- Modify: `electron/agent/claude.ts`

- [ ] **Step 3.1: Extend the interface**

Modify `electron/agent/session.ts`:

```ts
import type { AgentMessage } from '../../src/shared/messages'
import type { AgentBackendId } from '../../src/shared/config'

export interface AgentSessionCallbacks {
  onText: (chunk: string) => void
  onError: (msg: string) => void
  onSessionReady: () => void
  onTurnComplete: () => void
  onProcessExit: () => void
  onToolUse: (tool: string, summary: string) => void
  onToolResult: (summary: string, isError: boolean) => void
}

export interface AgentSession {
  id: AgentBackendId
  isRunning(): boolean
  isBusy(): boolean
  history(): AgentMessage[]
  start(): Promise<void>
  send(message: string): void
  clear(): Promise<void>
  terminate(): void
  setCallbacks(cb: Partial<AgentSessionCallbacks>): void
}
```

- [ ] **Step 3.2: Adapt ClaudeSession**

In `electron/agent/claude.ts`, add:

```ts
readonly id = 'claude' as const
```

inside the class, and add this method before `terminate()`:

```ts
async clear(): Promise<void> {
  this.terminate()
  this.msgs = []
  await this.start()
}
```

- [ ] **Step 3.3: Compile**

Run:

```powershell
npm run build
```

Expected: build succeeds or reports call sites that still need `clear()` handling in Stage 4. If build fails only because existing code calls `terminate() + start()` for slash clear, keep that code for now; the interface is ready.

- [ ] **Step 3.4: Commit**

```powershell
git add electron/agent/session.ts electron/agent/claude.ts
git commit -m "refactor(agent): make session interface backend-neutral"
```

---

## Stage 2: Codex Protocol, Guard, and Event Mapping

### Task 4: Codex Binary Resolution

**Files:**
- Modify: `electron/agent/shell-env.ts`
- Modify: `tests/shell-env.test.ts`

- [ ] **Step 4.1: Write resolver tests first**

Add to `tests/shell-env.test.ts`:

```ts
import { findBinaryInPaths, candidateBinaryNames } from '../electron/agent/shell-env'
```

Add tests:

```ts
it('candidateBinaryNames includes Windows cmd shims for codex', () => {
  expect(candidateBinaryNames('codex', true)).toEqual(['codex.exe', 'codex.cmd', 'codex'])
})

it('candidateBinaryNames keeps Unix names extensionless', () => {
  expect(candidateBinaryNames('codex', false)).toEqual(['codex'])
})
```

- [ ] **Step 4.2: Run failing tests**

Run:

```powershell
npm test -- tests/shell-env.test.ts
```

Expected: FAIL because `candidateBinaryNames` does not exist.

- [ ] **Step 4.3: Implement generic resolver helpers**

Modify `electron/agent/shell-env.ts` to add:

```ts
export function candidateBinaryNames(name: string, isWindows: boolean): string[] {
  return isWindows ? [`${name}.exe`, `${name}.cmd`, name] : [name]
}

function resolveFromPath(name: string, isWindows: boolean): string | null {
  const pathVar = process.env.PATH || ''
  const sep = isWindows ? ';' : ':'
  const pathDirs = pathVar.split(sep).filter(Boolean)
  for (const dir of pathDirs) {
    for (const binary of candidateBinaryNames(name, isWindows)) {
      const candidate = path.join(dir, binary)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}
```

Then add:

```ts
export function resolveCodexPath(): string | null {
  const home = os.homedir()
  const isWindows = process.platform === 'win32'

  const candidates: string[] = isWindows
    ? [
        path.join(home, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'codex'),
      ]
    : [
        path.join(home, '.local', 'bin', 'codex'),
        '/opt/homebrew/bin/codex',
        '/usr/local/bin/codex',
      ]

  const direct = findBinaryInPaths('codex', candidates)
  if (direct) return direct
  return resolveFromPath('codex', isWindows)
}
```

Update `resolveClaudePath()` to use `resolveFromPath('claude', isWindows)` instead of duplicating PATH scanning.

- [ ] **Step 4.4: Run shell-env tests**

Run:

```powershell
npm test -- tests/shell-env.test.ts
```

Expected: PASS.

- [ ] **Step 4.5: Commit**

```powershell
git add electron/agent/shell-env.ts tests/shell-env.test.ts
git commit -m "feat(agent): resolve Codex CLI binary"
```

### Task 5: Minimal Codex App-Server Protocol Types

**Files:**
- Create: `electron/agent/codex-protocol.ts`

- [ ] **Step 5.1: Create protocol file**

Create `electron/agent/codex-protocol.ts`:

```ts
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonRpcId = number

export interface JsonRpcRequest<TParams = JsonValue> {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: TParams
}

export interface JsonRpcNotification<TParams = JsonValue> {
  jsonrpc: '2.0'
  method: string
  params?: TParams
}

export interface JsonRpcResponse<TResult = JsonValue> {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: TResult
  error?: { code: number; message: string; data?: JsonValue }
}

export interface ThreadRef {
  id: string
}

export interface ThreadStartResponse {
  thread: ThreadRef
}

export interface ThreadResumeResponse {
  thread: ThreadRef
}

export interface TurnStartResponse {
  turn: { id: string }
}

export interface CodexTextInput {
  type: 'text'
  text: string
  text_elements: []
}

export interface AgentMessageDeltaNotification {
  threadId: string
  turnId: string
  itemId: string
  delta: string
}

export interface TurnCompletedNotification {
  threadId: string
  turn: { id: string; status?: string }
}

export interface TurnDiffUpdatedNotification {
  threadId: string
  turnId: string
  diff: string
}

export interface ErrorNotification {
  message?: string
  error?: { message?: string }
}

export type CodexServerNotification =
  | { method: 'item/agentMessage/delta'; params: AgentMessageDeltaNotification }
  | { method: 'turn/completed'; params: TurnCompletedNotification }
  | { method: 'turn/diff/updated'; params: TurnDiffUpdatedNotification }
  | { method: 'error'; params: ErrorNotification }
  | { method: string; params?: JsonValue }
```

- [ ] **Step 5.2: Compile**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 5.3: Commit**

```powershell
git add electron/agent/codex-protocol.ts
git commit -m "feat(codex): add minimal app-server protocol types"
```

### Task 6: Codex JSON-RPC Client Framing

**Files:**
- Create: `electron/agent/codex-jsonrpc.ts`
- Create: `tests/codex-jsonrpc.test.ts`

- [ ] **Step 6.1: Write JSON-RPC tests first**

Create `tests/codex-jsonrpc.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { CodexJsonRpcPeer } from '../electron/agent/codex-jsonrpc'

describe('CodexJsonRpcPeer', () => {
  it('writes JSON-RPC requests with incrementing ids', async () => {
    const writes: string[] = []
    const peer = new CodexJsonRpcPeer((line) => writes.push(line))
    const pending = peer.request('thread/start', { cwd: 'C:\\x' })
    expect(writes[0]).toContain('"method":"thread/start"')
    expect(writes[0]).toContain('"id":1')
    peer.acceptLine('{"jsonrpc":"2.0","id":1,"result":{"thread":{"id":"t1"}}}')
    await expect(pending).resolves.toEqual({ thread: { id: 't1' } })
  })

  it('dispatches notifications', () => {
    const onNotification = vi.fn()
    const peer = new CodexJsonRpcPeer(() => {}, onNotification)
    peer.acceptLine('{"jsonrpc":"2.0","method":"item/agentMessage/delta","params":{"delta":"hi"}}')
    expect(onNotification).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'item/agentMessage/delta',
      params: { delta: 'hi' },
    })
  })

  it('rejects request promise on JSON-RPC error response', async () => {
    const peer = new CodexJsonRpcPeer(() => {})
    const pending = peer.request('thread/start', {})
    peer.acceptLine('{"jsonrpc":"2.0","id":1,"error":{"code":-1,"message":"bad"}}')
    await expect(pending).rejects.toThrow('bad')
  })
})
```

- [ ] **Step 6.2: Run failing JSON-RPC tests**

Run:

```powershell
npm test -- tests/codex-jsonrpc.test.ts
```

Expected: FAIL because `codex-jsonrpc.ts` does not exist.

- [ ] **Step 6.3: Implement peer**

Create `electron/agent/codex-jsonrpc.ts`:

```ts
import type { JsonRpcNotification, JsonRpcResponse, JsonValue } from './codex-protocol'

type Pending = {
  resolve: (value: JsonValue) => void
  reject: (error: Error) => void
}

export class CodexJsonRpcPeer {
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor(
    private writeLine: (line: string) => void,
    private onNotification: (notification: JsonRpcNotification) => void = () => {},
  ) {}

  request<T = JsonValue>(method: string, params: JsonValue): Promise<T> {
    const id = this.nextId++
    const payload = { jsonrpc: '2.0' as const, id, method, params }
    this.writeLine(JSON.stringify(payload) + '\n')
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })
    })
  }

  acceptLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return
    const msg = JSON.parse(trimmed) as JsonRpcResponse | JsonRpcNotification
    if ('id' in msg) {
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      if ('error' in msg && msg.error) {
        pending.reject(new Error(msg.error.message))
      } else {
        pending.resolve((msg as JsonRpcResponse).result ?? null)
      }
      return
    }
    this.onNotification(msg as JsonRpcNotification)
  }

  rejectAll(message: string): void {
    for (const [, pending] of this.pending) pending.reject(new Error(message))
    this.pending.clear()
  }
}
```

- [ ] **Step 6.4: Run JSON-RPC tests**

Run:

```powershell
npm test -- tests/codex-jsonrpc.test.ts
```

Expected: PASS.

- [ ] **Step 6.5: Commit**

```powershell
git add electron/agent/codex-jsonrpc.ts tests/codex-jsonrpc.test.ts
git commit -m "feat(codex): add JSON-RPC stdio peer"
```

### Task 7: Delete Guard

**Files:**
- Create: `electron/agent/codex-guard.ts`
- Create: `tests/codex-guard.test.ts`

- [ ] **Step 7.1: Write guard tests first**

Create `tests/codex-guard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isDeletionCommand, diffDeletesWholeFile, deletionBlockMessage } from '../electron/agent/codex-guard'

describe('codex guard', () => {
  it('blocks common deletion shell commands', () => {
    expect(isDeletionCommand('rm src/a.ts')).toBe(true)
    expect(isDeletionCommand('del C:\\tmp\\a.txt')).toBe(true)
    expect(isDeletionCommand('Remove-Item .\\a.txt')).toBe(true)
    expect(isDeletionCommand('powershell -Command "Remove-Item .\\a.txt"')).toBe(true)
  })

  it('allows non-delete commands', () => {
    expect(isDeletionCommand('npm test')).toBe(false)
    expect(isDeletionCommand('git diff -- src/a.ts')).toBe(false)
  })

  it('blocks whole-file deletion diffs', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      'deleted file mode 100644',
      '--- a/src/a.ts',
      '+++ /dev/null',
    ].join('\\n')
    expect(diffDeletesWholeFile(diff)).toBe(true)
  })

  it('allows line-level deletions in a modified file', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,2 +1,1 @@',
      '-const unused = 1',
      ' const kept = 2',
    ].join('\\n')
    expect(diffDeletesWholeFile(diff)).toBe(false)
  })

  it('uses the approved user-facing block message', () => {
    expect(deletionBlockMessage()).toBe('这个操作会删除整个文件，我先停住了。')
  })
})
```

- [ ] **Step 7.2: Run failing guard tests**

Run:

```powershell
npm test -- tests/codex-guard.test.ts
```

Expected: FAIL because `codex-guard.ts` does not exist.

- [ ] **Step 7.3: Implement guard**

Create `electron/agent/codex-guard.ts`:

```ts
const DELETE_COMMANDS = new Set(['rm', 'del', 'erase', 'rmdir', 'rd', 'remove-item'])

export function deletionBlockMessage(): string {
  return '这个操作会删除整个文件，我先停住了。'
}

export function isDeletionCommand(command: string): boolean {
  const normalized = command
    .replace(/[;&|()]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)

  return normalized.some((token) => DELETE_COMMANDS.has(token))
}

export function diffDeletesWholeFile(diff: string): boolean {
  const lines = diff.split(/\r?\n/)
  if (lines.some((line) => line.startsWith('deleted file mode'))) return true
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].startsWith('--- a/') && lines[i + 1] === '+++ /dev/null') return true
  }
  return false
}
```

- [ ] **Step 7.4: Run guard tests**

Run:

```powershell
npm test -- tests/codex-guard.test.ts
```

Expected: PASS.

- [ ] **Step 7.5: Commit**

```powershell
git add electron/agent/codex-guard.ts tests/codex-guard.test.ts
git commit -m "feat(codex): block whole-file deletion"
```

### Task 8: Codex Event Mapper

**Files:**
- Create: `electron/agent/codex-event-mapper.ts`
- Create: `tests/codex-event-mapper.test.ts`

- [ ] **Step 8.1: Write event mapper tests first**

Create `tests/codex-event-mapper.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mapCodexNotification } from '../electron/agent/codex-event-mapper'
import type { AgentSessionCallbacks } from '../electron/agent/session'

function callbacks() {
  return {
    onText: vi.fn(),
    onTurnComplete: vi.fn(),
    onError: vi.fn(),
  } as unknown as Partial<AgentSessionCallbacks>
}

describe('mapCodexNotification', () => {
  it('maps agent message deltas to text callbacks', () => {
    const cb = callbacks()
    const result = mapCodexNotification({ method: 'item/agentMessage/delta', params: { delta: 'hello' } }, cb)
    expect(result).toEqual({ blocked: false })
    expect(cb.onText).toHaveBeenCalledWith('hello')
  })

  it('maps turn completion', () => {
    const cb = callbacks()
    mapCodexNotification({ method: 'turn/completed', params: { threadId: 't1', turn: { id: 'turn1' } } }, cb)
    expect(cb.onTurnComplete).toHaveBeenCalled()
  })

  it('blocks whole-file deletion diffs', () => {
    const cb = callbacks()
    const result = mapCodexNotification({
      method: 'turn/diff/updated',
      params: { threadId: 't1', turnId: 'turn1', diff: 'deleted file mode 100644\\n--- a/a.ts\\n+++ /dev/null' },
    }, cb)
    expect(result).toEqual({ blocked: true, threadId: 't1', turnId: 'turn1' })
    expect(cb.onError).toHaveBeenCalledWith('这个操作会删除整个文件，我先停住了。')
  })
})
```

- [ ] **Step 8.2: Run failing mapper tests**

Run:

```powershell
npm test -- tests/codex-event-mapper.test.ts
```

Expected: FAIL because mapper does not exist.

- [ ] **Step 8.3: Implement mapper**

Create `electron/agent/codex-event-mapper.ts`:

```ts
import type { AgentSessionCallbacks } from './session'
import { deletionBlockMessage, diffDeletesWholeFile } from './codex-guard'

export type CodexMappedResult =
  | { blocked: false }
  | { blocked: true; threadId: string; turnId: string }

export function mapCodexNotification(
  notification: { method: string; params?: unknown },
  cb: Partial<AgentSessionCallbacks>,
): CodexMappedResult {
  const params = notification.params as Record<string, unknown> | undefined
  if (notification.method === 'item/agentMessage/delta') {
    const delta = typeof params?.delta === 'string' ? params.delta : ''
    if (delta) cb.onText?.(delta)
    return { blocked: false }
  }
  if (notification.method === 'turn/completed') {
    cb.onTurnComplete?.()
    return { blocked: false }
  }
  if (notification.method === 'error') {
    const raw = params?.message
    cb.onError?.(typeof raw === 'string' ? raw : 'Codex app-server error')
    return { blocked: false }
  }
  if (notification.method === 'turn/diff/updated') {
    const diff = typeof params?.diff === 'string' ? params.diff : ''
    if (diffDeletesWholeFile(diff)) {
      cb.onError?.(deletionBlockMessage())
      return {
        blocked: true,
        threadId: String(params?.threadId ?? ''),
        turnId: String(params?.turnId ?? ''),
      }
    }
  }
  return { blocked: false }
}
```

- [ ] **Step 8.4: Run mapper tests**

Run:

```powershell
npm test -- tests/codex-event-mapper.test.ts
```

Expected: PASS.

- [ ] **Step 8.5: Commit**

```powershell
git add electron/agent/codex-event-mapper.ts tests/codex-event-mapper.test.ts
git commit -m "feat(codex): map app-server events to JPT callbacks"
```

---

## Stage 3: Codex Backend and Manager

### Task 9: Codex Backend Lifecycle

**Files:**
- Create: `electron/agent/codex.ts`
- Create: `tests/codex-backend.test.ts`

- [ ] **Step 9.1: Write backend tests with a fake client**

Create `tests/codex-backend.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { CodexBackend, CodexAppServerLike } from '../electron/agent/codex'

function fakeClient(): CodexAppServerLike {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    threadStart: vi.fn().mockResolvedValue('thread-1'),
    threadResume: vi.fn().mockResolvedValue('thread-1'),
    turnStart: vi.fn().mockResolvedValue('turn-1'),
    turnInterrupt: vi.fn().mockResolvedValue(undefined),
    onNotification: vi.fn(),
  }
}

describe('CodexBackend', () => {
  it('starts app-server and creates a thread when no saved thread exists', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: '',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })
    await backend.start()
    expect(client.start).toHaveBeenCalled()
    expect(client.threadStart).toHaveBeenCalledWith(expect.objectContaining({ cwd: 'C:\\repo' }))
  })

  it('resumes a saved thread before creating a new one', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: 'thread-old',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })
    await backend.start()
    expect(client.threadResume).toHaveBeenCalledWith('thread-old', expect.objectContaining({ cwd: 'C:\\repo' }))
    expect(client.threadStart).not.toHaveBeenCalled()
  })

  it('sends turns to the active thread', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: '',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })
    await backend.start()
    backend.send('hello')
    await Promise.resolve()
    expect(client.turnStart).toHaveBeenCalledWith('thread-1', 'hello')
  })

  it('clear creates a fresh thread in the same workdir', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: 'thread-old',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })
    await backend.start()
    await backend.clear()
    expect(client.threadStart).toHaveBeenCalledWith(expect.objectContaining({ cwd: 'C:\\repo' }))
  })
})
```

- [ ] **Step 9.2: Run failing backend tests**

Run:

```powershell
npm test -- tests/codex-backend.test.ts
```

Expected: FAIL because `codex.ts` does not exist.

- [ ] **Step 9.3: Implement CodexBackend with an injectable client**

Create `electron/agent/codex.ts`:

```ts
import type { AgentMessage } from '../../src/shared/messages'
import type { AgentSession, AgentSessionCallbacks } from './session'
import { mapCodexNotification } from './codex-event-mapper'

export interface CodexThreadOptions {
  workdir: string
  threadId: string
  idleTimeoutMs: number
  saveThreadId: (threadId: string) => void
}

export interface CodexAppServerLike {
  start(): Promise<void>
  stop(): void
  threadStart(params: { cwd: string }): Promise<string>
  threadResume(threadId: string, params: { cwd: string }): Promise<string>
  turnStart(threadId: string, text: string): Promise<string>
  turnInterrupt(threadId: string, turnId: string): Promise<void>
  onNotification(listener: (notification: { method: string; params?: unknown }) => void): void
}

export class CodexBackend implements AgentSession {
  readonly id = 'codex' as const
  private running = false
  private busy = false
  private threadId = ''
  private msgs: AgentMessage[] = []
  private cb: Partial<AgentSessionCallbacks> = {}
  private idleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private client: CodexAppServerLike, private options: CodexThreadOptions) {
    this.threadId = options.threadId
    this.client.onNotification((notification) => {
      const result = mapCodexNotification(notification, this.cb)
      if (result.blocked) {
        this.client.turnInterrupt(result.threadId, result.turnId).catch(() => {})
        this.busy = false
      }
    })
  }

  isRunning() { return this.running }
  isBusy() { return this.busy }
  history(): AgentMessage[] { return [...this.msgs] }

  setCallbacks(cb: Partial<AgentSessionCallbacks>) {
    this.cb = { ...this.cb, ...cb }
  }

  async start(): Promise<void> {
    if (this.running) return
    await this.client.start()
    this.running = true
    if (this.threadId) {
      try {
        this.threadId = await this.client.threadResume(this.threadId, { cwd: this.options.workdir })
      } catch {
        this.threadId = await this.client.threadStart({ cwd: this.options.workdir })
      }
    } else {
      this.threadId = await this.client.threadStart({ cwd: this.options.workdir })
    }
    this.options.saveThreadId(this.threadId)
    this.cb.onSessionReady?.()
    this.bumpIdleTimer()
  }

  send(message: string): void {
    void this.sendAsync(message)
  }

  private async sendAsync(message: string): Promise<void> {
    if (!this.running) await this.start()
    if (!this.threadId) {
      this.cb.onError?.('Codex thread is not ready')
      return
    }
    this.busy = true
    this.msgs.push({ role: 'user', text: message })
    await this.client.turnStart(this.threadId, message)
    this.bumpIdleTimer()
  }

  async clear(): Promise<void> {
    if (!this.running) await this.start()
    this.msgs = []
    this.threadId = await this.client.threadStart({ cwd: this.options.workdir })
    this.options.saveThreadId(this.threadId)
    this.cb.onSessionReady?.()
    this.bumpIdleTimer()
  }

  terminate(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
    this.client.stop()
    this.running = false
    this.busy = false
    this.cb.onProcessExit?.()
  }

  private bumpIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.terminate(), this.options.idleTimeoutMs)
  }
}
```

- [ ] **Step 9.4: Run backend tests**

Run:

```powershell
npm test -- tests/codex-backend.test.ts
```

Expected: PASS.

- [ ] **Step 9.5: Commit**

```powershell
git add electron/agent/codex.ts tests/codex-backend.test.ts
git commit -m "feat(codex): add backend lifecycle"
```

### Task 10: Real Codex App-Server Client

**Files:**
- Create: `electron/agent/codex-app-server.ts`
- Modify: `electron/agent/codex.ts`

- [ ] **Step 10.1: Implement app-server client**

Create `electron/agent/codex-app-server.ts`:

```ts
import { spawn, ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { resolveCodexPath } from './shell-env'
import { CodexJsonRpcPeer } from './codex-jsonrpc'
import type { CodexAppServerLike } from './codex'
import type { ThreadResumeResponse, ThreadStartResponse, TurnStartResponse } from './codex-protocol'

const DELETE_GUARD_INSTRUCTIONS = `You may edit files, but you must not delete entire files or directories.
Do not run deletion commands such as rm, del, erase, rmdir, rd, or Remove-Item.
If a task appears to require deleting a file, explain the reason to the user instead of performing the deletion.`

export class CodexAppServerClient implements CodexAppServerLike {
  private proc: ChildProcess | null = null
  private peer: CodexJsonRpcPeer | null = null
  private emitter = new EventEmitter()
  private lineBuf = ''

  async start(): Promise<void> {
    if (this.proc) return
    const binary = resolveCodexPath()
    if (!binary) throw new Error('Codex CLI not found. Install or log into Codex on this machine.')
    const isBatch = /\.(cmd|bat)$/i.test(binary)
    const proc = spawn(binary, ['app-server', '--listen', 'stdio://'], {
      env: { ...process.env, TERM: 'dumb' },
      shell: isBatch,
      windowsHide: true,
      windowsVerbatimArguments: isBatch,
    })
    proc.stdout?.setEncoding('utf-8')
    proc.stderr?.setEncoding('utf-8')
    this.proc = proc
    this.peer = new CodexJsonRpcPeer(
      (line) => proc.stdin?.write(line),
      (notification) => this.emitter.emit('notification', notification),
    )
    proc.stdout?.on('data', (chunk: string) => this.acceptChunk(chunk))
    proc.on('exit', () => {
      this.peer?.rejectAll('Codex app-server exited')
      this.proc = null
      this.peer = null
    })
    proc.on('error', (err) => {
      this.peer?.rejectAll(err.message)
      this.proc = null
      this.peer = null
    })
    await this.request('initialize', {
      clientInfo: { name: 'JPT', version: '1.5.0' },
    })
  }

  stop(): void {
    this.peer?.rejectAll('Codex app-server stopped')
    this.proc?.kill()
    this.proc = null
    this.peer = null
  }

  async threadStart(params: { cwd: string }): Promise<string> {
    const result = await this.request<ThreadStartResponse>('thread/start', {
      cwd: params.cwd,
      approvalPolicy: 'never',
      sandbox: 'danger-full-access',
      developerInstructions: DELETE_GUARD_INSTRUCTIONS,
    })
    return result.thread.id
  }

  async threadResume(threadId: string, params: { cwd: string }): Promise<string> {
    const result = await this.request<ThreadResumeResponse>('thread/resume', {
      threadId,
      cwd: params.cwd,
      approvalPolicy: 'never',
      sandbox: 'danger-full-access',
      developerInstructions: DELETE_GUARD_INSTRUCTIONS,
    })
    return result.thread.id
  }

  async turnStart(threadId: string, text: string): Promise<string> {
    const result = await this.request<TurnStartResponse>('turn/start', {
      threadId,
      input: [{ type: 'text', text, text_elements: [] }],
    })
    return result.turn.id
  }

  async turnInterrupt(threadId: string, turnId: string): Promise<void> {
    await this.request('turn/interrupt', { threadId, turnId })
  }

  onNotification(listener: (notification: { method: string; params?: unknown }) => void): void {
    this.emitter.on('notification', listener)
  }

  private request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    if (!this.peer) return Promise.reject(new Error('Codex app-server is not running'))
    return this.peer.request<T>(method, params)
  }

  private acceptChunk(chunk: string): void {
    this.lineBuf += chunk
    let nl: number
    while ((nl = this.lineBuf.indexOf('\n')) >= 0) {
      const line = this.lineBuf.slice(0, nl)
      this.lineBuf = this.lineBuf.slice(nl + 1)
      this.peer?.acceptLine(line)
    }
  }
}
```

- [ ] **Step 10.2: Compile**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 10.3: Commit**

```powershell
git add electron/agent/codex-app-server.ts
git commit -m "feat(codex): connect to app-server over stdio"
```

### Task 11: Agent Manager

**Files:**
- Create: `electron/agent/manager.ts`
- Create: `tests/agent-manager.test.ts`

- [ ] **Step 11.1: Write manager tests first**

Create `tests/agent-manager.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { AgentManager } from '../electron/agent/manager'
import type { AgentSession } from '../electron/agent/session'
import type { AgentBackendId } from '../src/shared/config'

function fakeBackend(id: AgentBackendId): AgentSession {
  return {
    id,
    isRunning: vi.fn(() => false),
    isBusy: vi.fn(() => false),
    history: vi.fn(() => []),
    start: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
    setCallbacks: vi.fn(),
  }
}

describe('AgentManager', () => {
  it('starts only the selected backend lazily on send', async () => {
    const codex = fakeBackend('codex')
    const claude = fakeBackend('claude')
    const manager = new AgentManager(() => 'codex', { codex, claude })
    manager.send('hello')
    await Promise.resolve()
    expect(codex.start).toHaveBeenCalled()
    expect(codex.send).toHaveBeenCalledWith('hello')
    expect(claude.send).not.toHaveBeenCalled()
  })

  it('terminates previous backend when switching', async () => {
    const codex = fakeBackend('codex')
    const claude = fakeBackend('claude')
    const manager = new AgentManager(() => 'codex', { codex, claude })
    await manager.switchTo('claude')
    expect(codex.terminate).toHaveBeenCalled()
    expect(claude.start).toHaveBeenCalled()
  })

  it('delegates clear to active backend', async () => {
    const codex = fakeBackend('codex')
    const claude = fakeBackend('claude')
    const manager = new AgentManager(() => 'codex', { codex, claude })
    await manager.clear()
    expect(codex.clear).toHaveBeenCalled()
  })
})
```

- [ ] **Step 11.2: Run failing manager tests**

Run:

```powershell
npm test -- tests/agent-manager.test.ts
```

Expected: FAIL because manager does not exist.

- [ ] **Step 11.3: Implement manager**

Create `electron/agent/manager.ts`:

```ts
import type { AgentBackendId } from '../../src/shared/config'
import type { AgentMessage } from '../../src/shared/messages'
import type { AgentSession, AgentSessionCallbacks } from './session'

export class AgentManager implements AgentSession {
  private cb: Partial<AgentSessionCallbacks> = {}
  private activeId: AgentBackendId | null = null

  constructor(
    private getSelectedBackend: () => AgentBackendId,
    private backends: Record<AgentBackendId, AgentSession>,
  ) {}

  get id(): AgentBackendId { return this.active().id }
  isRunning(): boolean { return this.active().isRunning() }
  isBusy(): boolean { return this.active().isBusy() }
  history(): AgentMessage[] { return this.active().history() }

  async start(): Promise<void> {
    await this.activate(this.getSelectedBackend())
  }

  send(message: string): void {
    void this.sendAsync(message)
  }

  private async sendAsync(message: string): Promise<void> {
    const backend = this.active()
    if (!backend.isRunning()) await backend.start()
    backend.send(message)
  }

  async clear(): Promise<void> {
    await this.active().clear()
  }

  terminate(): void {
    for (const backend of Object.values(this.backends)) backend.terminate()
    this.activeId = null
  }

  setCallbacks(cb: Partial<AgentSessionCallbacks>): void {
    this.cb = { ...this.cb, ...cb }
    for (const backend of Object.values(this.backends)) backend.setCallbacks(this.cb)
  }

  async switchTo(id: AgentBackendId): Promise<void> {
    await this.activate(id)
  }

  activeBackendId(): AgentBackendId {
    return this.active().id
  }

  private active(): AgentSession {
    const id = this.activeId ?? this.getSelectedBackend()
    const backend = this.backends[id]
    if (this.activeId !== id) {
      this.activeId = id
      backend.setCallbacks(this.cb)
    }
    return backend
  }

  private async activate(id: AgentBackendId): Promise<void> {
    if (this.activeId && this.activeId !== id) this.backends[this.activeId].terminate()
    this.activeId = id
    const backend = this.backends[id]
    backend.setCallbacks(this.cb)
    await backend.start()
  }
}
```

- [ ] **Step 11.4: Run manager tests**

Run:

```powershell
npm test -- tests/agent-manager.test.ts
```

Expected: PASS.

- [ ] **Step 11.5: Commit**

```powershell
git add electron/agent/manager.ts tests/agent-manager.test.ts
git commit -m "feat(agent): manage switchable AI backends"
```

---

## Stage 4: App Wiring and UI

### Task 12: Main Process Wiring

**Files:**
- Modify: `electron/main.ts`
- Modify: `electron/ipc.ts`

- [ ] **Step 12.1: Wire manager in main**

In `electron/main.ts`, replace the single `ClaudeSession` construction with:

```ts
import { AgentManager } from './agent/manager'
import { CodexBackend } from './agent/codex'
import { CodexAppServerClient } from './agent/codex-app-server'
```

After `const historyStore = ...`, add:

```ts
const snapshot = configStore.snapshot()
const codexWorkdir = snapshot.codexWorkdir || path.join(app.getPath('userData'), 'codex-workdir')
fs.mkdirSync(codexWorkdir, { recursive: true })
const claude = new ClaudeSession(workdir)
const codex = new CodexBackend(new CodexAppServerClient(), {
  workdir: codexWorkdir,
  threadId: snapshot.codexThreadId,
  idleTimeoutMs: snapshot.codexIdleTimeoutMs,
  saveThreadId: (threadId) => configStore.update({ codexThreadId: threadId }),
})
session = new AgentManager(
  () => configStore.snapshot().agentBackend,
  { codex, claude },
)
```

Do not call `await session.start()` immediately. This preserves lazy startup. Remove the old eager `await session.start()` call.

- [ ] **Step 12.2: Update IPC clear and settings behavior**

In `electron/ipc.ts`, import `AgentManager`:

```ts
import type { AgentManager } from './agent/manager'
```

Change `session` parameter type from `AgentSession` to `AgentSession | AgentManager`.

In `settings:set`, after `const snap = config.update(patch)`, add:

```ts
if (patch.agentBackend !== undefined && 'switchTo' in session) {
  await session.switchTo(snap.agentBackend)
}
```

Replace slash clear body with:

```ts
sessionReady = false
windows.dialog.webContents.send('dialog:session-ready', false)
await session.clear()
```

- [ ] **Step 12.3: Compile**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 12.4: Commit**

```powershell
git add electron/main.ts electron/ipc.ts
git commit -m "feat(agent): wire AgentManager into Electron main"
```

### Task 13: Backend and Workdir IPC

**Files:**
- Modify: `electron/ipc.ts`
- Modify: `src/dialog/App.tsx`

- [ ] **Step 13.1: Add IPC handlers**

In `electron/ipc.ts`, add handlers:

```ts
ipcMain.handle('agent:get-backend', () => config.snapshot().agentBackend)

ipcMain.handle('agent:set-backend', async (_event, backend: ConfigSnapshot['agentBackend']) => {
  const snap = config.update({ agentBackend: backend })
  if ('switchTo' in session) await session.switchTo(backend)
  return snap.agentBackend
})

ipcMain.handle('agent:get-workdir', () => {
  const snap = config.snapshot()
  return snap.codexWorkdir || path.join(app.getPath('userData'), 'codex-workdir')
})

ipcMain.handle('agent:set-workdir', async (_event, workdir: string) => {
  const resolved = path.resolve(workdir)
  fs.mkdirSync(resolved, { recursive: true })
  config.update({ codexWorkdir: resolved, codexThreadId: '' })
  if (config.snapshot().agentBackend === 'codex') await session.clear()
  return resolved
})
```

Add imports:

```ts
import * as fs from 'node:fs'
import * as path from 'node:path'
```

- [ ] **Step 13.2: Handle slash commands in dialog**

In `src/dialog/App.tsx`, extend the slash branch:

```ts
} else if (slash.cmd === 'backend') {
  if (!slash.backend) {
    window.jpt.invoke<string>('agent:get-backend').then((backend) => {
      setMsgs((p) => [...p, { role: 'assistant', text: `当前后端：${backend}` }])
    })
  } else {
    window.jpt.invoke<string>('agent:set-backend', slash.backend).then((backend) => {
      setReady(false)
      setMsgs((p) => [...p, { role: 'assistant', text: `已切到 ${backend}。` }])
    })
  }
} else if (slash.cmd === 'workdir') {
  if (!slash.path) {
    window.jpt.invoke<string>('agent:get-workdir').then((workdir) => {
      setMsgs((p) => [...p, { role: 'assistant', text: `Codex 工作目录：${workdir}` }])
    })
  } else {
    window.jpt.invoke<string>('agent:set-workdir', slash.path).then((workdir) => {
      setReady(false)
      setMsgs((p) => [...p, { role: 'assistant', text: `Codex 工作目录已设为：${workdir}` }])
    })
  }
}
```

- [ ] **Step 13.3: Compile**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 13.4: Commit**

```powershell
git add electron/ipc.ts src/dialog/App.tsx
git commit -m "feat(dialog): add backend and workdir commands"
```

### Task 14: Settings UI

**Files:**
- Modify: `src/settings/App.tsx`

- [ ] **Step 14.1: Add backend selector**

In `src/settings/App.tsx`, after the title, insert:

```tsx
<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
  <span>AI 后端</span>
  <select
    value={cfg.agentBackend}
    onChange={(e) => update({ agentBackend: e.target.value as ConfigSnapshot['agentBackend'] })}
    style={inputStyle}
  >
    <option value="codex">Codex</option>
    <option value="claude">Claude</option>
  </select>
</label>

<label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
  <span>Codex 工作目录</span>
  <input
    value={cfg.codexWorkdir}
    onChange={(e) => update({ codexWorkdir: e.target.value })}
    placeholder="%APPDATA%\\JPT\\codex-workdir"
    style={inputStyle}
  />
</label>

<div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
  Codex 默认完整 agent；JPT 固定阻止删除整个文件。空闲 20 分钟后会回收 Codex 后端。
</div>
```

- [ ] **Step 14.2: Compile**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 14.3: Commit**

```powershell
git add src/settings/App.tsx
git commit -m "feat(settings): expose Codex backend controls"
```

---

## Stage 5: Final Verification and Acceptance

### Task 15: Full Automated Verification

**Files:**
- No source edits unless verification exposes a failure.

- [ ] **Step 15.1: Run all tests**

Run:

```powershell
npm test
```

Expected: all test files pass.

- [ ] **Step 15.2: Run production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite builds succeed.

- [ ] **Step 15.3: Commit verification-only fixes if needed**

If Step 15.1 or Step 15.2 exposed a fix, make the smallest source edit that directly addresses the failure, rerun the failing command, then commit the exact files shown by `git status --short` for that fix:

```powershell
git status --short
git add electron/agent/session.ts electron/agent/claude.ts electron/agent/shell-env.ts electron/agent/codex-protocol.ts electron/agent/codex-jsonrpc.ts electron/agent/codex-guard.ts electron/agent/codex-event-mapper.ts electron/agent/codex.ts electron/agent/codex-app-server.ts electron/agent/manager.ts electron/ipc.ts electron/main.ts src/shared/config.ts src/dialog/slash.ts src/dialog/App.tsx src/settings/App.tsx tests/config-store.test.ts tests/slash.test.ts tests/shell-env.test.ts tests/codex-jsonrpc.test.ts tests/codex-guard.test.ts tests/codex-event-mapper.test.ts tests/codex-backend.test.ts tests/agent-manager.test.ts
git commit -m "fix(codex): final integration fixes"
```

If none of those files changed, do not run the commit command.

### Task 16: Manual Smoke Test

**Files:**
- Create or update: `docs/codex-backend-acceptance.md`

- [ ] **Step 16.1: Run app**

Run:

```powershell
npm run dev
```

Expected:

- App launches.
- Character appears.
- Dialog opens on character click.
- Input is usable.

- [ ] **Step 16.2: Verify default backend**

In the dialog, type:

```text
/backend
```

Expected dialog reply:

```text
当前后端：codex
```

- [ ] **Step 16.3: Verify Codex workdir**

In the dialog, type:

```text
/workdir
```

Expected: JPT displays a Codex work directory. If no directory was configured, it should be under `%APPDATA%\JPT\codex-workdir`.

- [ ] **Step 16.4: Verify Codex reply**

Type:

```text
你好，简单介绍一下你现在用的后端。
```

Expected: A natural-language response streams into the dialog.

- [ ] **Step 16.5: Verify backend switch**

Type:

```text
/backend claude
```

Expected: dialog says `已切到 claude。`

Then type:

```text
/backend codex
```

Expected: dialog says `已切到 codex。`

- [ ] **Step 16.6: Verify deletion guard**

Set a disposable workdir:

```text
/workdir C:\Users\LeoinTube\JPT\.tmp-codex-guard-test
```

Ask:

```text
创建一个 test.txt，然后删除它。
```

Expected:

- File creation may happen.
- Whole-file deletion is blocked.
- Dialog shows `这个操作会删除整个文件，我先停住了。`

- [ ] **Step 16.7: Write acceptance log**

Create `docs/codex-backend-acceptance.md`:

```md
# Codex Backend Acceptance

Source spec: docs/superpowers/specs/2026-05-19-codex-backend-design.md
Source plan: docs/superpowers/plans/2026-05-19-codex-backend.md

- [ ] npm test passes
- [ ] npm run build passes
- [ ] default backend is Codex
- [ ] /backend reports current backend
- [ ] /backend claude switches to Claude
- [ ] /backend codex switches back to Codex
- [ ] /workdir reports Codex workdir
- [ ] /workdir C:\path\to\project updates Codex workdir
- [ ] Codex streams natural-language replies
- [ ] whole-file deletion is blocked
- [ ] normal editing remains allowed
- [ ] idle reclaim and resume checked
```

- [ ] **Step 16.8: Commit acceptance log**

```powershell
git add docs/codex-backend-acceptance.md
git commit -m "docs: Codex backend acceptance log"
```

## Plan Self-Review Checklist

- Spec coverage:
  - Dual backend default Codex: Tasks 1, 11, 12, 13, 14.
  - Configurable workdir: Tasks 1, 13, 14, 16.
  - Long-lived Codex app-server: Tasks 5, 6, 9, 10.
  - Lazy start and single active backend: Tasks 9, 11, 12.
  - Idle reclaim: Task 9.
  - Resume saved thread: Task 9.
  - No whole-file deletion: Tasks 7, 8, 10, 16.
  - Chat-like dialog: Tasks 8, 13.
  - Tests and build: Tasks 1-16.
- Placeholder scan: no unresolved placeholders remain in the plan.
- Type consistency:
  - `AgentBackendId` is defined in `src/shared/config.ts`.
  - `AgentSession.clear()` is added before manager and IPC use it.
  - `CodexAppServerLike` is defined before fake-client tests use it.
  - Slash command types match dialog usage.
