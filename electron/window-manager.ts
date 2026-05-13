import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_DIST = path.join(__dirname, '..', 'dist')

const PRELOAD_PATH = path.join(__dirname, 'preload.js')

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
    width: 96,
    height: 128,
    x: workArea.x + 100,
    y: workArea.y + workArea.height - 128,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
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
    width: 720,
    height: 360,
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
    win.loadURL(`${VITE_DEV_SERVER_URL}/src/${name}/index.html`)
  } else {
    win.loadFile(path.join(RENDERER_DIST, `src/${name}/index.html`))
  }
}
