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
 * ── APPLIED EVERYWHERE, since 2026-08-13 ────────────────────────────────────────────
 * This said "NOT YET APPLIED EVERYWHERE" for as long as it was true. Every page under
 * `app/(protected)` now uses it, `loading.tsx` included — so a navigation no longer
 * starts at one measure and jumps to another.
 *
 * `grep "mx-auto max-w-"` over that directory returns exactly three things and none is a
 * page container: /chat's empty-state card, and error.tsx and not-found.tsx, which are
 * centred `max-w-md` messages. Those two are deliberate — an apology in a 6xl column
 * reads as a layout failure rather than as a message — and they are the whole exception
 * list. A fourth belongs here or in a named option.
 *
 * FOUR PAGES ARE `reading` AND THE REST ARE `wide`. The four are the ones whose content
 * is a single column of prose read start to finish: Announcements, an event, an election
 * ballot, and Settings. Everything else is horizontal — tables, card grids, a MainRail
 * with panes under it — which is what `wide` is for and why it is the default.
 *
 * TWO PAGES LOST AN `xl:max-w-6xl` STEP in that sweep and it is worth knowing why, since
 * it reads like a regression. Accounting and Transactions were `max-w-4xl … xl:max-w-6xl`
 * — narrower than every page beside them until 1280px — on the argument that their
 * second-level rail only appears at xl. That rail lives INSIDE the measure rather than
 * beside it, so the argument did not hold, and the visible cost was a page that changed
 * width mid-resize while Members next door did not.
 *
 * New pages use it from the start, and a page that seems to need something else needs a
 * named option here first.
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
