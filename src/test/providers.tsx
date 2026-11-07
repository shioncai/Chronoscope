import type { ReactNode } from 'react'
import { AppStoreProvider, type AppStore } from '../state'
import { ToastProvider } from '../ui/components/Toast'
import { ConfirmProvider } from '../ui/components/Confirm'
import { DataTransferProvider } from '../ui/app/DataTransfer'

/**
 * The providers AppShell mounts, in the same order, so a component rendered
 * on its own in a test sees the toasts, confirm dialog and import/export it
 * would in the app.
 */
export function TestProviders({ app, children }: { app: AppStore; children: ReactNode }) {
  return (
    <AppStoreProvider value={app}>
      <ToastProvider>
        <ConfirmProvider>
          <DataTransferProvider>{children}</DataTransferProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AppStoreProvider>
  )
}
