// A LIFO stack of "dismiss the topmost layer" callbacks. Android's back button
// resolves against it: innermost modal first, then the drawer, and only when
// nothing is left does the press mean "leave the app".
//
// This lives in platform/ rather than ui/ because platform/androidBack.ts also
// reads it, and platform must not import upward from ui.

type BackHandler = () => void

const stack: BackHandler[] = []

/** Register a dismiss handler. Returns the unregister function. */
export function pushBackHandler(fn: BackHandler): () => void {
  stack.push(fn)
  return () => {
    const i = stack.lastIndexOf(fn)
    if (i !== -1) stack.splice(i, 1)
  }
}

/**
 * Run the most recently registered handler. Returns false when there is none,
 * which the caller reads as "nothing left to dismiss".
 *
 * Note this does not pop: the handler closes its layer, and that layer's own
 * cleanup unregisters it. Popping here too would dismiss two layers per press.
 */
export function runTopBackHandler(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top()
  return true
}

export function backHandlerCount(): number {
  return stack.length
}
