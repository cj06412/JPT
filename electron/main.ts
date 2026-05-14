import { app, Tray, BrowserWindow } from 'electron'
import Store from 'electron-store'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createWindows, JPTWindows, createWelcomeWindow } from './window-manager'
import { registerIpcHandlers, toggleDialog, openSettingsWindow } from './ipc'
import { ClaudeSession } from './agent/claude'
import { ensureWorkdir } from './agent/workdir'
import { ConfigStore } from './config-store'
import { HistoryStore } from './history-store'
import { createTray, trayIconPath } from './tray'
import { setupAutoUpdates, manualCheck } from './updater'
import type { ConfigSnapshot } from '../src/shared/config'

// Windows 11 + transparent BrowserWindow + GPU acceleration = renderer paints but compositor
// drops the pixels, leaving the window invisible. Disabling HW acceleration forces software
// composition which paints transparent windows correctly. Must be called before whenReady.
app.disableHardwareAcceleration()

const rawStore = new Store<ConfigSnapshot>()
const configStore = new ConfigStore(rawStore)

let windows: JPTWindows | null = null
let session: ClaudeSession | null = null
let tray: Tray | null = null
let welcomeWin: BrowserWindow | null = null

app.whenReady().then(async () => {
  windows = createWindows()
  const workdir = ensureWorkdir(app.getPath('userData'))
  const historyStore = new HistoryStore(app.getPath('userData'))
  session = new ClaudeSession(workdir)
  registerIpcHandlers(windows, session, configStore, historyStore, {
    closeWelcome: () => { welcomeWin?.close() },
  })
  await session.start()

  setupAutoUpdates()

  tray = createTray({
    iconPath: trayIconPath(),
    toggleDialog: () => toggleDialog(windows!),
    openSettings: () => openSettingsWindow(),
    checkForUpdates: manualCheck,
  })

  // First-run welcome letter — write a marker so it only shows once per user
  const firstRunMarker = path.join(app.getPath('userData'), '.first-run-shown')
  if (!fs.existsSync(firstRunMarker)) {
    welcomeWin = createWelcomeWindow()
    welcomeWin.on('closed', () => { welcomeWin = null })
    fs.writeFileSync(firstRunMarker, new Date().toISOString(), 'utf-8')
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  tray?.destroy()
  session?.terminate()
  windows?.character.destroy()
  windows?.dialog.destroy()
})
