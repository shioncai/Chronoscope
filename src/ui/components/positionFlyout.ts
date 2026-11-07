export type Placement = 'right' | 'left' | 'below' | 'above'
export interface Rect { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }
export interface FlyoutPos { left: number; top: number; placement: Placement }

export function positionFlyout(
  anchor: Rect, panel: Size, viewport: Size, gap = 8, margin = 8,
): FlyoutPos {
  const clampX = (x: number) => Math.max(margin, Math.min(x, viewport.width - panel.width - margin))
  const clampY = (y: number) => Math.max(margin, Math.min(y, viewport.height - panel.height - margin))

  const rightX = anchor.left + anchor.width + gap
  const leftX = anchor.left - gap - panel.width
  const belowY = anchor.top + anchor.height + gap
  const aboveY = anchor.top - gap - panel.height

  if (rightX + panel.width <= viewport.width - margin) return { left: rightX, top: clampY(anchor.top), placement: 'right' }
  if (leftX >= margin) return { left: leftX, top: clampY(anchor.top), placement: 'left' }
  if (belowY + panel.height <= viewport.height - margin) return { left: clampX(anchor.left), top: belowY, placement: 'below' }
  if (aboveY >= margin) return { left: clampX(anchor.left), top: aboveY, placement: 'above' }
  return { left: clampX(anchor.left), top: clampY(belowY), placement: 'below' }
}
