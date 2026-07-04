// One-off: regenerate build/icon.ico from public/favicon.svg.
// Run: node scripts/make-icon.mjs   (dev-only deps: sharp, png-to-ico)
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

mkdirSync('build', { recursive: true })

// Render the SVG centered onto a transparent 256x256 square.
// Windows icons must be square; favicon.svg is 48x46, so 'contain' + padding.
const png = await sharp('public/favicon.svg', { density: 400 })
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

const ico = await pngToIco(png)
writeFileSync('build/icon.ico', ico)
console.log('Wrote build/icon.ico')
