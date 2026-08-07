/**
 * Which columns of `people` a profile edit may write — the allow-list, not a comment.
 *
 * WHY THIS IS NOT A TYPE
 *   `saveProfileSection(fields: Partial<PersonalInfoData>)` and
 *   `updateUserProfile(id, data: Partial<PersonalInfoData>)` are `'use server'`
 *   exports, which makes them public HTTP endpoints taking a JSON object. The type
 *   annotation is a compile-time claim about that object and nothing checks it at
 *   runtime, so both were spreading whatever keys arrived straight onto the row.
 *
 * WHY IT MATTERS MORE THAN THE USUAL MASS-ASSIGNMENT ARGUMENT
 *   The `people` UPDATE policy deliberately lets a member write their OWN row —
 *   otherwise nobody could edit their own profile — and a policy is a predicate over
 *   the row, with no opinion about which of its columns changed. So every column on
 *   `people` was writable by its owner, and Phase 3 put `membership_status` there.
 *   `saveProfileSection({ membership_status: 'approved' })` was a self-approval posted
 *   to the one endpoint a pending member is meant to be able to reach.
 *
 *   `updateUserProfile` had the same shape with the service-role client, where RLS is
 *   not involved at all — so it could also write `user_id`, `family_code` or
 *   `created_by` onto any row in any family.
 *
 * A plain module, not a `'use server'` one: Next.js allows only async functions to be
 * exported from those, and both call sites need the set itself.
 */
export const WRITABLE_PROFILE_COLUMNS: readonly string[] = [
  'prefix', 'first_name', 'middle_name', 'last_name', 'nick_name', 'suffix',
  'primary_email', 'primary_phone',
  'street_address', 'apartment', 'city', 'state', 'zip_code', 'country',
  'date_of_birth', 'sunset_date',
  'tshirt_category', 'tshirt_size',
  'chapter_id', 'time_zone',
]

const ALLOWED = new Set<string>(WRITABLE_PROFILE_COLUMNS)

/**
 * Drop every key that is not a writable profile column.
 *
 * Silently, rather than erroring: an unknown field is version skew between a cached
 * client bundle and the server, and the fields that ARE known should still save.
 * Deliberately an allow-list and not a deny-list — a column added to `people` next
 * month is unwritable by default instead of writable until somebody remembers.
 */
export function pickProfileColumns<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (ALLOWED.has(key)) out[key] = value
  }
  return out as Partial<T>
}
