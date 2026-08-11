/**
 * The values `people.gender` may hold, and what they are called on screen.
 *
 * Stored lower-case, displayed capitalised — the same split every other closed set
 * in this schema uses (`membership_status`, `dues_payments.status`,
 * `fund_contributions.source`), so the database holds a token and the UI holds a
 * caption. A column storing "Male" would make renaming the caption a data migration.
 *
 * `GENDERS` is the single list. The `<select>` maps over it, and the CHECK constraint
 * in `20260810000001_person_gender.sql` states the same two values — that migration is
 * what actually enforces them, because `saveProfileSection` is a public endpoint and
 * nothing between the wire and the row reads this file.
 */
export const GENDERS = ['male', 'female'] as const

export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
}

/**
 * The caption for a stored value.
 *
 * Returns '' for null and for anything unrecognised, which the profile's `Field`
 * renders as "Not set". Unrecognised is reachable: the column is plain TEXT with a
 * CHECK, so widening the CHECK in a later migration without adding the label here
 * would otherwise print a raw token.
 */
export function genderLabel(value: string | null | undefined): string {
  if (!value) return ''
  return GENDER_LABELS[value as Gender] ?? ''
}
