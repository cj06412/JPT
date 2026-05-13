import { ipcMain } from 'electron'
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
