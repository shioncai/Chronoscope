import { formatTimePoint, type TimePoint } from '../../domain/time'

// The list's time column shows the full span: both ends → "start → end"; a lone
// end → an open interval "→ end"; a lone start → just the start; neither → "—".
export function formatTimeRange(
  start: TimePoint | undefined,
  end: TimePoint | undefined,
): string {
  const s = start ? formatTimePoint(start) : ''
  const e = end ? formatTimePoint(end) : ''
  if (s && e) return `${s} → ${e}`
  if (s) return s
  if (e) return `→ ${e}`
  return '—'
}
