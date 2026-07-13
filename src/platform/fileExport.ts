// Handing the user a file is a platform capability, not app logic. A browser
// takes an <a download>; an Android WebView ignores downloads entirely and has
// to go out through the native share sheet. Callers say what to save, not how.

export async function saveTextFile(filename: string, text: string): Promise<void> {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
