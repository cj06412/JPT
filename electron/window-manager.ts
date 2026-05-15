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
export const DIALOG_W = 720
export const DIALOG_H = 360

export interface JPTWindows {
  character: BrowserWindow
  dialog: BrowserWindow
}

export function createWindows(): JPTWindows {
  const character = createCharacterWindow()
  const dialog = createDialogWindow()
  return { character, dialog }
}

function createCharacterWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
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
  // Frameless + opaque. The SDV wood frame paints the whole window surface,
  // so visually there's no transparent area to preserve. transparent:true +
  // show:false → show() triggers a Win11 paint failure where the renderer
  // never starts compositing; opaque avoids that quirk entirely.
  const win = new BrowserWindow({
    width: DIALOG_W,
    height: DIALOG_H,
    frame: false,
    transparent: false,
    backgroundColor: '#3e2410', // wood outline color; brief flash before React paints
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
