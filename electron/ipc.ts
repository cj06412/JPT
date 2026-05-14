import { ipcMain, screen } from 'electron'
import { CHARACTER_W, CHARACTER_H, DIALOG_W, DIALOG_H } from './window-manager'
import type { JPTWindows } from './window-manager'
import type { AgentSession } from './agent/session'

export function registerIpcHandlers(windows: JPTWindows, session: AgentSession) {
  let sessionReady = false

  // Renderer queries current ready state on mount (covers the race where the
  // system/init event fired before the dialog renderer registered its listener).
  ipcMain.handle('agent:is-ready', () => sessionReady)

  // Character → main: position update
  ipcMain.on('character:set-position', (_event, x: number, y: number) => {
    // setBounds (not setPosition) — Electron on Win11 with transparent windows has a known issue
    // where setPosition silently grows the window by 1px on each call. setBounds with explicit
    // width/height every frame prevents the drift.
    windows.character.setBounds({ x: Math.round(x), y: Math.round(y), width: CHARACTER_W, height: CHARACTER_H })
  })

  // Character → main: walk bounds query
  ipcMain.handle('character:get-walk-bounds', () => {
    const display = screen.getPrimaryDisplay()
    const { workArea } = display
    return {
      leftBound: workArea.x,
      rightBound: workArea.x + workArea.width - CHARACTER_W,
      floorY: workArea.y + workArea.height - CHARACTER_H,
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
    let x = charBounds.x + charBounds.width + 10
    let y = charBounds.y - DIALOG_H + charBounds.height
    if (x + DIALOG_W > workArea.x + workArea.width) {
      x = charBounds.x - DIALOG_W - 10
    }
    if (y < workArea.y) y = workArea.y
    windows.dialog.setBounds({ x, y, width: DIALOG_W, height: DIALOG_H })
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
    onSessionReady: () => {
      sessionReady = true
      windows.dialog.webContents.send('dialog:session-ready')
    },
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
      sessionReady = false
      // ClaudeSession already surfaces non-zero exits via onError with the
      // accumulated stderr; this event is left informational so the renderer
      // could disable input on a dead session, but no error bubble.
    },
  })
}
