import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(__dirname, '..', 'dist')

const PRELOAD_PATH = path.join(__dirname, 'preload.js')

// Window dimensions in DIP. Exported so ipc.ts can position the dialog with the
// same numbers without drift between createDialogWindow() and the click handler.
export const CHARACTER_W = 96
export const CHARACTER_H = 128
// Width matches the original dialog (720); height follows jpt-dialog.png's
// aspect ratio (3159×1080 ≈ 2.925:1) so the frame art isn't squished.
export const DIALOG_W = 720
export const DIALOG_H = 246

export interface JPTWindows {
  character: BrowserWindow
  dialog: BrowserWindow
}

/**
 * The "active" display for the character: the one whose workArea differs from
 * bounds (i.e. the taskbar lives on it). Falls back to primary. spec §3.3.
 */
export function activeDisplay() {
  const all = screen.getAllDisplays()
  const withTaskbar = all.find(
    (d) => d.bounds.height - d.workArea.height > 0 || d.bounds.width - d.workArea.width > 0,
  )
  return withTaskbar ?? screen.getPrimaryDisplay()
}

/**
 * Floor geometry for a display, accounting for taskbar autohide. When autohide
 * is on, workArea == bounds, so we reserve a small safety margin so the
 * character doesn't sit under the (popping-up) taskbar. spec §3.3.
 */
export function floorGeometry() {
  const d = activeDisplay()
  const autohide =
    d.bounds.height - d.workArea.height < 4 && d.bounds.width - d.workArea.width < 4
  const safety = autohide ? 48 : 0
  return {
    leftBound: d.workArea.x,
    rightBound: d.workArea.x + d.workArea.width - CHARACTER_W,
    floorY: d.workArea.y + d.workArea.height - CHARACTER_H - safety,
  }
}

export function createWindows(): JPTWindows {
  const character = createCharacterWindow()
  const dialog = createDialogWindow()
  return { character, dialog }
}

function createCharacterWindow(): BrowserWindow {
  const display = activeDisplay()
  const { workArea } = display

  const win = new BrowserWindow({
    width: CHARACTER_W,
    height: CHARACTER_H,
    x: workArea.x + 100,
    y: workArea.y + workArea.height - CHARACTER_H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      // Chromium throttles rAF/setInterval/setTimeout for transparent and
      // "occluded" windows to ~1Hz. Our character window IS visible but
      // Chromium can't tell because most pixels are transparent. Without
      // this flag the walking animation freezes after a few seconds and
      // unfreezes only when state has accumulated huge dt, causing visible
      // teleports rather than smooth walking.
      backgroundThrottling: false,
    },
  })

  // 'screen-saver' level keeps character above almost everything
  // (real fullscreen apps still cover it — accepted tradeoff)
  win.setAlwaysOnTop(true, 'screen-saver')

  // v1: skip pixel-level click-through entirely. Whole 96×128 window receives
  // mouse events. The placeholder sprite fills the bounding box so there's no
  // visible "transparent area that should pass clicks to desktop". When real
  // 24×32 sprite arrives in v1.5 we'll re-enable setIgnoreMouseEvents + alpha
  // sampling for proper pixel-perfect click-through.

  loadRenderer(win, 'character')
  return win
}

function createDialogWindow(): BrowserWindow {
  // Frameless + transparent so jpt-dialog.png's transparent margin doesn't show
  // a brown rectangle. The v1 Win11 "transparent + show:false → no paint" quirk
  // is mitigated by the global app.disableHardwareAcceleration() (same setup
  // that makes the character window transparent + paint correctly).
  const win = new BrowserWindow({
    width: DIALOG_W,
    height: DIALOG_H,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000', // fully transparent
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  loadRenderer(win, 'dialog')
  return win
}

function loadRenderer(win: BrowserWindow, name: 'character' | 'dialog' | 'settings' | 'welcome') {
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.log(`[JPT/${name}] L${level} ${message}`)
  })
  if (VITE_DEV_SERVER_URL) {
    const base = VITE_DEV_SERVER_URL.replace(/\/$/, '')
    win.loadURL(`${base}/src/${name}/index.html`)
  } else {
    win.loadFile(path.join(RENDERER_DIST, `src/${name}/index.html`))
  }
}

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 560,
    frame: true,
    title: 'JPT 设置',
    backgroundColor: '#efc88c',
    resizable: true,
    show: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  loadRenderer(win, 'settings')
  return win
}

export function createWelcomeWindow(): BrowserWindow {
  // Frameless + transparent: the letter IS the window. No brown surround filler.
  // Earlier "transparent + frameless" issues turned out to be renderer state bugs
  // (the Chrome_RenderWidgetHostHWND's WS_EX_TRANSPARENT is normal — clicks bubble
  // to parent BrowserWindow's WndProc and reach the React renderer).
  const win = new BrowserWindow({
    width: 580,
    height: 440,
    title: 'JPT — 欢迎',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    skipTaskbar: false,
    resizable: false,
    closable: true,
    show: true,
    focusable: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const { workArea } = screen.getPrimaryDisplay()
  const x = workArea.x + Math.floor((workArea.width - 720) / 2)
  const y = workArea.y + Math.floor((workArea.height - 480) / 2)
  win.setPosition(x, y)
  win.once('ready-to-show', () => win.focus())

  // Main-process Esc binding as a last resort if the renderer's keydown listener
  // doesn't reach. Bypasses React entirely.
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && (input.key === 'Escape' || input.key === 'Enter')) {
      win.close()
    }
  })

  loadRenderer(win, 'welcome')
  return win
}
