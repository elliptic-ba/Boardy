/**
 * Wrap the Linux executable in a shell script that forces X11 on Wayland
 * sessions. This must happen before Electron starts: the ozone platform is
 * chosen from the real command line, and an in-app relaunch breaks AppImages
 * (the runtime tears down its mount when the first process exits).
 */
const { renameSync, writeFileSync, chmodSync, existsSync } = require('fs')
const { join } = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return
  const exe = context.packager.executableName ?? 'boardy'
  const dir = context.appOutDir
  const real = join(dir, exe + '.bin')
  if (existsSync(real)) return
  renameSync(join(dir, exe), real)
  writeFileSync(
    join(dir, exe),
    `#!/bin/sh
# Boardy launcher — Electron's Wayland backend is unstable on some systems,
# so default to XWayland. Set BOARDY_WAYLAND=1 to use native Wayland.
dir="$(dirname "$(readlink -f "$0")")"
if [ -n "$WAYLAND_DISPLAY" ] && [ -z "$BOARDY_WAYLAND" ]; then
  exec "$dir/${exe}.bin" --ozone-platform=x11 "$@"
fi
exec "$dir/${exe}.bin" "$@"
`
  )
  chmodSync(join(dir, exe), 0o755)
}
