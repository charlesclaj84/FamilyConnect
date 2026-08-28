'use client'

// `'use client'` FOR THE TRANSLATOR AND FOR NOTHING ELSE. A sync Server Component
// cannot await, so it cannot resolve the reader's language; and the router renders
// this one directly, so there is no parent to hand a `t` down from. The markup is
// static and the layout above already ships JS, so the directive buys the sentence
// its language and costs nothing.

import Link from 'next/link'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { useT } from '@/components/layout/LocaleProvider'

// Rendered for unmatched routes (or notFound() calls) within the protected
// area — keeps the user inside the app chrome with a clear way back.
export default function NotFound() {
  const t = useT()
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold mb-2">{t('shell.pageNotFound')}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t('shell.pageReLookingDoesn')}</p>
      <Link href="/dashboard" className={buttonVariants() + ' justify-center'}>{t('shell.backDashboard')}</Link>
    </div>
  )
}
