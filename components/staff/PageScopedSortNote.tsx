'use client'

import { useT } from '@/components/layout/LocaleProvider'

/**
 * "Sorting orders the rows on this page" — under a SERVER-PAGED table that sorts client-side.
 *
 * ── WHY THIS SENTENCE EXISTS AT ALL ─────────────────────────────────────────────────
 * Both staff rosters page on the server, so the rows a browser holds are one page of many and
 * a client sort can only order those. Pressing **Family** on page one of nine does not put
 * Aaronson at the top of the platform — it puts the first of these twenty-five families there.
 * A control that looks like it ordered a list and ordered a slice of it is the same class of
 * defect as a permission switch nothing consults: it is not wrong so much as it means
 * something other than it says.
 *
 * Nothing in the product could have told the reader that. So it is said.
 *
 * ── AND ONLY WHEN THERE IS MORE THAN ONE PAGE ───────────────────────────────────────
 * On a platform whose families fit on one page — which is every platform today — the page IS
 * the list, the sort IS complete, and the caveat would be a warning about a limitation the
 * reader does not have. That is the same judgement `Standing` makes about a second line only
 * when the two tiers disagree, and the dashboard makes about omitting a zero tile: a sentence
 * that is true but inapplicable is noise, and noise is what stops the applicable ones being
 * read.
 *
 * ── A COMPONENT AND NOT A LINE IN EACH TABLE ────────────────────────────────────────
 * Two screens, one limitation, one wording. Typed twice they would drift — and the drift
 * would be invisible, because nobody opens Families and Accounts side by side to compare the
 * small print under their tables.
 *
 * ── IT IS A CAPTION, NOT A `FormError` ──────────────────────────────────────────────
 * Muted, not `--destructive` and not `--brand-withheld`: nothing failed and nothing is being
 * withheld. It is a fact about the scope of a control, which is ordinary information.
 *
 * ── IT TAKES A BOOLEAN, NOT A TOTAL, AND THE REASON IS GoTrue ───────────────────────
 * The obvious signature is `(total, pageSize)`, and Families could satisfy it. Accounts
 * cannot: it pages GoTrue's admin `listUsers`, which returns no dependable count — which is
 * why the pager on that screen states a page NUMBER rather than "3 of 9"
 * (`lib/auth/account-state.ts`). Asking for a total would mean inventing one there, and an
 * invented total is exactly the sort of plausible figure this codebase keeps having to
 * delete. "Is there more than one page" is the whole of what both screens can honestly
 * answer, and it is all this decision needs.
 *
 * The sentence names no figure for the same reason.
 */
export function PageScopedSortNote({ moreThanOnePage }: {
  /**
   * Whether this table has rows the browser is not holding. Families derives it from its own
   * `total`; Accounts from `hasMore` or from being past the first page.
   */
  moreThanOnePage: boolean
}) {
  const t = useT()
  if (!moreThanOnePage) return null
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      {t('stf.sortOrdersThisPage')}
    </p>
  )
}
