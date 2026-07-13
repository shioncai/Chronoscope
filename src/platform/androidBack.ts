// Android's back button, resolved against the dismiss stack: close the topmost
// modal, then the drawer, and only when nothing is left does back mean "leave".
// Without this a single press kills the app — discarding an open edit with it.
import { Capacitor } from '@capacitor/core'
import { runTopBackHandler } from './backHandlers'

export function initAndroidBackButton(): void {
  if (!Capacitor.isNativePlatform()) return

  void import('@capacitor/app').then(({ App }) => {
    void App.addListener('backButton', () => {
      if (!runTopBackHandler()) void App.exitApp()
    })
  })
}
