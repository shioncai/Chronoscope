import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// package.json is the single source of truth for the app version; the About
// modal reads it through the __APP_VERSION__ define below.
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// VitePWA is build/dev-only; exclude it under Vitest so the unit suite never
// loads Workbox or a virtual SW module. Also exclude it for the ELECTRON,
// CAPACITOR and TAURI builds: all three are native shells that already ship the
// assets locally, so a Service Worker is redundant and only risks serving a stale
// app after an update.
const pwa = process.env.VITEST || process.env.ELECTRON || process.env.CAPACITOR || process.env.TAURI
  ? []
  : [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto', // no manual registerSW import needed
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Chronoscope',
          short_name: 'Chronoscope',
          description: 'A cross-scale event timeline, from deep time to this afternoon.',
          // A Web App Manifest has no media variants, so unlike the <meta> pair
          // in index.html these cannot follow the system theme — one value has
          // to serve both. Day paper wins: background_color is only the splash
          // behind the install, and theme_color is superseded by the document's
          // <meta name="theme-color"> as soon as the app loads. Mirrors day --bg
          // in src/ui/styles/tokens.css.
          theme_color: '#f0efec',
          background_color: '#f0efec',
          display: 'standalone',
          start_url: '/',
          // `any` and `maskable` must be separate entries, not one icon claiming
          // both: a maskable icon is cropped to the OS's shape (a circle in the
          // worst case), so it needs its glyphs pulled into the central 80% —
          // which is exactly what would ruin the icon when shown uncropped.
          // public/icon-maskable.svg is that inset variant.
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precache the built app shell so it opens offline.
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        },
      }),
    ]

export default defineConfig({
  plugins: [react(), ...pwa],
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: { globals: true, environment: 'node' },
})
