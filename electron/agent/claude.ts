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
  private proc: ChildProcess | null = null
  private buffer = new NdjsonBuffer()
  private running = false
  private busy = false
  private currentResponseText = ''
  private msgs: AgentMessage[] = []
  private cb: Partial<AgentSessionCallbacks> = {}
  private stderrBuf = ''

  constructor(private workdir: string) {}

  isRunning() { return this.running }
  isBusy() { return this.busy }
  history(): AgentMessage[] { return [...this.msgs] }

  setCallbacks(cb: Partial<AgentSessionCallbacks>) {
    this.cb = { ...this.cb, ...cb }
  }

  async start(): Promise<void> {
    if (this.running || this.proc) return // idempotent — don't orphan an existing child

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
      '--add-dir', this.workdir,
      '--model', 'claude-opus-4-7',
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
      // Claude CLI writes non-fatal warnings to stderr (rate-limit info, model fallback notices,
      // etc). Buffering quietly avoids interrupting the UI with red error bubbles mid-stream;
      // we surface the buffer only if the process exits with non-zero code or errors out.
      this.stderrBuf += chunk
      if (this.stderrBuf.length > STDERR_BUFFER_CAP) {
        this.stderrBuf = this.stderrBuf.slice(-STDERR_BUFFER_CAP)
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
