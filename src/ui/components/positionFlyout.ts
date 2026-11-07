export type Placement = 'right' | 'left' | 'below' | 'above'
export interface Rect { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface FlyoutPos { left: number; top: number; placement: Placement }

const DEFAULT_ORDER: Placement[] = ['right', 'left', 'below', 'above']

export function positionFlyout(
  anchor: Rect, panel: Size, viewport: Size, gap = 8, margin = 8, order: Placement[] = DEFAULT_ORDER,
): FlyoutPos {
  const clampX = (x: number) => Math.max(margin, Math.min(x, viewport.width - panel.width - margin))
  const clampY = (y: number) => Math.max(margin, Math.min(y, viewport.height - panel.height - margin))

  const rightX = anchor.left + anchor.width + gap
  const leftX = anchor.left - gap - panel.width
  const belowY = anchor.top + anchor.height + gap
  const aboveY = anchor.top - gap - panel.height

  const fits: Record<Placement, () => FlyoutPos | null> = {
    right: () => (rightX + panel.width <= viewport.width - margin ? { left: rightX, top: clampY(anchor.top), placement: 'right' } : null),
    left: () => (leftX >= margin ? { left: leftX, top: clampY(anchor.top), placement: 'left' } : null),
    below: () => (belowY + panel.height <= viewport.height - margin ? { left: clampX(anchor.left), top: belowY, placement: 'below' } : null),
    above: () => (aboveY >= margin ? { left: clampX(anchor.left), top: aboveY, placement: 'above' } : null),
  }
  for (const p of order) {
    const pos = fits[p]()
    if (pos) return pos
  }
  return { left: clampX(anchor.left), top: clampY(belowY), placement: 'below' }
}
