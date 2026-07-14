// Handing the user a file is a platform capability, not app logic. A browser
// takes an <a download>; an Android WebView ignores downloads entirely and has
// to go out through the native share sheet. Callers say what to save, not how.
import { Capacitor } from '@capacitor/core'

async function saveViaDownload(filename: string, text: string): Promise<void> {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function saveViaShareSheet(filename: string, text: string): Promise<void> {
  // Imported lazily so the web bundle never pulls the native plugins in.
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')

  // Cache, not Documents: the file only has to survive long enough for the share
  // target to read it, and the cache needs no storage permission.
  await Filesystem.writeFile({
    path: filename,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
  await Share.share({ title: filename, url: uri })
}

// Tauri's WebView2 drops an <a download> on the floor, exactly as Android's web
// view does, so the desktop shell asks where to put the file — which is the
// better desktop behaviour anyway. The dialog authorises the fs write on the one
// path the user picked (tauri-plugin-dialog calls scope.allow_file on it), so
// nothing wider than that single file is ever writable.
async function saveViaSaveDialog(filename: string, text: string): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const path = await save({
    defaultPath: filename,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (path) await writeTextFile(path, text) // null = the user cancelled
}

// Tauri stamps this on the window before any script runs. Checking for it costs
// nothing and needs no import, which matters: importing the Tauri SDK to ask
// whether we are in Tauri would pull it into the web bundle.
const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function saveTextFile(filename: string, text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await saveViaShareSheet(filename, text)
  } else if (isTauri()) {
    await saveViaSaveDialog(filename, text)
  } else {
    await saveViaDownload(filename, text)
  }
}
