import { useState } from 'react'
import {
  loadCustomColors, persistCustomColors, addToPalette, removeFromPalette, replaceInPalette,
} from '../categoryColors'

export interface CustomPalette {
  custom: string[]
  add: (hex: string) => void
  remove: (hex: string) => void
  replace: (oldHex: string, next: string) => void
}

export function useCustomPalette(storage: Storage = window.localStorage): CustomPalette {
  const [custom, setCustom] = useState<string[]>(() => loadCustomColors(storage))
  const commit = (next: string[]) => { setCustom(next); persistCustomColors(storage, next) }
  return {
    custom,
    add: (hex) => commit(addToPalette(custom, hex)),
    remove: (hex) => commit(removeFromPalette(custom, hex)),
    replace: (oldHex, next) => commit(replaceInPalette(custom, oldHex, next)),
  }
}
