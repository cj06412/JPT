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
    },
  })

  // 'screen-saver' level keeps character above almost everything
  // (real fullscreen apps still cover it — accepted tradeoff)
  win.setAlwaysOnTop(true, 'screen-saver')

  loadRenderer(win, 'character')
  return win
}

function createDialogWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: DIALOG_W,
    height: DIALOG_H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false, // hidden until character is clicked
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

function loadRenderer(win: BrowserWindow, name: 'character' | 'dialog') {
  if (VITE_DEV_SERVER_URL) {
    // VITE_DEV_SERVER_URL ships with a trailing slash; strip it so the URL doesn't end up with //
    const base = VITE_DEV_SERVER_URL.replace(/\/$/, '')
    win.loadURL(`${base}/src/${name}/index.html`)
  } else {
    win.loadFile(path.join(RENDERER_DIST, `src/${name}/index.html`))
  }
}
