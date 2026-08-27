'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/layout/LocaleProvider'

// Catches uncaught exceptions thrown while rendering any protected page (e.g. a
// failed Supabase query) and shows a recoverable fallback instead of a crash.
// Note: this Next.js build passes `unstable_retry` (not `reset`) to re-run the
// failed segment.
export default function ProtectedError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const t = useT()
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold mb-2">{t('shell.somethingWentWrong')}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t('shell.weCouldnTLoad')}</p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={() => unstable_retry()}>
          <RotateCw className="h-4 w-4" />{t('shell.tryAgain')}</Button>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">{t('shell.backDashboard')}</Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-[11px] text-muted-foreground/60">Error reference: {error.digest}</p>
      )}
    </div>
  )
}
