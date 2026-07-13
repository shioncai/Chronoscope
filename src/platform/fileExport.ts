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

export async function saveTextFile(filename: string, text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await saveViaShareSheet(filename, text)
  } else {
    await saveViaDownload(filename, text)
  }
}
