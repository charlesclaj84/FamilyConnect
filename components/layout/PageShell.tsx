import { cn } from '@/lib/utils'

/**
 * The measure every inset thing in the signed-in shell shares — the page, the TopBar's
 * controls, and /chat's heading.
 *
 * IT IS EXPORTED BECAUSE THREE FILES HELD A COPY OF IT. `TopBar` matched
 * `max-w-6xl px-4 sm:px-6` by hand so its controls would land on the right edge of the
 * page's content rather than the viewport's, and `/community/chat` matched it again by hand because
 * it cannot use `PageShell` (its two panes run to the edges of the window). Three copies
 * of one number, each with a comment saying it must equal the other two, is the shape that
 * drifts — so the number lives here and they import it.
 *
 * No vertical padding, deliberately: the page adds `py-10`, the bar is `h-16`, and /chat
 * spaces its heading against a thread it also has to leave room for.
 */
export const PAGE_MEASURE = 'mx-auto w-full max-w-6xl px-4 sm:px-6'

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
 * ── BOTH MEASURES START AT THE SAME LEFT EDGE ───────────────────────────────────────
 * `reading` narrows the COLUMN, not the container: the outer element is the 6xl measure on
 * every page, and `reading` constrains the content inside it, flush left. That is the
 * whole of what changed on 2026-08-13, and it is the difference between two measures and
 * two layouts.
 *
 * Centring the narrower container was the obvious reading, and the visible cost was that a
 * `reading` page's h1 sat ~190px right of every other page's on a wide window. Nothing
 * lined up: not the two h1s across a navigation, not the h1 and the TopBar controls above
 * it, and not the skeleton in `loading.tsx` — which is `wide`, because that is what most
 * pages resolve to, so a `reading` page started at one measure and jumped to another every
 * time it loaded. The comment there recorded that jump as "smaller and rarer" than the one
 * it removed; this removes it too, and the two-copy reasoning it rested on is gone with it.
 *
 * The narrower measure survives intact, which is the point — a 3xl prose column and a
 * Save button next to the field it belongs to were both real reasons and neither of them
 * asked for the column to move. `px-*` is on the OUTER element so the reading column's
 * left edge is exactly the wide content's left edge, not that plus the padding again.
 *
 * The wrapper is unconditional even at `wide`, where it adds nothing but the `space-y-*`
 * the caller passed. One DOM shape for every page is worth more than one saved div.
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
 * TWO PAGES ARE `reading` AND THE REST ARE `wide` — an event and an election ballot, both
 * `[id]` detail pages a member arrives at from a list and then reads down. Everything else
 * is horizontal — tables, card grids, a MainRail with panes under it — which is what `wide`
 * is for and why it is the default.
 *
 * ANNOUNCEMENTS AND SETTINGS WERE THE OTHER TWO, and losing them is worth recording,
 * because both were "prose" by a reading of the rule that the rule does not support:
 *
 *   * Announcements is a BOARD, not an announcement — a stack of cards with pills and
 *     controls in their corners, and a composer above them.
 *   * Settings' case was really about one INPUT. The Save button sits under the name field
 *     rather than beside it, so what the wide measure stretched was the box; the box is
 *     capped in `FamilySettingsClient` now, which is where a constraint on a field belongs.
 *
 * So the test is not "does this page contain sentences". It is whether the CONTENT is one
 * column read start to finish. A page whose content is cards, controls or a form is `wide`
 * however much text is in it.
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
  /** Extra classes for the content column — `space-y-*` is the usual reason. */
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn(PAGE_MEASURE, 'py-10')}>
      {/* `className` goes HERE, on the element that holds the children — every caller
          passes a `space-y-*`, and on the outer element it would be spacing one child
          against nothing. */}
      <div className={cn(width === 'reading' && 'max-w-3xl', className)}>
        {children}
      </div>
    </div>
  )
}
