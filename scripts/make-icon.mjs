// Regenerate every raster icon from the two SVG sources in public/.
// Run: node scripts/make-icon.mjs   (dev-only deps: sharp, png-to-ico)
//
//   public/favicon.svg        rounded tile, transparent corners — the artwork
//                             as-is. Source for the browser tab, the PWA `any`
//                             icons, and the Windows .ico.
//   public/icon-maskable.svg  full-bleed square, glyphs inset to the 80% safe
//                             zone. Source for the PWA `maskable` icon, which
//                             the OS crops to its own shape.
//
// apple-touch-icon is the one that must be an opaque square: iOS paints
// transparency black and rounds the corners itself. Flattening the rounded
// tile onto the same paper fills the corners back in, which is the same thing.
//
// Tauri keeps a second icon set of its own (src-tauri/icons/ — .ico, .icns and
// the Windows Store logos) that only its CLI can write. It does not read any of
// the files below, so it will sit on the PREVIOUS artwork until you also run:
//
//   npx tauri icon -o src-tauri/icons build/icon-1024.png
//   rm -rf src-tauri/icons/android src-tauri/icons/ios
//
// The second line is not optional. The CLI always emits Tauri-flavoured android/
// and ios/ icon sets alongside the desktop ones and -o only relocates them; this
// app's mobile build is Capacitor's, so those directories are dead weight at
// best and a second, conflicting launcher icon at worst. build/icon-1024.png is
// written below purely as that command's input.
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const TILE = '#e0d7c8' // the icon's own paper — a fixed artwork, not themed
const D = 384 // rasterise the 256-unit viewBox at 1.5x so downscales stay crisp

mkdirSync('build', { recursive: true })

const render = (src, size, opts = {}) => {
  let img = sharp(src, { density: D }).resize(size, size)
  if (opts.opaque) img = img.flatten({ background: TILE })
  return img.png().toBuffer()
}

const FAVICON = 'public/favicon.svg'
const MASKABLE = 'public/icon-maskable.svg'

const out = [
  ['public/icon-192.png', await render(FAVICON, 192)],
  ['public/icon-512.png', await render(FAVICON, 512)],
  ['public/icon-maskable-512.png', await render(MASKABLE, 512)],
  ['public/apple-touch-icon.png', await render(FAVICON, 180, { opaque: true })],
  // the source `npx tauri icon` expects: one large square, transparency intact
  ['build/icon-1024.png', await render(FAVICON, 1024)],
]

// Windows wants several sizes in one file; 16/32 are the taskbar and title bar.
out.push([
  'build/icon.ico',
  await pngToIco([
    await render(FAVICON, 16),
    await render(FAVICON, 32),
    await render(FAVICON, 48),
    await render(FAVICON, 256),
  ]),
])

for (const [path, buf] of out) {
  writeFileSync(path, buf)
  console.log(`wrote ${path} (${(buf.length / 1024).toFixed(1)} kB)`)
}
