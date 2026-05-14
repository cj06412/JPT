import { ipcMain, screen } from 'electron'
import type { JPTWindows } from './window-manager'
import type { AgentSession } from './agent/session'

export function registerIpcHandlers(windows: JPTWindows, session: AgentSession) {
  // Character → main: position update
  ipcMain.on('character:set-position', (_event, x: number, y: number) => {
    // setBounds (not setPosition) — Electron on Win11 with transparent windows has a known issue
    // where setPosition silently grows the window by 1px on each call. setBounds with explicit
    // width/height every frame prevents the drift.
    windows.character.setBounds({ x: Math.round(x), y: Math.round(y), width: 96, height: 128 })
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
