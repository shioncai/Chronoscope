// Rasterise the Android icon sources that @capacitor/assets consumes.
// Run: node scripts/make-android-icons.mjs && npx @capacitor/assets generate --android
//
//   assets/icon-foreground.svg  the glyphs alone, inset to Android's 66.7% safe
//                               zone (see the comment in that file)
//   -> assets/icon-foreground.png  adaptive foreground layer (transparent)
//   -> assets/icon-background.png  adaptive background layer (flat paper)
//   -> assets/icon.png             legacy square icon, for launchers with no
//                                  adaptive support. Pre-Oreo launchers draw it
//                                  straight onto the home screen with no layer
//                                  behind it, so unlike the favicon it has to
//                                  carry its own tile — hence the flatten.
//
// TILE is the icon's own paper, pinned here and in make-icon.mjs and nowhere
// else. It used to be the night --bg, shared with the theme-color metas, the
// PWA manifest and the Electron window; the artwork no longer tracks the app's
// chrome, so changing one of those does not mean changing this.
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const TILE = '#e0d7c8'
const SIZE = 1024
const DENSITY = 400 // rasterise the 256-unit viewBox well above target, then downscale

mkdirSync('assets', { recursive: true })

await sharp('assets/icon-foreground.svg', { density: DENSITY })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile('assets/icon-foreground.png')

await sharp({
  create: { width: SIZE, height: SIZE, channels: 4, background: TILE },
})
  .png()
  .toFile('assets/icon-background.png')

await sharp('public/favicon.svg', { density: DENSITY })
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .flatten({ background: TILE })
  .png()
  .toFile('assets/icon.png')

console.log('Wrote assets/icon-foreground.png, assets/icon-background.png, assets/icon.png')
