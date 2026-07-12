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
// tile onto the same ink fills the corners back in, which is the same thing.
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const INK = '#121211' // day/night both: the tile is a fixed artwork, not themed
const D = 384 // rasterise the 256-unit viewBox at 1.5x so downscales stay crisp

mkdirSync('build', { recursive: true })

const render = (src, size, opts = {}) => {
  let img = sharp(src, { density: D }).resize(size, size)
  if (opts.opaque) img = img.flatten({ background: INK })
  return img.png().toBuffer()
}

const FAVICON = 'public/favicon.svg'
const MASKABLE = 'public/icon-maskable.svg'

const out = [
  ['public/icon-192.png', await render(FAVICON, 192)],
  ['public/icon-512.png', await render(FAVICON, 512)],
  ['public/icon-maskable-512.png', await render(MASKABLE, 512)],
  ['public/apple-touch-icon.png', await render(FAVICON, 180, { opaque: true })],
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
