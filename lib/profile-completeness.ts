/**
 * How much of a member's own profile they have actually filled in.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────────────
 * One prompt on the Dashboard: a member whose profile is mostly empty is a member the
 * Directory cannot help anybody reach, and the moment to say so is when they land, not when
 * somebody else notices. It is a nudge and nothing else — nothing is withheld, no screen is
 * gated on it, and a member who wants to enter nothing is entitled to.
 *
 * ── PURE, AND THAT IS WHY IT IS HERE RATHER THAN IN THE PAGE ────────────────────────
 * No React, no database, no clock (AGENTS.md §7b). It takes the row and answers, so the whole
 * of the rule is checkable under `npm test` — which matters more than usual for this one,
 * because the alternative is a threshold buried in JSX that nobody can see the effect of
 * without loading a dashboard as a half-finished member.
 *
 * ── THE FIELDS ARE A JUDGEMENT, AND THE JUDGEMENT IS "COULD SOMEBODY REACH YOU" ─────
 * Not every writable profile column. `WRITABLE_PROFILE_COLUMNS` has twenty-odd entries and
 * most of them are nobody's business whether they are filled in: a middle name, a suffix, an
 * apartment number, a nickname, a t-shirt size. Counting those would put every member at
 * "60% complete" forever and the prompt would become furniture.
 *
 * So this counts the six that make a Directory entry USEFUL to another relative, and each is
 * on the list for a stated reason:
 *
 *   primary_phone    how the family reaches you outside the product
 *   city, state      where you are, which is what the Directory prints under your name
 *   country          what makes `state` mean anything, and what the address form asks first
 *   date_of_birth    the Birthdays pane is built on it, and a member with none is invisible
 *                    there — the one field whose absence removes them from a whole screen
 *   avatar_url       the portrait every member surface falls back to initials without
 *
 * DELIBERATELY NOT HERE, and each is a decision rather than an oversight:
 *
 *   first_name, last_name  required at registration; never blank, so counting them would
 *                          inflate every score by two and move nobody
 *   primary_email          not editable by the member on a record, and generated for one
 *                          without an account (AGENTS.md §4b) — "filled in" is meaningless
 *   gender                 blank is a real, keepable answer. The form says "Prefer not to
 *                          say", and a prompt that nags about it contradicts the form.
 *   chapter_id             per-family, set on its own control, and a family with no chapters
 *                          has no answer to give — it would read as incomplete forever
 *   sunset_date            a date of death. Prompting a living member to supply one is the
 *                          worst sentence this feature could produce.
 *   street_address, zip    the Directory does not print them and no screen needs them, so
 *                          asking is collecting rather than helping
 */

/** The row this needs. Anything with these fields can be asked. */
export interface ProfileCompletenessInput {
  primary_phone?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  date_of_birth?: string | null
  avatar_url?: string | null
}

/** One field, with the words the prompt uses for it. */
interface CompletenessField {
  key: keyof ProfileCompletenessInput
  label: string
}

/**
 * ORDERED BY WHAT A READER WOULD FILL IN FIRST, not alphabetically and not by the column
 * order on `people`. The prompt lists what is missing, and a list that reads
 * "a photo, your phone number, where you live" is a to-do; one that reads
 * "avatar_url, city, country" is a schema.
 */
const FIELDS: readonly CompletenessField[] = [
  { key: 'primary_phone', label: 'a phone number' },
  { key: 'city', label: 'your city' },
  { key: 'state', label: 'your state or province' },
  { key: 'country', label: 'your country' },
  { key: 'date_of_birth', label: 'your birthday' },
  { key: 'avatar_url', label: 'a photo' },
]

export interface ProfileCompleteness {
  /** How many of the counted fields have something in them. */
  filled: number
  /** How many are counted. A constant today; read it rather than hard-coding 6. */
  total: number
  /** 0–100, rounded. What the prompt prints. */
  percent: number
  /** The missing ones, in the order above, ready to be joined into a sentence. */
  missing: string[]
  /** Whether the Dashboard should say anything at all. See `PROMPT_BELOW`. */
  shouldPrompt: boolean
}

