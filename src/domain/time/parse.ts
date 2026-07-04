import { type TimePoint, fromYear, fromCivil, fromAgo } from './timepoint'

export function parseTimeInput(text: string, nowYear: number): TimePoint | null {
  const t = text.trim()

  let m = /^(-?\d{1,})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    const civil = { y: +y, mo: +mo, d: +d, h: +h, mi: +mi, ...(s ? { s: +s } : {}) }
    return fromCivil(civil, s ? 'second' : 'minute')
  }
  m = /^(-?\d{1,})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return fromCivil({ y: +m[1], mo: +m[2], d: +m[3] }, 'day')

  m = /^(-?\d{1,})-(\d{1,2})$/.exec(t)
  if (m) return fromCivil({ y: +m[1], mo: +m[2] }, 'month')

  m = /^公元前(\d+)年$|^前(\d+)年$/.exec(t)
  if (m) return fromYear(1 - +(m[1] ?? m[2]), 'year')

  m = /^(\d+)年代$/.exec(t)
  if (m) return fromYear(+m[1], 'decade')

  m = /^约?(\d+(?:\.\d+)?)亿年前$/.exec(t)
  if (m) {
    const ago = +m[1] * 1e8
    return fromAgo(ago, ago >= 1e9 ? 'Ga' : 'Ma')
  }
  m = /^约?(\d+(?:\.\d+)?)万年前$/.exec(t)
  if (m) {
    const ago = +m[1] * 1e4
    return fromAgo(ago, ago >= 1e6 ? 'Ma' : 'ka')
  }
  m = /^约?(\d+)年前$/.exec(t)
  if (m) return fromYear(nowYear - +m[1], 'year')

  m = /^(-?\d{1,})$/.exec(t)
  if (m) return fromYear(+m[1], 'year')

  return null
}
