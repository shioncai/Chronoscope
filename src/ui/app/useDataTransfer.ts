import { createContext, useContext } from 'react'

export interface DataTransferApi {
  /** Open the file picker; JSON backups and CSV sheets are both accepted. */
  openImport(): void
  exportJson(): Promise<void>
  exportCsv(): Promise<void>
}

export const DataTransferContext = createContext<DataTransferApi | null>(null)

/** Import and export, from wherever the button lives (sidebar, empty state). */
export function useDataTransfer(): DataTransferApi {
  const api = useContext(DataTransferContext)
  if (!api) throw new Error('useDataTransfer must be used within a DataTransferProvider')
  return api
}

/** Local calendar date as YYYY-MM-DD, for export file names. */
export function todayStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** CSV by extension or by content: anything that is not a JSON object. */
export function looksLikeCsv(name: string, text: string): boolean {
  if (/\.(csv|tsv|txt)$/i.test(name)) return true
  if (/\.json$/i.test(name)) return false
  return !text.trimStart().startsWith('{')
}