/**
 * THE THRESHOLD, and it is a product decision rather than a tuning knob.
 *
 * The ask was "if MOST of the profile hasn't been completed", so the prompt appears when
 * FEWER THAN HALF the counted fields are filled — three of six or better is quiet. Two
 * consequences worth stating because both are intentional:
 *
 *   * a brand-new member sees it, which is the point;
 *   * a member who has filled in three things and stopped does NOT see it again. The prompt
 *     is for somebody who has not started, not a completeness meter that follows people
 *     around. There is no dismiss control precisely because it goes away on its own.
 */
const PROMPT_BELOW = 0.5

/**
 * ── `countPhoto` EXISTS BECAUSE A PHOTO IS NOT ALWAYS ASKABLE, since 2026-08-22 ─────
 * Profile pictures are Standard. On a Free family the upload control is not rendered and
 * `avatar_url` is narrowed to null on every read (`lib/auth/tier.ts`, `familyShowsPhotos`) —
 * so counting it here would put "a photo" permanently in `missing` for a member who has no
 * way to supply one, drag their percentage down by a sixth they cannot recover, and keep the
 * nudge on screen forever. A to-do list with an item nobody can tick is worse than no list.
 *
 * IT IS A PARAMETER RATHER THAN A LOOKUP, so this module stays pure and testable (§7b): the
 * caller resolves the tier — it already has the answer for the hero's portrait — and this
 * decides nothing about plans. Defaulting to `true` keeps every existing caller and both
 * existing tests correct, and makes the Free case the one that has to be stated.
 *
 * `total` MOVES WITH IT, which is the half that is easy to miss: the threshold is a FRACTION
 * of the counted fields, so dropping a field without dropping the denominator would make the
 * prompt fire at a different point on Free than on Standard.
 */
export function profileCompleteness(
  person: ProfileCompletenessInput | null | undefined,
  countPhoto = true,
): ProfileCompleteness {
  const missing: string[] = []
  let filled = 0
  const fields = countPhoto ? FIELDS : FIELDS.filter(f => f.key !== 'avatar_url')

  for (const field of fields) {
    // A string of spaces is not an answer, and neither is the empty string an
    // `<input type="date">` sends when it is cleared. `?? ''` covers null and undefined
    // together, so a missing key and an explicit null are the same fact — which they are.
    const value = person?.[field.key] ?? ''
    if (typeof value === 'string' && value.trim() !== '') filled += 1
    else missing.push(field.label)
  }

  const total = fields.length
  return {
    filled,
    total,
    percent: Math.round((filled / total) * 100),
    missing,
    // A member with NO ROW AT ALL is not prompted. That is not the same as an empty profile:
    // it means the read failed or the caller has no `people` row in this family, and a
    // dashboard that opens with "your profile is 0% complete" over a fetch that did not
    // answer is the §8 mistake wearing a friendly face.
    shouldPrompt: person != null && filled / total < PROMPT_BELOW,
  }
}

/**
 * "a photo and your birthday", "a phone number, your city and 2 more".
 *
 * ── IT CAPS THE LIST, because six clauses is not a sentence ─────────────────────────
 * Three names and then a count. The names are the ones a member is most likely to fill in
 * first (see `FIELDS`), so the three shown are the three worth showing.
 *
 * Separate from `profileCompleteness` so the rule and its PROSE are testable apart: a change
 * to the wording cannot silently change who is prompted, and a change to the threshold cannot
 * silently change the sentence.
 */
export function missingFieldsSentence(missing: readonly string[], max = 3): string {
  if (missing.length === 0) return ''
  if (missing.length === 1) return missing[0]

  const shown = missing.slice(0, max)
  const rest = missing.length - shown.length
  if (rest > 0) return `${shown.join(', ')} and ${rest} more`
  // Oxford comma only where there are three or more, which is where it disambiguates.
  return shown.length === 2
    ? `${shown[0]} and ${shown[1]}`
    : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
}
