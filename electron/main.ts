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

// Chromium throttles rAF / setTimeout / setInterval in "background" or "occluded"
// renderers. Transparent windows get mis-classified as occluded and tank our
// walking animation. backgroundThrottling:false on the window is the primary
// fix; these app-level switches are a belt-and-suspenders backup.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

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
  // Character window stays visible during welcome. Every attempt to suppress
  // it (hide / setOpacity(0) / setBounds offscreen) broke Chromium's renderer
  // state — paint failed entirely OR rAF throttled and never resumed. Since
  // welcome is small + transparent and lives at screen center while the
  // character lives at bottom-left, they don't visually conflict much.
  // v1.5 follow-up: send an IPC to character renderer to render null while
  // welcome is up — that bypasses all window-state shenanigans.
  const firstRunMarker = path.join(app.getPath('userData'), '.first-run-shown')
  if (!fs.existsSync(firstRunMarker)) {
    welcomeWin = createWelcomeWindow()
    welcomeWin.on('closed', () => {
      welcomeWin = null
      try {
        fs.writeFileSync(firstRunMarker, new Date().toISOString(), 'utf-8')
      } catch (e) {
        console.error('[JPT] failed to write first-run marker:', e)
      }
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
