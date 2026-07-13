// Rasterise the Android icon sources that @capacitor/assets consumes.
// Run: node scripts/make-android-icons.mjs && npx @capacitor/assets generate --android
//
//   assets/icon-foreground.svg  the glyphs alone, inset to Android's 66.7% safe
//                               zone (see the comment in that file)
//   -> assets/icon-foreground.png  adaptive foreground layer (transparent)
//   -> assets/icon-background.png  adaptive background layer (flat ink)
//   -> assets/icon.png             legacy square icon, for launchers with no
//                                  adaptive support — this one keeps the tile,
//                                  so it comes from public/favicon.svg
//
// INK is the same #121211 the tile artwork uses, and the same value as the night
// --bg. It is now the FOURTH place that colour is pinned outside tokens.css
// (the two theme-color metas, the PWA manifest, the Electron window, and here).
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const INK = '#121211'
const SIZE = 1024
const DENSITY = 400 // rasterise the 256-unit viewBox well above target, then downscale

mkdirSync('assets', { recursive: true })

await sharp('assets/icon-foreground.svg', { density: DENSITY })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile('assets/icon-foreground.png')

await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: INK },
})
  .png()
  .toFile('assets/icon-background.png')

await sharp('public/favicon.svg', { density: DENSITY })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile('assets/icon.png')

console.log('Wrote assets/icon-foreground.png, assets/icon-background.png, assets/icon.png')
