import { cn } from '@/lib/utils'

/**
 * The standard page container: centred, padded, and one of two measures.
 *
 * WHY THIS EXISTS. Every page under app/(protected) hand-rolled its own
 * `max-w-* mx-auto px-4 sm:px-6 py-10`, and the max-w drifted to whatever the page's
 * author last had on screen — 2xl, 3xl, 4xl, 5xl, 6xl, all present. The visible result
 * was that Accounting > My Summary, Personal > My Families and Person > My Profile sat
 * in a 3xl column with a lake of empty space either side, while Members & Access next
 * door used the full 6xl. Same app, same window, different page width for no reason a
 * reader could infer.
 *
 * THE RULE, and it is a rule about CONTENT rather than about pages:
 *
 *   width="wide"     (default, 6xl) — anything whose content is horizontal: tables,
 *                    card grids, a MainRail with panes under it, side-by-side panels,
 *                    forms with more than one column. If in doubt, this one.
 *
 *   width="reading"  (3xl) — a single column of prose meant to be READ start to finish:
 *                    an announcement, an event description, a document. A 6xl line of
 *                    body text is genuinely harder to read — the eye loses its place on
 *                    the return sweep — so this is not a smaller version of `wide`, it
 *                    is the correct measure for a different job.
 *
 * Do not reach past this for a bespoke max-w. A page that needs a third measure needs a
 * third named option here, so the next page facing the same choice finds it.
 *
 * NOT YET APPLIED EVERYWHERE. The pages in this change use it; the rest still carry
 * their own container. Converting them is mechanical but it is not a no-op — each one
 * has to be read to decide whether it is `wide` or `reading`, and widening a page that
 * wanted to be narrow is the one way this makes things worse. New pages should use it
 * from the start.
 */
export function PageShell({
  width = 'wide',
  className,
  children,
}: {
  width?: 'wide' | 'reading'
  /** Extra classes for the container — `space-y-*` is the usual reason. */
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mx-auto px-4 py-10 sm:px-6',
        width === 'reading' ? 'max-w-3xl' : 'max-w-6xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
