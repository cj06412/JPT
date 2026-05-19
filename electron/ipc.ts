import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'node:path'
import { activeDisplay, CHARACTER_H, CHARACTER_W, createSettingsWindow, DIALOG_H, DIALOG_W, floorGeometry } from './window-manager'
import { applyCodexWorkdirChange } from './agent/codex-workdir'
import { writePersona } from './agent/workdir'
import type { AgentManager } from './agent/manager'
import type { AgentSession } from './agent/session'
import type { ConfigStore } from './config-store'
import type { HistoryStore } from './history-store'
import type { JPTWindows } from './window-manager'
import type { ConfigSnapshot } from '../src/shared/config'

const settingsState: { instance: BrowserWindow | null } = { instance: null }

export function openSettingsWindow() {
  if (settingsState.instance && !settingsState.instance.isDestroyed()) {
    settingsState.instance.focus()
    return
  }
  settingsState.instance = createSettingsWindow()
  settingsState.instance.on('closed', () => { settingsState.instance = null })
}

export function toggleDialog(windows: JPTWindows) {
  if (windows.dialog.isVisible()) {
    windows.dialog.hide()
    windows.character.webContents.send('character:dialog-visibility', false)
    return
  }
  const charBounds = windows.character.getBounds()
  const { workArea } = activeDisplay()
  let x = charBounds.x + charBounds.width + 10
  let y = charBounds.y - DIALOG_H + charBounds.height
  if (x + DIALOG_W > workArea.x + workArea.width) {
    x = charBounds.x - DIALOG_W - 10
  }
  if (y < workArea.y) y = workArea.y
  windows.dialog.setBounds({ x, y, width: DIALOG_W, height: DIALOG_H })
  windows.dialog.show()
  windows.dialog.focus()
  windows.character.webContents.send('character:dialog-visibility', true)
}

export interface IpcCallbacks {
  closeWelcome: () => void
}

export function registerIpcHandlers(
  windows: JPTWindows,
  session: AgentSession | AgentManager,
  config: ConfigStore,
  history: HistoryStore,
  callbacks: IpcCallbacks,
) {
  let sessionReady = isAgentManager(session)

  const setSessionReady = (ready: boolean) => {
    sessionReady = ready
    windows.dialog.webContents.send('dialog:session-ready', ready)
  }

  const surfaceError = (error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error)
    windows.dialog.webContents.send('dialog:error', msg)
    history.append({ ts: Date.now(), role: 'error', text: msg })
  }

  ipcMain.handle('agent:is-ready', () => sessionReady)

  ipcMain.handle('settings:get', () => config.snapshot())
  ipcMain.handle('settings:set', async (_event, patch: Partial<ConfigSnapshot>) => {
    const { codexWorkdir, ...storePatch } = patch
    let snap = config.update(storePatch)
    if (patch.soundsEnabled !== undefined) {
      windows.dialog.webContents.send('settings:sounds-changed', snap.soundsEnabled)
    }
    if (patch.agentBackend !== undefined && isAgentManager(session)) {
      setSessionReady(false)
      try {
        await session.switchTo(snap.agentBackend)
      } catch (e) {
        surfaceError(e)
        setSessionReady(true)
      }
    }
    if (codexWorkdir !== undefined) {
      const activeCodex = !isAgentManager(session) || session.activeBackendId() === 'codex'
      if (activeCodex) setSessionReady(false)
      try {
        await applyCodexWorkdirChange(codexWorkdir, app.getPath('userData'), config, session)
        snap = config.snapshot()
      } catch (e) {
        surfaceError(e)
        if (activeCodex) setSessionReady(true)
        throw e
      }
    }
    if (patch.personaDoc !== undefined) {
      const changed = writePersona(app.getPath('userData'), snap.personaDoc)
      if (changed && (!isAgentManager(session) || session.activeBackendId() === 'claude')) {
        setSessionReady(false)
        await session.clear()
      }
    }
    return snap
  })

  ipcMain.handle('agent:get-backend', () => config.snapshot().agentBackend)

  ipcMain.handle('agent:set-backend', async (_event, backend: ConfigSnapshot['agentBackend']) => {
    const snap = config.update({ agentBackend: backend })
    if (isAgentManager(session)) {
      setSessionReady(false)
      try {
        await session.switchTo(backend)
      } catch (e) {
        surfaceError(e)
        setSessionReady(true)
      }
    }
    return snap.agentBackend
  })

  ipcMain.handle('agent:get-workdir', () => {
    const snap = config.snapshot()
    return snap.codexWorkdir || path.join(app.getPath('userData'), 'codex-workdir')
  })

  ipcMain.handle('agent:set-workdir', async (_event, workdir: string) => {
    const activeCodex = !isAgentManager(session) || session.activeBackendId() === 'codex'
    if (activeCodex) setSessionReady(false)
    try {
      return await applyCodexWorkdirChange(workdir, app.getPath('userData'), config, session)
    } catch (e) {
      surfaceError(e)
      if (activeCodex) setSessionReady(true)
      throw e
    }
  })

  ipcMain.on('character:set-position', (_event, x: number, y: number) => {
    windows.character.setBounds({ x: Math.round(x), y: Math.round(y), width: CHARACTER_W, height: CHARACTER_H })
  })

  ipcMain.handle('character:get-walk-bounds', () => floorGeometry())

  ipcMain.on('character:click', () => toggleDialog(windows))

  ipcMain.on('settings:open', () => openSettingsWindow())

  ipcMain.on('welcome:close', () => callbacks.closeWelcome())

  ipcMain.on('dialog:close', () => {
    windows.dialog.hide()
    windows.character.webContents.send('character:dialog-visibility', false)
  })

  ipcMain.on('dialog:user-send', (_event, message: string) => {
    history.append({ ts: Date.now(), role: 'user', text: message })
    session.send(message)
  })

  ipcMain.on('dialog:slash-clear', async () => {
    setSessionReady(false)
    await session.clear()
  })

  session.setCallbacks({
    onSessionReady: () => {
      setSessionReady(true)
    },
    onText: (chunk) => {
      windows.dialog.webContents.send('dialog:stream-token', chunk)
    },
    onTurnComplete: () => {
      windows.dialog.webContents.send('dialog:turn-complete')
      const last = session.history().at(-1)
      if (last && last.role === 'assistant') {
        history.append({ ts: Date.now(), role: 'assistant', text: last.text })
      }
    },
    onError: (msg) => {
      windows.dialog.webContents.send('dialog:error', msg)
      history.append({ ts: Date.now(), role: 'error', text: msg })
    },
    onToolUse: (tool, summary) => {
      windows.dialog.webContents.send('dialog:tool-use', { tool, summary })
      history.append({ ts: Date.now(), role: 'toolUse', tool, summary })
    },
    onToolResult: (summary, isError) => {
      windows.dialog.webContents.send('dialog:tool-result', { summary, isError })
      history.append({ ts: Date.now(), role: 'toolResult', summary, isError })
    },
    onProcessExit: () => {
      sessionReady = isAgentManager(session)
    },
  })
}

function isAgentManager(session: AgentSession | AgentManager): session is AgentManager {
  return 'switchTo' in session
}
