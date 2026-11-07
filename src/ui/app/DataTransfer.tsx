import { useRef, useState, type ReactNode } from 'react'
import { useAppStore, type ImportOutcome } from '../../state'
import { ImportResultDialog } from '../dialogs/ImportResultDialog'
import { saveFile } from '../../platform'
import { useToast } from '../components/useToast'
import { DataTransferContext, looksLikeCsv, todayStamp, type DataTransferApi } from './useDataTransfer'
import { useT } from '../../i18n/useT'

export function DataTransferProvider({ children }: { children: ReactNode }) {
  const app = useAppStore()
  const t = useT()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportOutcome | null>(null)

  const save = async (name: string, text: string, mime: string) => {
    try {
      if (await saveFile(name, text, mime)) toast({ message: t('toast.exported', { name }) })
    } catch {
      toast({ message: t('toast.exportFailed') })
    }
  }

  const api: DataTransferApi = {
    openImport: () => fileRef.current?.click(),
    exportJson: () => save(`chronoscope-${todayStamp()}.json`, JSON.stringify(app.exportData(), null, 2), 'application/json'),
    exportCsv: () => save(`chronoscope-${todayStamp()}.csv`, app.exportCsv(), 'text/csv'),
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const file = input.files?.[0]
    input.value = '' // allow re-selecting the same file later
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setResult({ ok: false, error: 'corrupt-json' })
      return
    }
    setResult(await app.importData(text, looksLikeCsv(file.name, text) ? 'csv' : 'json'))
  }

  return (
    <DataTransferContext.Provider value={api}>
      {children}
      <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={onFile}
        data-testid="import-input" />
      {result && <ImportResultDialog outcome={result} onClose={() => setResult(null)} />}
    </DataTransferContext.Provider>
  )
}
