import { app } from 'electron'
import { createWindows, JPTWindows } from './window-manager'
import { registerIpcHandlers } from './ipc'

let windows: JPTWindows | null = null

app.whenReady().then(() => {
  windows = createWindows()
  registerIpcHandlers(windows)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  windows?.character.destroy()
  windows?.dialog.destroy()
})
