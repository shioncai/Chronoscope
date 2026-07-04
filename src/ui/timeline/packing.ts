export interface PackItem {
  left: number // occupied pixel left (incl. label + fuzz whiskers)
  right: number // occupied pixel right
  tStart: number // core-instant start (decimal year); tStart <= tEnd
  tEnd: number // core-instant end
}

// Two events overlap in time when their closed intervals intersect in more
// than a shared endpoint — except a zero-width point counts as inside a span
// (or another point) even at the exact boundary.
function timeOverlaps(a: PackItem, b: PackItem): boolean {
  const lo = Math.max(a.tStart, b.tStart)
  const hi = Math.min(a.tEnd, b.tEnd)
  if (lo < hi) return true
  if (lo === hi) return a.tStart === a.tEnd || b.tStart === b.tEnd
  return false
}

// Assign each item a row so that, for any two items overlapping in TIME, the
// earlier-starting one gets a strictly smaller row (ties: the longer one is
// higher). Rows are packed for compactness only among items with no ordering
// constraint, and no two items on a row overlap in PIXELS (labels never touch).
export function packRows<T extends PackItem>(items: T[]): (T & { row: number })[] {
  // earlier start first; equal start -> longer first; stable index tiebreak
  const order = items.map((item, index) => ({ item, index }))
  order.sort((a, b) => {
    if (a.item.tStart !== b.item.tStart) return a.item.tStart - b.item.tStart
    if (a.item.tEnd !== b.item.tEnd) return b.item.tEnd - a.item.tEnd
    return a.index - b.index
  })

  const rowMaxRight: number[] = [] // widest occupied pixel-right seen per row
  const placed: { item: PackItem; row: number }[] = []
  const out = new Array<T & { row: number }>(items.length)

  for (const { item, index } of order) {
    // must sit strictly below every already-placed item it overlaps in time
    let floor = 0
    for (const p of placed) {
      if (timeOverlaps(item, p.item)) floor = Math.max(floor, p.row + 1)
    }
    // smallest row >= floor whose glyphs all end left of this item's left edge
    let row = floor
    while (row < rowMaxRight.length && rowMaxRight[row] > item.left) row++
    if (row === rowMaxRight.length) rowMaxRight.push(item.right)
    else rowMaxRight[row] = Math.max(rowMaxRight[row], item.right)
    placed.push({ item, row })
    out[index] = { ...item, row }
  }
  return out
}
