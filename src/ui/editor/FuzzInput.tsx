import { useState } from 'react'
import { type FuzzFields, type FuzzUnit, FUZZ_UNIT_LABELS, buildFuzz, fuzzFromValue } from './fuzzFields'

export type FuzzValue = { before: number; after: number }

export interface FuzzInputProps {
  label: string
  value?: FuzzValue
  onChange: (v: FuzzValue | undefined) => void
}

const UNITS: FuzzUnit[] = ['day', 'year', 'century', 'millennium', 'Ma', 'Ga']

export function FuzzInput({ label, value, onChange }: FuzzInputProps) {
  const [fields, setFields] = useState<FuzzFields>(() => fuzzFromValue(value))
  const update = (next: FuzzFields) => {
    setFields(next)
    onChange(buildFuzz(next))
  }
  return (
    <div className="fuzz-input">
      <span className="fuzz-label">{label} 模糊</span>
      <select
        aria-label={`${label} 模糊单位`}
        value={fields.unit}
        onChange={(e) => update({ ...fields, unit: e.target.value as FuzzUnit })}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {FUZZ_UNIT_LABELS[u]}
          </option>
        ))}
      </select>
      {fields.asymmetric ? (
        <>
          <input
            aria-label={`${label} 模糊向前`}
            type="number"
            min="0"
            value={fields.before}
            onChange={(e) => update({ ...fields, before: e.target.value })}
            placeholder="向前"
          />
          <input
            aria-label={`${label} 模糊向后`}
            type="number"
            min="0"
            value={fields.after}
            onChange={(e) => update({ ...fields, after: e.target.value })}
            placeholder="向后"
          />
        </>
      ) : (
        <input
          aria-label={`${label} 模糊±`}
          type="number"
          min="0"
          value={fields.amount}
          onChange={(e) => update({ ...fields, amount: e.target.value })}
          placeholder="±"
        />
      )}
      <label className="fuzz-asym">
        <input
          type="checkbox"
          className="cb-native"
          aria-label={`${label} 不对称`}
          checked={fields.asymmetric}
          onChange={(e) =>
            update(
              e.target.checked
                ? { ...fields, asymmetric: true, before: fields.amount, after: fields.amount }
                : { ...fields, asymmetric: false, amount: fields.before || fields.after },
            )
          }
        />
        不对称
      </label>
    </div>
  )
}
