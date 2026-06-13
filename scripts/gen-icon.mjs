// Rasterize boardy-mark.svg -> build/icon.png using an offscreen Electron window.
// The dev VM has no standalone SVG rasterizer (cairosvg/rsvg/imagemagick/sharp),
// but Electron's Chromium can render the SVG and capture it. Run with:
//   node_modules/.bin/electron scripts/gen-icon.mjs
import { app, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 1024

app.disableHardwareAcceleration()

const svg = readFileSync(join(root, 'boardy-logos', 'boardy-mark.svg'), 'utf8')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  svg{display:block;width:${SIZE}px;height:${SIZE}px}
</style></head><body>${svg}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  // give the compositor a beat to paint the transparent SVG
  await new Promise((r) => setTimeout(r, 400))
  const image = await win.webContents.capturePage()
  const out = join(root, 'build', 'icon.png')
  writeFileSync(out, image.toPNG())
  const { width, height } = image.getSize()
  console.log(`wrote ${out} (${width}x${height})`)
  app.exit(0)
})
