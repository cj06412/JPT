import { autoUpdater } from 'electron-updater'
import { dialog } from 'electron'

/**
 * Wrap electron-updater with sane defaults + dialog prompts.
 *
 * v1 ships with the GitHub Releases publish provider declared in
 * electron-builder.yml. To enable real OTA updates you need to:
 *   1. Tag a release on GitHub (vX.Y.Z)
 *   2. Upload the JPT-Setup-X.Y.Z.exe + latest.yml from `release/`
 *   3. App users will see "update available" prompts on next launch
 *
 * In dev (npm run dev) autoUpdater silently no-ops — you can call
 * `manualCheck()` from the tray menu and it will report 'no update'.
 */
export function setupAutoUpdates() {
  autoUpdater.autoDownload = true
  autoUpdater.on('error', (err) => {
    console.error('[JPT updater] error:', err)
  })
  autoUpdater.on('update-available', (info) => {
    console.log('[JPT updater] update available:', info.version)
  })
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'JPT 更新',
      message: '更新已下载，重启 JPT 即可生效。',
      buttons: ['现在重启', '稍后'],
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall()
    })
  })

  // Initial silent check on startup (skipped if dev mode)
  if (!process.env.VITE_DEV_SERVER_URL) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => { /* ignore — placeholder feed */ })
  }
}

export function manualCheck() {
  if (process.env.VITE_DEV_SERVER_URL) {
    dialog.showMessageBox({
      type: 'info',
      title: 'JPT 更新',
      message: '开发模式无法检查更新（仅 release 版本支持）。',
    })
    return
  }
  autoUpdater.checkForUpdates().catch((err) => {
    dialog.showMessageBox({
      type: 'error',
      title: 'JPT 更新',
      message: `检查更新失败：${err.message}`,
    })
  })
}
