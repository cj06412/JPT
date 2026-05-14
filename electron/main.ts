import { app } from 'electron'
import { createWindows, JPTWindows } from './window-manager'
import { registerIpcHandlers } from './ipc'
import { ClaudeSession } from './agent/claude'

let windows: JPTWindows | null = null
let session: ClaudeSession | null = null

app.whenReady().then(async () => {
  windows = createWindows()
  session = new ClaudeSession()
  registerIpcHandlers(windows, session)
  await session.start()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  session?.terminate()
  windows?.character.destroy()
  windows?.dialog.destroy()
})
