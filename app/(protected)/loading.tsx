import { Skeleton } from '@/components/ui/skeleton'
import { PageShell } from '@/components/layout/PageShell'

// Shown instantly during navigation between protected pages while the next
// page's server data streams in. Mirrors the common page shape (heading +
// stacked cards) so the layout doesn't jump when real content arrives.
//
// PageShell, at the default `wide`, for exactly that reason: the skeleton has to be the
// same measure as the page replacing it, and hand-rolling a fourth-of-five max-w here
// was the one that made every navigation start narrow and then jump. It is `wide`
// because that is the default and so what most pages resolve to; the `reading` pages
// will still shift, which is a smaller and rarer jump than the one this removes.
export default function Loading() {
  return (
    <PageShell>
      {/* The live region is a child rather than PageShell itself, so the shell keeps its
          two-prop contract. Nothing is lost: `aria-busy` describes the region announcing
          the change, and this element wraps every skeleton on the page. */}
      <div className="space-y-8" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading…</span>

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
