/**
 * Person-name capitalisation, applied on save.
 *
 * A family directory full of "mary allen", "MARY ALLEN" and "Mary Allen" reads as three
 * different kinds of record, and every list that sorts or groups by name is affected. So the
 * value is normalised at the write boundary rather than at each of the dozen places that
 * render it.
 *
 * ── THE RULE IS DELIBERATELY NARROW, AND THAT IS THE WHOLE DESIGN ────────────────────
 * It fixes exactly two inputs and leaves everything else alone:
 *
 *     all lower case   →  Title Case      "mary allen"  →  "Mary Allen"
 *     ALL UPPER CASE   →  Title Case      "MARY ALLEN"  →  "Mary Allen"
 *     anything else    →  UNTOUCHED       "McDonald", "van der Berg", "d'Angelo", "LaTanya"
 *
 * **MIXED CASE IS A SIGNAL OF INTENT.** If a value already contains both an upper and a
 * lower case letter, somebody typed it that way on purpose, and a normaliser that "corrects"
 * it is a normaliser that renames people. That is not a hypothetical risk — it is the
 * ordinary outcome of the ambitious version:
 *
 *   * `McDonald` → `Mcdonald`, `MacArthur` → `Macarthur`
 *   * `van der Berg`, `de la Cruz`, `bin Rashid` → particles wrongly capitalised, or a
 *     particle dictionary that is wrong for the next family
 *   * `d'Angelo` → `D'angelo`; `DeShawn`, `LaTanya`, `JoAnne` → flattened
 *   * `O'Brien-Smith` handled, `mary-jane` handled, but `iPhone`-style intracaps in a
 *     transliterated name are not ours to judge
 *
 * A person's name is theirs. The two cases above are the only ones where the input carries
 * NO capitalisation information at all, so inferring it destroys nothing — and every other
 * input is left exactly as given. Anybody wanting `McDonald` types it and keeps it.
 *
 * ── WHERE IT IS APPLIED ─────────────────────────────────────────────────────────────
 * `pickProfileColumns` in `lib/profile-columns.ts`, which is the one chokepoint every
 * profile write passes through — `saveProfileSection`, `updateUserProfile` and
 * `editPersonRecord`. Doing it there rather than in three actions is what makes it
 * enforced rather than remembered, and it is the same argument that put the column
 * allow-list there.
 *
 * PURE — no imports, no environment. Tested under `npm test` (AGENTS.md §7b).
 */

/**
 * Word suffixes that are not words, so Title Case gets them wrong.
 *
 * Generational suffixes live in their own `people` column, and a lower-cased `iii` would
 * otherwise come out as `Iii` — which is worse than leaving it alone, because it looks
 * deliberate. Kept short on purpose: this is a list of forms with ONE correct rendering, not
 * a list of everything anybody writes after a name.
 */
const FIXED_FORMS: Record<string, string> = {
  ii: 'II', iii: 'III', iv: 'IV', v: 'V', vi: 'VI', vii: 'VII', viii: 'VIII',
  jr: 'Jr', 'jr.': 'Jr.', sr: 'Sr', 'sr.': 'Sr.',
  md: 'MD', 'm.d.': 'M.D.', phd: 'PhD', 'ph.d.': 'Ph.D.',
  dds: 'DDS', rn: 'RN', esq: 'Esq', 'esq.': 'Esq.',
}

/** True when the value carries no capitalisation information — all one case. */
function isSingleCase(value: string): boolean {
  const hasUpper = /\p{Lu}/u.test(value)
  const hasLower = /\p{Ll}/u.test(value)
  return !(hasUpper && hasLower)
}

/**
 * What ends a segment of a name: whitespace, hyphen, apostrophe (both the typewriter `'` and
 * the typographic `’` a phone keyboard inserts) and full stop.
 *
 * ONE DEFINITION, used to build both the split and the test below. The first version of this
 * file had the class written out twice — once as a constant and once inline in the `split`
 * — and a mutation check caught it: narrowing the constant changed no behaviour, because the
 * split had its own copy. Two copies of a character class is exactly the drift this codebase
 * keeps a rule about, in miniature.
 */
