import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { CodexJsonRpcPeer } from './codex-jsonrpc'
import { blocksClientRequest, deletionBlockMessage } from './codex-guard'
import { resolveCodexPath } from './shell-env'
import type { CodexAppServerLike } from './codex'
import type { JsonValue, ThreadResumeResponse, ThreadStartResponse, TurnStartResponse } from './codex-protocol'

const DELETE_GUARD_INSTRUCTIONS = `You may edit files, but you must not delete entire files or directories.
Do not run deletion commands such as rm, del, erase, rmdir, rd, or Remove-Item.
If a task appears to require deleting a file, explain the reason to the user instead of performing the deletion.`

export interface CodexThreadRequestParams {
  [key: string]: JsonValue
  cwd: string
  approvalPolicy: 'never'
  sandbox: 'danger-full-access'
  developerInstructions: string
}

export function codexThreadRequestParams(cwd: string): CodexThreadRequestParams {
  return {
    cwd,
    approvalPolicy: 'never',
    sandbox: 'danger-full-access',
    developerInstructions: DELETE_GUARD_INSTRUCTIONS,
  }
}

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
      this.emitter.emit('exit')
    })
    proc.on('error', (err) => {
      this.peer?.rejectAll(err.message)
      this.proc = null
      this.peer = null
      this.emitter.emit('exit')
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
    this.lineBuf = ''
  }

  async threadStart(params: { cwd: string }): Promise<string> {
    const result = await this.request<ThreadStartResponse>('thread/start', codexThreadRequestParams(params.cwd))
    return result.thread.id
  }

  async threadResume(threadId: string, params: { cwd: string }): Promise<string> {
    const result = await this.request<ThreadResumeResponse>('thread/resume', {
      threadId,
      ...codexThreadRequestParams(params.cwd),
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

  onExit(listener: () => void): void {
    this.emitter.on('exit', listener)
  }

  private request<T>(method: string, params: JsonValue): Promise<T> {
    if (!this.peer) return Promise.reject(new Error('Codex app-server is not running'))
    if (blocksClientRequest(method, params)) return Promise.reject(new Error(deletionBlockMessage()))
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
