import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Matches the Electron appId. Both are frozen: the appId is the app's identity
  // to the OS, and the WebView origin below is what IndexedDB is scoped to —
  // changing either orphans every existing user's data.
  appId: 'com.shionchoy.chronoscope',
  appName: 'Chronoscope',
  webDir: 'dist',
  android: {
    // https://localhost — a stable, secure origin, so IndexedDB persists and
    // survives app updates. Never change this.
    androidScheme: 'https',
  },
}

export default config