const SEPARATOR_CLASS = String.raw`[\s\-'’.]`
const SEPARATOR = new RegExp(SEPARATOR_CLASS, 'u')
/** Split so the separators survive as their own segments, and are re-joined untouched. */
const SEGMENTS = new RegExp(`(?=${SEPARATOR_CLASS})|(?<=${SEPARATOR_CLASS})`, 'u')

/**
 * Capitalise the first letter of every segment and lower-case the rest of it.
 *
 * `mary-jane`, `o'brien` and `j.r.` all come out right. `\p{L}` rather than `[a-z]` so a name
 * in any script is handled, and the locale-aware case methods for the same reason.
 *
 * `keepShort` leaves a segment of fewer than four letters exactly as it was. It is what
 * makes the UPPER-case branch safe — see the asymmetry note on `toNameCase`.
 */
function titleCase(value: string, keepShort: boolean): string {
  return value
    .split(SEGMENTS)
    .map(segment => {
      if (SEPARATOR.test(segment)) return segment
      const letters = [...segment].filter(ch => /\p{L}/u.test(ch)).length
      if (keepShort && letters > 0 && letters < 4) return segment
      const [first, ...rest] = [...segment]
      if (first === undefined) return segment
      return first.toLocaleUpperCase() + rest.join('').toLocaleLowerCase()
    })
    .join('')
}

/**
 * One name field — a first name, a last name, a nickname, a suffix.
 *
 * Whitespace is collapsed and trimmed whatever the case, because "  Mary   Allen " is not an
 * intentional rendering of anything and every list that sorts by the value is affected by it.
 * That is separable from the casing rule and applies to values the casing rule declines to
 * touch.
 *
 * Returns the input unchanged for null, undefined and a value that is only whitespace, so a
 * caller can hand it a whole patch without checking each field first.
 */
export function toNameCase(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value

  const collapsed = value.replace(/\s+/g, ' ').trim()
  if (!collapsed) return collapsed

  const fixed = FIXED_FORMS[collapsed.toLowerCase()]
  if (fixed) return fixed

  // MIXED CASE IS LEFT ALONE — see the header. Only the spacing is normalised.
  if (!isSingleCase(collapsed)) return collapsed

  // ── THE TWO BRANCHES ARE NOT SYMMETRIC, AND THE REASON IS "MJ" ────────────────────
  // Found by the test for this file rather than by reasoning: `MJ` is a real nickname and
  // the naive all-caps rule turned it into `Mj`, which is not what anybody is called.
  // `JD`, `TJ`, `CJ`, `AL` are the same shape, and so is a legal first name that IS
  // initials.
  //
  // So the two inputs carry different amounts of information and are treated differently:
  //
  //   ALL LOWER  carries none at all. `mary allen` was typed by somebody who did not
  //              capitalise anything, so every segment is title-cased. `mj` becomes `Mj`,
  //              which is an improvement on `mj` and is corrected by typing `MJ` — which
  //              the branch below then preserves.
  //   ALL UPPER  MIGHT be an acronym. Caps lock produces `MARY ALLEN`; nobody's caps lock
  //              produces a two-letter name. So a segment of four or more letters is
  //              title-cased and a shorter one is kept, which fixes the shouted name and
  //              leaves the initials alone.
  //
  // Four is the threshold because the shortest names people actually shout at a form are
  // four letters and up (`MARY`, `JOHN`, `ADA` is three and is the case this gets wrong —
  // it stays `ADA`). Getting a three-letter name wrong by LEAVING IT is the cheap error;
  // getting `MJ` wrong by changing it is the expensive one.
  const isAllUpper = !/\p{Ll}/u.test(collapsed)
  return isAllUpper
    ? titleCase(collapsed, true)
    : titleCase(collapsed.toLocaleLowerCase(), false)
}

/**
 * The `people` columns this applies to.
 *
 * `prefix` is deliberately ABSENT. "Dr", "Mrs" and "Rev" are already fixed forms and the
 * ones that are not — a rank, a religious title, a form in another language — are exactly
 * the values this rule has no business guessing at. It is also a short closed set in the UI
 * rather than free text, so there is nothing to normalise.
 */
export const NAME_CASE_COLUMNS: readonly string[] = [
  'first_name', 'middle_name', 'last_name', 'nick_name', 'suffix',
]
