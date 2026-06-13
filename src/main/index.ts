import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerIpc } from './ipc'
import { closeDatabase } from './db'
import { ensureDesktopEntry } from './desktopEntry'

// Window icon for X11 (_NET_WM_ICON). In dev it sits in build/; in the packaged
// app it's shipped via electron-builder `extraResources` to resources/icon.png.
// On GNOME/Wayland the dash icon instead comes from the .desktop entry matched
// by app_id — see `desktopName` in package.json + `syncDesktopName` in the
// electron-builder config.
const iconPath = app.isPackaged
  ? join(process.resourcesPath, 'icon.png')
  : join(__dirname, '../../build/icon.png')

// Electron's Wayland backend is still unstable on some distros/VMs; run through
// XWayland by default. The platform is chosen from the real command line before
// any JS runs, so we have to relaunch with the flag rather than appendSwitch.
// Set BOARDY_WAYLAND=1 to opt into native Wayland.
const needX11Relaunch =
  process.platform === 'linux' &&
  !!process.env.WAYLAND_DISPLAY &&
  !process.env.BOARDY_WAYLAND &&
  !process.argv.some((a) => a.startsWith('--ozone-platform'))

if (needX11Relaunch) {
  app.relaunch({ args: [...process.argv.slice(1), '--ozone-platform=x11'] })
  app.exit(0)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 760,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#191919',
    title: 'Boardy',
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // keep debounced autosaves running even when the window is occluded
      backgroundThrottling: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  ensureDesktopEntry()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
