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
const STDERR_BUFFER_CAP = 8192

export class ClaudeSession implements AgentSession {
  readonly id = 'claude' as const
  private proc: ChildProcess | null = null
  private buffer = new NdjsonBuffer()
  private running = false
  private busy = false
  private currentResponseText = ''
  private msgs: AgentMessage[] = []
  private cb: Partial<AgentSessionCallbacks> = {}
  private stderrBuf = ''
  private readyFired = false

  constructor(private workdir: string) {}

  isRunning() { return this.running }
  isBusy() { return this.busy }
  history(): AgentMessage[] { return [...this.msgs] }

  setCallbacks(cb: Partial<AgentSessionCallbacks>) {
    this.cb = { ...this.cb, ...cb }
  }

  async start(): Promise<void> {
    if (this.running || this.proc) return // idempotent — don't orphan an existing child
    this.readyFired = false

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
      // PERSONA ISOLATION — every flag below keeps JPT from inheriting whatever
      // the user's Claude Code install has accumulated (CLAUDE.md memory files,
      // skills plugins, MCP servers, hooks). All persona must come from
      // workdir/CLAUDE.md (loaded automatically because cwd=workdir).
      '--setting-sources', 'project,local', // skip ~/.claude/settings.json + ~/.claude/CLAUDE.md
      '--strict-mcp-config',                 // refuse to load user-level MCP servers
      '--model', 'claude-opus-4-7',
    ]

    // Windows-specific: spawn() refuses to execute .cmd / .bat scripts directly.
    // npm-installed claude is a `claude.cmd` shim, so we need shell:true on Windows
    // when the resolved binary is a batch file. Without this, spawn throws EINVAL
    // or hangs silently.
    // cwd: this.workdir — Claude Code auto-loads <cwd>/CLAUDE.md as its system
    // prompt. Running with cwd=workdir ensures the persona placeholder loads,
    // NOT whatever CLAUDE.md happens to be in the dev repo / app install dir.
    const isBatch = /\.(cmd|bat)$/i.test(binary)
    const proc = spawn(binary, args, {
      env: { ...process.env, TERM: 'dumb' },
      cwd: this.workdir,
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
      // Claude CLI writes non-fatal warnings to stderr (rate-limit info, model fallback notices,
      // etc). Buffering quietly avoids interrupting the UI with red error bubbles mid-stream;
      // we surface the buffer only if the process exits with non-zero code or errors out.
      this.stderrBuf += chunk
      if (this.stderrBuf.length > STDERR_BUFFER_CAP) {
        this.stderrBuf = this.stderrBuf.slice(-STDERR_BUFFER_CAP)
      }
    })

    proc.on('spawn', () => {
      // Process is up and stdin is writable — that's "ready". Do NOT wait for
      // the first stdout event: claude CLI 2.1.x in `-p` stream-json mode emits
      // nothing until it receives the first user message, so gating readiness
      // on stdout deadlocks the dialog ("准备中" forever, input disabled, so the
      // first message can never be sent). The stdout path below is kept as an
      // idempotent fallback.
      if (!this.readyFired) {
        this.readyFired = true
        this.cb.onSessionReady?.()
      }
    })

    proc.on('error', (err) => {
      // spawn-time failures (ENOENT race, EACCES, etc.); without this listener Node treats
      // the error as unhandled and crashes the Electron main process.
      this.cb.onError?.(`Failed to launch Claude CLI: ${err.message}`)
      this.running = false
      this.busy = false
    })

    proc.on('exit', (code) => {
      this.running = false
      this.busy = false
      if (code !== 0 && code !== null) {
        const stderr = this.stderrBuf.trim()
        if (stderr) this.cb.onError?.(`Claude exited with code ${code}:\n${stderr}`)
      }
      this.stderrBuf = ''
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

  async clear(): Promise<void> {
    this.terminate()
    this.msgs = []
    await this.start()
  }

  terminate(): void {
    this.proc?.kill()
    this.proc = null
    this.running = false
    this.busy = false
  }

  private handleEvent(ev: Record<string, unknown>): void {
    const type = ev.type as string

    // First stdout event = session is alive. Claude CLI 2.1.x emits
    // `system + subtype:hook_started/hook_response` during startup; older
    // versions emitted `system + subtype:init`. Either way, the very first
    // event from Claude means the session has spawned and is processing —
    // safe to unlock the dialog input.
    if (!this.readyFired) {
      this.readyFired = true
      this.cb.onSessionReady?.()
    }

    if (type === 'system' && ev.subtype === 'init') {
      return
    }

    if (type === 'assistant') {
      const message = ev.message as { content?: Array<Record<string, unknown>> } | undefined
      const blocks = message?.content ?? []
      for (const block of blocks) {
        if (block.type === 'text' && typeof block.text === 'string') {
          this.currentResponseText += block.text
          this.cb.onText?.(block.text)
        } else if (block.type === 'tool_use' && typeof block.name === 'string') {
          // Summarize the tool input compactly for the SDV scroll card.
          const input = block.input as Record<string, unknown> | null | undefined
          const summary = summarizeToolInput(block.name, input)
          this.cb.onToolUse?.(block.name, summary)
        }
      }
      return
    }

    if (type === 'user') {
      // Claude streams tool results back as a user-role message whose content
      // is an array of tool_result blocks. A plain-string content here is the
      // outbound echo of our own send() frame — skip it.
      const message = ev.message as { content?: unknown } | undefined
      const rawContent = message?.content
      if (!Array.isArray(rawContent)) return
      for (const block of rawContent as Array<Record<string, unknown>>) {
        if (block.type === 'tool_result') {
          const isError = block.is_error === true
          const raw = block.content
          let summary: string
          if (typeof raw === 'string') {
            summary = raw
          } else if (Array.isArray(raw)) {
            summary = raw
              .map((b) => (b && typeof b === 'object' && typeof (b as Record<string, unknown>).text === 'string'
                ? (b as Record<string, unknown>).text as string
                : ''))
              .join('')
          } else {
            summary = ''
          }
          const trimmed = summary.trim().slice(0, 280)
          this.cb.onToolResult?.(trimmed, isError)
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

/**
 * Compact one-line description of a tool call for the dialog scroll card.
 * WebSearch → the query; WebFetch → the URL; TodoWrite → "更新进度";
 * anything else → the tool name.
 */
function summarizeToolInput(tool: string, input: Record<string, unknown> | null | undefined): string {
  if (!input) return tool
  if (tool === 'WebSearch' && typeof input.query === 'string') return `搜「${input.query}」`
  if (tool === 'WebFetch' && typeof input.url === 'string') return `打开 ${input.url}`
  if (tool === 'TodoWrite') return '更新进度'
  return tool
}
