import { useState } from 'react'
import { type FuzzFields, type FuzzUnit, buildFuzz, fuzzFromValue } from './fuzzFields'
import { useT } from '../../i18n/useT'

export type FuzzValue = { before: number; after: number }

export interface FuzzInputProps {
  label: string
  value?: FuzzValue
  onChange: (v: FuzzValue | undefined) => void
}

const UNITS: FuzzUnit[] = ['day', 'year', 'century', 'millennium', 'Ma', 'Ga']

export function FuzzInput({ label, value, onChange }: FuzzInputProps) {
  const t = useT()
  const [fields, setFields] = useState<FuzzFields>(() => fuzzFromValue(value))
  const update = (next: FuzzFields) => {
    setFields(next)
    onChange(buildFuzz(next))
  }
  return (
    <div className="fuzz-input">
      <span className="fuzz-label">{t('editor.fuzz.label', { label })}</span>
      <select
        aria-label={t('editor.fuzz.unit', { label })}
        value={fields.unit}
        onChange={(e) => update({ ...fields, unit: e.target.value as FuzzUnit })}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {t(`editor.fuzzUnit.${u}`)}
          </option>
        ))}
      </select>
      {fields.asymmetric ? (
        <>
          <input
            aria-label={t('editor.fuzz.before', { label })}
            type="number"
            min="0"
            value={fields.before}
            onChange={(e) => update({ ...fields, before: e.target.value })}
            placeholder={t('editor.fuzz.beforePlaceholder')}
          />
          <input
            aria-label={t('editor.fuzz.after', { label })}
            type="number"
            min="0"
            value={fields.after}
            onChange={(e) => update({ ...fields, after: e.target.value })}
            placeholder={t('editor.fuzz.afterPlaceholder')}
          />
        </>
      ) : (
        <input
          aria-label={t('editor.fuzz.symmetric', { label })}
          type="number"
          min="0"
          value={fields.amount}
          onChange={(e) => update({ ...fields, amount: e.target.value })}
          placeholder={t('editor.fuzz.symPlaceholder')}
        />
      )}
      <label className="fuzz-asym">
        <input
          type="checkbox"
          className="cb-native"
          aria-label={t('editor.fuzz.asymmetricAria', { label })}
          checked={fields.asymmetric}
          onChange={(e) =>
            update(
              e.target.checked
                ? { ...fields, asymmetric: true, before: fields.amount, after: fields.amount }
                : { ...fields, asymmetric: false, amount: fields.before || fields.after },
            )
          }
        />
        {t('editor.fuzz.asymmetric')}
      </label>
    </div>
  )
}
