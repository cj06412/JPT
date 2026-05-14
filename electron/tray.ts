import { Tray, Menu, app, nativeImage } from 'electron'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface TrayDeps {
  iconPath: string
  toggleDialog: () => void
  openSettings: () => void
  checkForUpdates: () => void
}

export function createTray(deps: TrayDeps): Tray {
  const icon = nativeImage.createFromPath(deps.iconPath)
  const tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('JPT')

  const menu = Menu.buildFromTemplate([
    { label: '和 JPT 说话', click: deps.toggleDialog },
    { type: 'separator' },
    { label: '设置…', click: deps.openSettings },
    { label: '检查更新', click: deps.checkForUpdates },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setContextMenu(menu)
  tray.on('click', deps.toggleDialog)
  return tray
}

export function trayIconPath(): string {
  const dev = path.join(__dirname, '..', 'assets', 'icons', 'tray-icon.ico')
  const prod = path.join(process.resourcesPath, 'assets', 'icons', 'tray-icon.ico')
  return process.env.VITE_DEV_SERVER_URL ? dev : prod
}
