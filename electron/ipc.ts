import { ipcMain, screen, BrowserWindow, app } from 'electron'
import { CHARACTER_W, CHARACTER_H, DIALOG_W, DIALOG_H, createSettingsWindow, floorGeometry } from './window-manager'
import { writePersona } from './agent/workdir'
import type { JPTWindows } from './window-manager'
import type { AgentSession } from './agent/session'
import type { ConfigStore } from './config-store'
import type { HistoryStore } from './history-store'
import type { ConfigSnapshot } from '../src/shared/config'

/** Single-instance settings window. Both the tray menu and the dialog renderer
 *  go through this to open settings. */
const settingsState: { instance: BrowserWindow | null } = { instance: null }

export function openSettingsWindow() {
  if (settingsState.instance && !settingsState.instance.isDestroyed()) {
    settingsState.instance.focus()
    return
  }
  settingsState.instance = createSettingsWindow()
  settingsState.instance.on('closed', () => { settingsState.instance = null })
}

/** Same logic as character:click — wired here so the tray can reuse it. */
export function toggleDialog(windows: JPTWindows) {
  if (windows.dialog.isVisible()) {
    windows.dialog.hide()
    windows.character.webContents.send('character:dialog-visibility', false)
    return
  }
  const charBounds = windows.character.getBounds()
  const { workArea } = screen.getPrimaryDisplay()
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
  session: AgentSession,
  config: ConfigStore,
  history: HistoryStore,
  callbacks: IpcCallbacks,
) {
  let sessionReady = false

  // Renderer queries current ready state on mount (covers the race where the
  // system/init event fired before the dialog renderer registered its listener).
  ipcMain.handle('agent:is-ready', () => sessionReady)

  // Settings IPC — renderer reads/writes config; main owns the file
  ipcMain.handle('settings:get', () => config.snapshot())
  ipcMain.handle('settings:set', async (_event, patch: Partial<ConfigSnapshot>) => {
    const snap = config.update(patch)
    if (patch.soundsEnabled !== undefined) {
      windows.dialog.webContents.send('settings:sounds-changed', snap.soundsEnabled)
    }
    if (patch.personaDoc !== undefined) {
      const changed = writePersona(app.getPath('userData'), snap.personaDoc)
      if (changed) {
        // Persona file changed — restart the Claude session so the new
        // CLAUDE.md is picked up on the next message.
        session.terminate()
        await session.start()
      }
    }
    return snap
  })

  // Character → main: position update.
  // setBounds (not setPosition) — Electron on Win11 with transparent windows
  // has a known issue where setPosition silently grows the window by 1px on
  // each call. setBounds with explicit width/height every frame prevents drift.
  ipcMain.on('character:set-position', (_event, x: number, y: number) => {
    windows.character.setBounds({ x: Math.round(x), y: Math.round(y), width: CHARACTER_W, height: CHARACTER_H })
  })

  // Character → main: walk bounds query (active screen + taskbar-autohide aware)
  ipcMain.handle('character:get-walk-bounds', () => floorGeometry())

  // Character → main: click toggles dialog
  ipcMain.on('character:click', () => toggleDialog(windows))

  // Renderer → main: open settings window (also reached via tray menu)
  ipcMain.on('settings:open', () => openSettingsWindow())

  // Welcome letter close (click anywhere on the letter)
  ipcMain.on('welcome:close', () => callbacks.closeWelcome())

  // Dialog → main: close request
  ipcMain.on('dialog:close', () => {
    windows.dialog.hide()
    windows.character.webContents.send('character:dialog-visibility', false)
  })

  // Dialog → main: send user message
  ipcMain.on('dialog:user-send', (_event, message: string) => {
    history.append({ ts: Date.now(), role: 'user', text: message })
    session.send(message)
  })

  // Dialog → main: /clear — reset Claude's conversation context.
  // Cheapest correct way: terminate + restart the session (it re-loads
  // workdir/CLAUDE.md persona fresh, no history replay).
  ipcMain.on('dialog:slash-clear', async () => {
    session.terminate()
    await session.start()
  })

  // Wire session callbacks → dialog renderer
  session.setCallbacks({
    onSessionReady: () => {
      sessionReady = true
      windows.dialog.webContents.send('dialog:session-ready')
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
      sessionReady = false
      // ClaudeSession already surfaces non-zero exits via onError with the
      // accumulated stderr; this event is left informational so the renderer
      // could disable input on a dead session, but no error bubble.
    },
  })
}
