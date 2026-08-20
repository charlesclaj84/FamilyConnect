'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/phone-format'

/**
 * One member, in full — the dialog behind the name on both member tables.
 *
 * ── WHY THIS EXISTS AT ALL ──────────────────────────────────────────────────────────
 * Members & Access and Member Directory used to render six columns each: Name, Phone,
 * Email, City/State, Group and (on one of them) a row menu. On 2026-08-19 three of those
 * columns left the table and Region and Chapter arrived in their place, because the
 * question these two screens are actually asked is *where in the family is this person*
 * rather than *what is their phone number* — and a phone number is a thing you want for
 * ONE person at a time, which is what a dialog is for and what a column is not.
 *
 * NOTHING WAS DELETED. Phone, email and city/state are all still here, on the row that
 * carried them, one click away. That distinction is the whole design: a column is for
 * comparing a fact across a hundred and forty people, a dialog is for reading every fact
 * about one of them, and the four values that left were never being compared.
 *
 * ── WHY ONE COMPONENT AND NOT TWO ───────────────────────────────────────────────────
 * The same reason AGENTS.md gives for the two tables matching column for column: these
 * lists answer the same question about the same people, and reading one should not require
 * relearning the other. Two dialogs would have drifted the way the two tables' search
 * boxes drifted (one accent-insensitive, one not) and the way "text on navy" drifted into
 * two hex values nobody chose — a labelled fact repeated by hand at two call sites is
 * invisible until you put the two screens side by side.
 *
 * So the SHAPE and the ORDER of the five shared facts live here, and each caller supplies
 * only what is genuinely its own through `extra`: the roster's template and membership
 * status on Members & Access, the board title and registration state on the Directory.
 *
 * ── THE TRIGGER IS A REAL BUTTON AND THE ROW IS NOT CLICKABLE ───────────────────────
 * `MemberDetailsTrigger` renders a `<button>` whose text IS the person's name, so its
 * accessible name is the person's name and a screen-reader user hears "Martha Allen,
 * button" rather than "button". A click handler on the `<tr>` is deliberately NOT offered
 * here, and that is a departure from `PaymentHistorySection` and `TransactionsClient`,
 * which carry both. Those are ledgers of transactions; this is a roster of PEOPLE, and the
 * row already holds a row menu (Members & Access) whose every item would have to
 * `stopPropagation` on its way up to avoid opening a dialog behind a confirmation prompt.
 * A `<tr>` cannot take the click on its own account either — it is not focusable, and
 * `role="button"` on it would promise Enter and Space handling that nothing implements.
 * One target, reachable by keyboard, and no invisible second one.
 *
 * ── GATING (AGENTS.md §5) ───────────────────────────────────────────────────────────
 * This component fetches nothing and decides nothing. Every value in it is a value its
 * caller already had in the row it was already rendering, so moving a fact from a cell
 * into a dialog changed who can read it by exactly nothing — which is the test AGENTS.md
 * §2 of the batch spec sets and the reason no grant moved with these columns. A dialog is
 * not a privacy boundary: props are serialized into the RSC payload whether a component
 * renders them or not. If a future caller wants to withhold a field, it withholds it from
 * the FETCH and passes null, and the row below simply does not render.
 */

/** One labelled fact. `null` renders an em-dash, which is what a missing value looks like. */
export interface MemberDetailField {
  label: string
  value: string | null
}

/**
 * The word for a member who is under no region.
 *
 * ── NATIONAL IS THE ABSENCE OF A REGION, NOT A ROW ─────────────────────────────────
 * `regions` has never held a row called National, `createRegion` refuses the name as
 * reserved, and a chapter with `region_id IS NULL` is under it — 20260817000008 states the
 * rule. So `region_name: null` arrives for BOTH of the two ways a member gets there (no
 * chapter at all, and a chapter filed under no region) and it means the same thing for
 * each: a nationally scoped due bills them identically.
 *
 * The WORD is exported from here because three call sites now print it — this dialog and
 * the two member tables — and `AdminRegionsChaptersClient` prints a fourth
 * (`chapter.region_name ?? 'National'`). Two spellings of one idea is how two screens come
 * to disagree, which is the same argument `lib/brand.ts` makes about the product name. It
 * lives in this module rather than in `lib/` because this module is the one thing both
 * tables already import; if a fifth caller appears outside `components/members/`, move it
 * to a plain module beside the dues scope vocabulary rather than copying it.
 */
export const NATIONAL = 'National'

/** `regions.name`, or National. Never an em-dash — every member is under something. */
export function regionLabel(regionName: string | null | undefined): string {
  return regionName || NATIONAL
}

export interface MemberDetails {
  /** The dialog's title, and the accessible name of the button that opened it. */
  name: string
  /** One qualifying line under the name — a board title, "Not yet registered". */
  subtitle?: string | null
  /** E.164 as stored. Formatted here, so both screens print one number one way. */
  phone: string | null
  email: string | null
  /** "City, State", either half alone, or null — pre-joined by the action. */
  location: string | null
  /** `chapters.name`, or null for a member in no chapter. */
  chapterName: string | null
  /** `regions.name` walked from the chapter, or null for National. Never stored. */
  regionName: string | null
  /**
   * Rows appended after the five above — what this particular screen knows and the
   * other does not. Members & Access sends the template and the membership status;
   * the Directory sends the board title, the preferred name and whether the person has
   * an account. Order is the caller's.
   */
  extra?: readonly MemberDetailField[]
}

