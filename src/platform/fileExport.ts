// Handing the user a file is a platform capability, not app logic. A browser
// takes an <a download>; an Android WebView ignores downloads entirely and has
// to go out through the native share sheet; Tauri's WebView2 drops them too and
// asks through a native save dialog. Callers say what to save, not how.
import { Capacitor } from '@capacitor/core'

export type FileData = string | Blob

const FILTERS: Record<string, { name: string; extensions: string[] }> = {
  json: { name: 'JSON', extensions: ['json'] },
  csv: { name: 'CSV', extensions: ['csv'] },
  png: { name: 'PNG', extensions: ['png'] },
}

function toBlob(data: FileData, mime: string): Blob {
  return typeof data === 'string' ? new Blob([data], { type: mime }) : data
}

async function saveViaDownload(filename: string, data: FileData, mime: string): Promise<boolean> {
  const url = URL.createObjectURL(toBlob(data, mime))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  // Firefox ignores a click on an anchor that is not in the document, and
  // revoking the URL in the same tick can cancel the download before it starts.
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function saveViaShareSheet(filename: string, data: FileData): Promise<boolean> {
  // Imported lazily so the web bundle never pulls the native plugins in.
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')

  // Cache, not Documents: the file only has to survive long enough for the share
  // target to read it, and the cache needs no storage permission.
  await Filesystem.writeFile(
    typeof data === 'string'
      ? { path: filename, data, directory: Directory.Cache, encoding: Encoding.UTF8 }
      : { path: filename, data: await base64Of(data), directory: Directory.Cache },
  )
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
  await Share.share({ title: filename, url: uri })
  return true
}

// The dialog authorises the fs write on the one path the user picked
// (tauri-plugin-dialog calls scope.allow_file on it), so nothing wider than
// that single file is ever writable.
async function saveViaSaveDialog(filename: string, data: FileData): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const fs = await import('@tauri-apps/plugin-fs')
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const path = await save({ defaultPath: filename, filters: FILTERS[ext] ? [FILTERS[ext]] : [] })
  if (!path) return false // the user cancelled
  if (typeof data === 'string') await fs.writeTextFile(path, data)
  else await fs.writeFile(path, new Uint8Array(await data.arrayBuffer()))
  return true
}

// Tauri stamps this on the window before any script runs. Checking for it costs
// nothing and needs no import, which matters: importing the Tauri SDK to ask
// whether we are in Tauri would pull it into the web bundle.
const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Save a file the user can keep. Resolves false when they cancelled. */
export async function saveFile(filename: string, data: FileData, mime = 'application/octet-stream'): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return saveViaShareSheet(filename, data)
  if (isTauri()) return saveViaSaveDialog(filename, data)
  return saveViaDownload(filename, data, mime)
}

/** @deprecated kept for callers that only ever export JSON text */
export function saveTextFile(filename: string, text: string): Promise<boolean> {
  return saveFile(filename, text, 'application/json')
}
