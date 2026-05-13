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