export function MemberDetailsDialog({ member, onClose, onEdit }: {
  /** The member being shown, or null when the dialog is closed. */
  member: MemberDetails | null
  onClose: () => void
  /**
   * Offered only where the caller may actually edit this person — omit it and no button
   * renders, which is how the Member Directory gets the read-only version of this dialog
   * without a second component or a flag.
   *
   * ── THE ABSENCE OF THIS PROP IS NOT A PERMISSION CHECK ────────────────────────────
   * It is the UI following a decision the SERVER already made. Members & Access resolves
   * `admin/members:edit` on the page and passes `rights.edit` down; this prop is the last
   * link in that chain, not the gate. The gate is `getMemberProfileForEdit`, which resolves
   * the same grant itself before it will hand over a single column — because a `'use server'`
   * export is a public HTTP endpoint whether or not a button exists (AGENTS.md §2).
   *
   * It takes no argument. The caller already knows which member the dialog is open on — it
   * supplied it — and passing the person back would invite a second, disagreeing answer.
   */
  onEdit?: () => void
}) {
  // Region and Chapter are IN the table as columns and repeated here on purpose. Below
  // `sm` both fold away (COLLAPSING_CELL), so on a phone the dialog is the only place
  // either one is stated in full; and a dialog that showed every fact about a person
  // EXCEPT the two the table happened to be showing would read as an omission.
  const fields: MemberDetailField[] = member
    ? [
      { label: 'Phone', value: formatPhone(member.phone) || null },
      { label: 'Email', value: member.email },
      { label: 'City, State', value: member.location },
      { label: 'Chapter', value: member.chapterName },
      { label: 'Region', value: regionLabel(member.regionName) },
      ...(member.extra ?? []),
    ]
    : []

  return (
    <Dialog
      open={member !== null}
      onClose={onClose}
      title={member?.name ?? ''}
      description={member?.subtitle ?? undefined}
      // `max-w-lg` rather than the default `max-w-md`: an email address is the longest
      // value in here and `break-words` on a 28rem panel breaks most of them mid-domain.
      className="max-w-lg"
    >
      {member && (
        <div className="mt-2">
          {/* The same `<dl>` the money ledgers and Payment History use for one row in
              full, so a record reads the same way whichever screen it was opened from.
              A definition list rather than a two-column table: these are labelled
              values about ONE subject, not a grid, and `<dt>`/`<dd>` is the element
              that says so. */}
          <dl className="divide-y text-sm">
            {fields.map(f => (
              <div key={f.label} className="flex gap-4 py-2">
                <dt className="w-32 shrink-0 text-muted-foreground">{f.label}</dt>
                <dd className="min-w-0 flex-1 break-words">{f.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
            {/* A second way out beside the header's ✕ and Escape. The panel body
                scrolls and its header does not, so on a short screen this is the
                affordance a thumb reaches without scrolling back up.

                `flex-col-reverse` below `sm`: stacked, Close ends up UNDER Edit, so the
                primary action is the one a thumb reaches first while Close keeps its
                place at the bottom of the panel. `sm:flex-row` puts them back in
                reading order. */}
            <Button variant="outline" className="sm:w-auto" onClick={onClose}>Close</Button>
            {onEdit && (
              /* CLOSES THIS DIALOG AND OPENS THE OTHER, rather than growing this one into
                 a form. Two reasons, and the second is why it is not a toggle inside the
                 panel: this component is shared with the Member Directory, where there is
                 no form to grow into; and the edit dialog has to FETCH the other nineteen
                 columns before it can render anything (AGENTS.md §5 — the roster does not
                 carry them), so there is a load in between that a panel swapping its own
                 body would have to render a spinner for.

                 `onEdit` is expected to do both halves. It is one handler rather than
                 `onClose` plus `onEdit` so the two cannot be called in the wrong order,
                 which would unmount the trigger mid-transition. */
              <Button className="sm:w-auto" onClick={onEdit}>
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit profile
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}

/**
 * The name cell's button — the one and only way into the dialog above.
 *
 * Exported so both tables render the same affordance with the same accessible name.
 * `className` is for the caller's own state styling (a disabled member's name is muted
 * and struck through on Members & Access); the interaction styling is fixed here.
 *
 * `aria-haspopup="dialog"` is honest — this really does open a modal dialog, and the
 * attribute is the one thing that distinguishes it from a button that acts in place. It
 * is not the claim `role="menu"` would be: nothing about keyboard handling is promised
 * beyond Enter and Space, which the platform implements for a `<button>`.
 */
export function MemberDetailsTrigger({ name, onOpen, className }: {
  name: string
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        'text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none',
        className,
      )}
    >
      {name}
    </button>
  )
}
