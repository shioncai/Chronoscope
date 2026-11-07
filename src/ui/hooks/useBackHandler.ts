import { useEffect, useRef } from 'react'
import { pushBackHandler } from '../../platform'

/**
 * Register a dismiss handler for the Android back button while `active`.
 * The callback is kept in a ref so a new closure each render doesn't churn the
 * registration — otherwise the layer would keep jumping to the top of the stack.
 */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const ref = useRef(onBack)
  useEffect(() => {
    ref.current = onBack
  })

  useEffect(() => {
    if (!active) return
    return pushBackHandler(() => ref.current())
  }, [active])
}
