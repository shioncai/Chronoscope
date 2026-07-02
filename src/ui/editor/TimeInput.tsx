import { useState } from 'react'
import { formatTimePoint, daysInMonth, type TimePoint } from '../../domain/time'
import {
  buildTimePoint,
  fieldsFromTimePoint,
  isRelativeUnit,
  SCALE_UNITS,
  type TimeFields,
  type ScaleUnit,
} from './timeFields'

export interface TimeInputProps {
  label: string
  value: TimePoint | null
  nowYear: number
  onChange: (tp: TimePoint | null) => void
}

const UNIT_LABELS: Record<ScaleUnit, string> = {
  decade: '年代',
  century: '世纪',
  millennium: '千年纪',
  ka: '千年(ka)',
  Ma: '百万年(Ma)',
  Ga: '十亿年(Ga)',
}

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i <= to; i++) out.push(i)
  return out
}

export function TimeInput({ label, value, nowYear, onChange }: TimeInputProps) {
  const [fields, setFields] = useState<TimeFields>(() => fieldsFromTimePoint(value, nowYear))

  const update = (patch: Partial<TimeFields>) => {
    const next = { ...fields, ...patch }
    // keep the day in range when the month or year changes
    if ((patch.mo !== undefined || patch.year !== undefined || patch.era !== undefined) && next.d !== '') {
      const y = next.era === 'BCE' ? 1 - Number(next.year) : Number(next.year)
      const mo = Number(next.mo)
      if (next.mo === '' || (Number(next.d) > daysInMonth(y, mo))) next.d = ''
    }
    setFields(next)
    onChange(buildTimePoint(next, nowYear))
  }

  const preview = (() => {
    const tp = buildTimePoint(fields, nowYear)
    return tp ? formatTimePoint(tp, nowYear) : ''
  })()

  const yearNum = fields.era === 'BCE' ? 1 - Number(fields.year || 0) : Number(fields.year || 0)
  const maxDay = fields.mo ? daysInMonth(yearNum, Number(fields.mo)) : 31
  const relative = fields.mode === 'scale' && isRelativeUnit(fields.unit)

  const blank = (text: string) => (
    <option value="">{text}</option>
  )

  return (
    <fieldset className="time-input">
      <legend>{label}</legend>

      <div className="seg" role="group" aria-label={`${label} 尺度`}>
        <button type="button" className={fields.mode === 'civil' ? 'active' : ''} aria-pressed={fields.mode === 'civil'}
          onClick={() => update({ mode: 'civil' })}>历法日期</button>
        <button type="button" className={fields.mode === 'scale' ? 'active' : ''} aria-pressed={fields.mode === 'scale'}
          onClick={() => update({ mode: 'scale' })}>大尺度</button>
      </div>

      <div className="structured animin" key={fields.mode}>
        {fields.mode === 'scale' && (
          <label>
            {`${label} 单位`}
            <select value={fields.unit} onChange={(e) => update({ unit: e.target.value as ScaleUnit })}>
              {SCALE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* era + year: civil mode, and scale mode for calendar units */}
        {!relative && (
          <>
            <label>
              {`${label} 纪元`}
              <select value={fields.era} onChange={(e) => update({ era: e.target.value as TimeFields['era'] })}>
                <option value="CE">公元</option>
                <option value="BCE">公元前</option>
              </select>
            </label>
            <label>
              {`${label} 年`}
              <input type="number" min="1" value={fields.year} onChange={(e) => update({ year: e.target.value })} />
            </label>
          </>
        )}

        {/* 距今 magnitude: scale mode, relative units (ka/Ma/Ga) */}
        {relative && (
          <label>
            {`${label} 距今`}
            <input
              type="number"
              min="0"
              step="any"
              value={fields.mag}
              onChange={(e) => update({ mag: e.target.value })}
            />
          </label>
        )}

        {/* civil sub-fields: month → day → hour → minute */}
        {fields.mode === 'civil' && (
          <>
            <label>
              {`${label} 月`}
              <select value={fields.mo} onChange={(e) => update({ mo: e.target.value })}>
                {blank('—')}
                {range(1, 12).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {`${label} 日`}
              <select value={fields.d} disabled={!fields.mo} onChange={(e) => update({ d: e.target.value })}>
                {blank('—')}
                {range(1, maxDay).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {`${label} 时`}
              <select value={fields.h} disabled={!fields.d} onChange={(e) => update({ h: e.target.value })}>
                {blank('—')}
                {range(0, 23).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {`${label} 分`}
              <select value={fields.mi} disabled={!fields.h} onChange={(e) => update({ mi: e.target.value })}>
                {blank('—')}
                {range(0, 59).map((mi) => (
                  <option key={mi} value={mi}>
                    {String(mi).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {preview && <span className="mono preview">{preview}</span>}
    </fieldset>
  )
}
