import { Skeleton } from '@/components/ui/skeleton'

// Shown instantly during navigation between protected pages while the next
// page's server data streams in. Mirrors the common page shape (heading +
// stacked cards) so the layout doesn't jump when real content arrives.
export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Heading */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Row of stat-style tiles */}
      <div className="flex flex-col sm:flex-row gap-3">
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
  )
}
