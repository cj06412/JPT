import { app } from 'electron'
import Store from 'electron-store'
import { createWindows, JPTWindows } from './window-manager'
import { registerIpcHandlers } from './ipc'
import { ClaudeSession } from './agent/claude'
import { ensureWorkdir } from './agent/workdir'
import { ConfigStore } from './config-store'
import type { ConfigSnapshot } from '../src/shared/config'

// Windows 11 + transparent BrowserWindow + GPU acceleration = renderer paints but compositor
// drops the pixels, leaving the window invisible. Disabling HW acceleration forces software
// composition which paints transparent windows correctly. Must be called before whenReady.
app.disableHardwareAcceleration()

const rawStore = new Store<ConfigSnapshot>()
const configStore = new ConfigStore(rawStore)

let windows: JPTWindows | null = null
let session: ClaudeSession | null = null

app.whenReady().then(async () => {
  windows = createWindows()
  const workdir = ensureWorkdir(app.getPath('userData'))
  session = new ClaudeSession(workdir)
  registerIpcHandlers(windows, session, configStore)
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
