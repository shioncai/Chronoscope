import { compareTimePoints, type TimePoint } from '../time'

export type EventValidationError = 'title-required' | 'time-required' | 'end-before-start'

export function validateEvent(e: {
  title: string
  start?: TimePoint
  end?: TimePoint
}): { ok: boolean; errors: EventValidationError[] } {
  const errors: EventValidationError[] = []
  if (!e.title || e.title.trim() === '') errors.push('title-required')
  if (!e.start && !e.end) errors.push('time-required')
  if (e.start && e.end && compareTimePoints(e.end, e.start) < 0) {
    errors.push('end-before-start')
  }
  return { ok: errors.length === 0, errors }
}
