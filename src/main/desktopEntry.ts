import { app } from 'electron'
import { execFile } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { homedir } from 'os'

// The .desktop basename and Icon name MUST equal the window's WM_CLASS / app_id
// (set via `desktopName: boardy.desktop` in package.json) so the desktop
// environment links the running window to this entry and shows its icon.
const APP_ID = 'boardy'

const xdgDataHome = (): string => process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')

/**
 * Install (or refresh) a user-level .desktop entry + icon the first time the
 * packaged AppImage runs. AppImages aren't integrated by the system, so without
 * this GNOME's dock can't match the window to a desktop file and falls back to a
 * generic icon. Creates the entry only if it doesn't already exist — it never
 * overwrites, so manual edits (e.g. adding --no-sandbox) are preserved. Never
 * throws; integration is best-effort.
 *
 * No-ops outside packaged AppImage runs, and when BOARDY_NO_DESKTOP_INTEGRATION
 * is set so users who manage their own entries can opt out.
 */
export function ensureDesktopEntry(): void {
  try {
    const appImagePath = process.env.APPIMAGE
    if (
      process.platform !== 'linux' ||
      !app.isPackaged ||
      !appImagePath ||
      process.env.BOARDY_NO_DESKTOP_INTEGRATION
    ) {
      return
    }

    const dataHome = xdgDataHome()
    const desktopFile = join(dataHome, 'applications', `${APP_ID}.desktop`)
    // Persist the icon next to the entry and reference it by ABSOLUTE path in
    // Icon= below. Referencing by theme name ("boardy") would require the
    // hicolor icon cache, which needs an index.theme + gtk-update-icon-cache and
    // silently fails to resolve on a bare ~/.local/share/icons — an absolute
    // path sidesteps the whole icon-theme system (GNOME/freedesktop support it).
    // The AppImage mount path is ephemeral (changes every run), so we copy out.
    const iconFile = join(dataHome, 'icons', 'hicolor', '512x512', 'apps', `${APP_ID}.png`)
    const sourceIcon = join(process.resourcesPath, 'icon.png')
    if (existsSync(sourceIcon) && !existsSync(iconFile)) {
      mkdirSync(dirname(iconFile), { recursive: true })
      copyFileSync(sourceIcon, iconFile)
    }

    // Quote the Exec path per the desktop-entry spec so paths with spaces work.
    const desired = [
      '[Desktop Entry]',
      'Name=Boardy',
      `Exec="${appImagePath}" %U`,
      'Terminal=false',
      'Type=Application',
      `Icon=${iconFile}`,
      `StartupWMClass=${APP_ID}`,
      'Comment=Local, encrypted block-based workspace',
      'Categories=Office;',
      `X-AppImage-Version=${app.getVersion()}`,
      ''
    ].join('\n')

    // Create once; never overwrite an existing entry so manual edits survive.
    if (existsSync(desktopFile)) return

    mkdirSync(dirname(desktopFile), { recursive: true })
    writeFileSync(desktopFile, desired, { mode: 0o644 })
    refreshCaches(dataHome)
    console.log(`[boardy] installed desktop entry at ${desktopFile}`)
  } catch (err) {
    console.warn('[boardy] desktop integration skipped:', err)
  }
}

// Best-effort: prompt the DE to pick up the new entry/icon now instead of at next
// login. Both tools are optional and failures are ignored.
function refreshCaches(dataHome: string): void {
  execFile('update-desktop-database', [join(dataHome, 'applications')], () => {})
  execFile('gtk-update-icon-cache', ['-f', '-t', join(dataHome, 'icons', 'hicolor')], () => {})
}
