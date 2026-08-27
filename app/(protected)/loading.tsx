'use client'

// `'use client'` FOR THE TRANSLATOR AND FOR NOTHING ELSE. A sync Server Component
// cannot await, so it cannot resolve the reader's language; and the router renders
// this one directly, so there is no parent to hand a `t` down from. The markup is
// static and the layout above already ships JS, so the directive buys the sentence
// its language and costs nothing.

import { Skeleton } from '@/components/ui/skeleton'
import { PageShell } from '@/components/layout/PageShell'
import { useT } from '@/components/layout/LocaleProvider'

// Shown instantly during navigation between protected pages while the next
// page's server data streams in. Mirrors the common page shape (heading +
// stacked cards) so the layout doesn't jump when real content arrives.
//
// PageShell, at the default `wide`, for exactly that reason: the skeleton has to be the
// same measure as the page replacing it, and hand-rolling a fourth-of-five max-w here
// was the one that made every navigation start narrow and then jump.
//
// `wide` NOW COVERS THE `reading` PAGES TOO, and this comment used to say otherwise —
// "the reading pages will still shift, which is a smaller and rarer jump". They do not,
// since PageShell stopped centring the narrower measure: both widths are the same 6xl
// container, so this skeleton's heading starts where the real h1 will on every page in the
// app. A `reading` page's content column is narrower than these skeletons; its left edge
// is the same one, and there are only two such pages left in any case.
export default function Loading() {
  const t = useT()
  return (
    <PageShell>
      {/* The live region is a child rather than PageShell itself, so the shell keeps its
          two-prop contract. Nothing is lost: `aria-busy` describes the region announcing
          the change, and this element wraps every skeleton on the page. */}
      <div className="space-y-8" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t('shell.loading')}</span>

        {/* Heading */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Row of stat-style tiles */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] flex-1 rounded-xl" />
          ))}
        </div>

        {/* Stacked content cards */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </PageShell>
  )
}
