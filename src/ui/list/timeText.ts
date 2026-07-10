import { formatTimePoint, type TimePoint } from '../../domain/time'
import type { Locale } from '../../domain/locale'

// The list's time column shows the full span: both ends → "start → end"; a lone
// end → an open interval "→ end"; a lone start → just the start; neither → "—".
export function formatTimeRange(
  start: TimePoint | undefined,
  end: TimePoint | undefined,
  locale: Locale = 'zh',
): string {
  const s = start ? formatTimePoint(start, locale) : ''
  const e = end ? formatTimePoint(end, locale) : ''
  if (s && e) return `${s} → ${e}`
  if (s) return s
  if (e) return `→ ${e}`
  return '—'
}
