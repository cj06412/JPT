import { app, Tray, BrowserWindow, Menu } from 'electron'
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

// We never use Electron's default application menu (File / Edit / View / ...).
// Strip it globally so framed windows (welcome, settings) don't show the menubar.
Menu.setApplicationMenu(null)

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

  // First-run welcome letter — only mark "shown" AFTER the user actually
  // dismisses the letter (otherwise a stuck welcome would suppress itself
  // on relaunch and the user could never see the letter again).
  // Park character far off-screen during welcome — hide() pauses Chromium's
  // renderer (won't repaint on show) and setOpacity(0) had the same issue.
  // Off-screen-but-alive keeps the renderer painting normally; setBounds
  // back to the real position when welcome closes is just a position update,
  // not a visibility transition, so it doesn't trigger any paint pause.
  const OFFSCREEN_X = -2000
  const firstRunMarker = path.join(app.getPath('userData'), '.first-run-shown')
  if (!fs.existsSync(firstRunMarker)) {
    const restoreBounds = windows.character.getBounds()
    windows.character.setBounds({
      x: OFFSCREEN_X,
      y: restoreBounds.y,
      width: restoreBounds.width,
      height: restoreBounds.height,
    })
    welcomeWin = createWelcomeWindow()
    welcomeWin.on('closed', () => {
      welcomeWin = null
      try {
        fs.writeFileSync(firstRunMarker, new Date().toISOString(), 'utf-8')
      } catch (e) {
        console.error('[JPT] failed to write first-run marker:', e)
      }
      windows?.character.setBounds({
        x: 100,
        y: restoreBounds.y,
        width: restoreBounds.width,
        height: restoreBounds.height,
      })
    })
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
