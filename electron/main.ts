import { app, Tray, BrowserWindow, Menu, screen } from 'electron'
import Store from 'electron-store'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createWindows, JPTWindows, createWelcomeWindow } from './window-manager'
import { registerIpcHandlers, toggleDialog, openSettingsWindow } from './ipc'
import { ClaudeSession } from './agent/claude'
import { CodexAppServerClient } from './agent/codex-app-server'
import { CodexBackend } from './agent/codex'
import { AgentManager } from './agent/manager'
import { codexAgentsFileMatchesPersona, defaultCodexWorkdir, ensureWorkdir } from './agent/workdir'
import { ConfigStore } from './config-store'
import { HistoryStore } from './history-store'
import { createTray, trayIconPath } from './tray'
import { setupAutoUpdates, manualCheck } from './updater'
import { pickProactive, shouldFire } from './proactive'
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

// clearInvalidConfig: a corrupt/unparseable config.json (crashed write,
// concurrent writers, force-kill mid-write) must NOT brick the app — conf
// rethrows the JSON SyntaxError at construction otherwise, which crashes the
// whole main process with no recovery (fatal for a non-technical recipient).
// With this, an invalid config silently resets to defaults.
const rawStore = new Store<ConfigSnapshot>({ clearInvalidConfig: true })
const configStore = new ConfigStore(rawStore)

let windows: JPTWindows | null = null
let session: AgentManager | null = null
let tray: Tray | null = null
let welcomeWin: BrowserWindow | null = null

app.whenReady().then(async () => {
  windows = createWindows()
  const userDataPath = app.getPath('userData')
  const codexAgentsWasCurrent = codexAgentsFileMatchesPersona(userDataPath)
  const workdir = ensureWorkdir(userDataPath, configStore.snapshot().personaDoc)
  if (!codexAgentsWasCurrent && configStore.snapshot().codexThreadId) {
    configStore.update({ codexThreadId: '' })
  }
  const historyStore = new HistoryStore(userDataPath)
  const snapshot = configStore.snapshot()
  const codexWorkdir = snapshot.codexWorkdir || defaultCodexWorkdir(userDataPath)
  fs.mkdirSync(codexWorkdir, { recursive: true })
  const claude = new ClaudeSession(workdir)
  const codex = new CodexBackend(new CodexAppServerClient(), {
    workdir: codexWorkdir,
    threadId: snapshot.codexThreadId,
    idleTimeoutMs: snapshot.codexIdleTimeoutMs,
    saveThreadId: (threadId) => configStore.update({ codexThreadId: threadId }),
  })
  session = new AgentManager(
    () => configStore.snapshot().agentBackend,
    { codex, claude },
  )
  registerIpcHandlers(windows, session, configStore, historyStore, {
    closeWelcome: () => { welcomeWin?.close() },
  })

  // spec §3.2: clicking outside the dialog closes it. The dialog window
  // losing focus == user clicked elsewhere. Reuse the same close path as
  // Esc / character-click-toggle by faking a dialog:close.
  windows.dialog.on('blur', () => {
    if (windows && windows.dialog.isVisible()) {
      windows.dialog.hide()
      windows.character.webContents.send('character:dialog-visibility', false)
    }
  })

  // Proactive companionship: every 10 min check whether a nudge is due.
  // Only pushed when the dialog is already open (never pop a window at the
  // user unprompted — half-asleep midnight surprises are not the vibe).
  let lastProactive = Date.now()
  setInterval(() => {
    const cfg = configStore.snapshot()
    if (!shouldFire(cfg.proactiveMessages, lastProactive, Date.now())) return
    if (!windows || !windows.dialog.isVisible()) return
    const msg = pickProactive(new Date().getHours())
    if (!msg) return
    lastProactive = Date.now()
    windows.dialog.webContents.send('dialog:proactive', msg.text)
  }, 10 * 60_000)

  // Multi-screen / taskbar changes: tell the character to re-query its floor
  // geometry so it stays on the active (taskbar-bearing) display. spec §3.3.
  const refreshBounds = () => windows?.character.webContents.send('character:bounds-changed')
  screen.on('display-added', refreshBounds)
  screen.on('display-removed', refreshBounds)
  screen.on('display-metrics-changed', refreshBounds)

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
