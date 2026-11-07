import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './ui/styles/index.css'
import { openDatabase, getOrCreateNodeId, createClock } from './data'
import {
  createAppStore,
  resolveInitialThemeMode,
  resolveTheme,
  resolveInitialLocale,
  loadStoredTheme,
  loadStoredLocale,
  loadPrefs,
  type AppStore,
} from './state'
import { decimalFromCivil } from './domain/time'
import { initAndroidBackButton } from './platform'

function read<T>(f: () => T, fallback: T): T {
  try {
    return f()
  } catch {
    return fallback // storage blocked (private mode, sandboxed webview)
  }
}

async function bootstrap(): Promise<{ app: AppStore }> {
  // openDatabase() returns { db, events, categories, tags }; the object as a
  // whole satisfies the Database interface (events/categories/tags repos),
  // while `opened.db` is the raw ChronoscopeDB that getOrCreateNodeId needs.
  const opened = openDatabase()
  const nodeId = await getOrCreateNodeId(opened.db)
  const clock = createClock(nodeId)
  const now = new Date()
  const nowYear = decimalFromCivil({
    y: now.getFullYear(),
    mo: now.getMonth() + 1,
    d: now.getDate(),
    h: now.getHours(),
    mi: now.getMinutes(),
    s: now.getSeconds(),
  })
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const themeMode = resolveInitialThemeMode(read(() => loadStoredTheme(window.localStorage), null))
  const locale = resolveInitialLocale(read(() => loadStoredLocale(window.localStorage), null), navigator.languages)
  const app = createAppStore({
    db: opened,
    clock,
    nowYear,
    theme: resolveTheme(themeMode, prefersDark),
    themeMode,
    locale,
    prefs: loadPrefs(window.localStorage),
  })
  await app.load()

  initAndroidBackButton()

  return { app }
}

bootstrap().then(({ app }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App app={app} />
    </StrictMode>,
  )
})
