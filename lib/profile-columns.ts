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
import { NAME_CASE_COLUMNS, toNameCase } from '@/lib/name-case'
import { PHONE_COLUMNS, normalizePhone } from '@/lib/phone-format'

export const WRITABLE_PROFILE_COLUMNS: readonly string[] = [
  'prefix', 'first_name', 'middle_name', 'last_name', 'nick_name', 'suffix',
  'primary_email', 'primary_phone',
  'street_address', 'apartment', 'city', 'state', 'zip_code', 'country',
  'date_of_birth', 'sunset_date',
  // Writable, but NOT validated here — this list decides which keys reach the row and
  // says nothing about their contents. `gender` is confined to its two values by a
  // CHECK constraint (20260810000001), which is the layer a caller who never loads the
  // form cannot get past. See lib/gender.ts.
  'gender',
  'tshirt_category', 'tshirt_size',
  'time_zone',
  // NO `chapter_id`, deliberately, and it is the one column here that was removed
  // rather than never added.
  //
  // Every other column on this list is the SAME VALUE in every family the user belongs
  // to — the sync trigger propagates them, which is what makes "the profile" a single
  // thing that floats. `chapter_id` is the opposite: a chapter belongs to exactly one
  // family, so the column is per-family and is excluded from both directions of
  // people_sync_shared_profile (20260617000000) and inherit_shared_person_profile
  // (20260617000001).
  //
  // It has its own action for that reason — saveChapterAndPropagate, which also carries
  // the member's ACCOUNT-LESS children across with them (it was "minor children" until
  // 20260813000006 dropped that column — the rule always meant "somebody who cannot set
  // their own chapter", and `user_id IS NULL` is what actually decides that), something a
  // profile save has no business doing. The profile form used to send the column BOTH ways on one submit,
  // and that redundancy was the only thing keeping it on this list.
  //
  // Taking it off closes two of the four write paths that needed the §4 reference check
  // outright: `saveProfileSection` and `updateUserProfile` can no longer name a chapter
  // at all, in any family. Both keep their guard as a second layer — see the note there.
]

const ALLOWED = new Set<string>(WRITABLE_PROFILE_COLUMNS)

/**
 * The columns on this list that are NOT text, and therefore cannot accept `''`.
 *
 * ── WHY THIS EXISTS: CLEARING A DATE WAS AN ERROR, NOT A SAVE ──────────────────────
 * An `<input type="date">` with nothing in it submits an EMPTY STRING, not null — the
 * platform has no other way to say "blank". Postgres refuses that for a `date` column with
 * `invalid input syntax for type date: ""` (22007), so a member or an administrator who had
 * never set a birthdate could not save the form at all: the field they had not filled in was
 * the field that broke the write. Every other field on the panel was lost with it, because the
 * whole UPDATE is one statement.
 *
 * It presented as an editing bug and it is a TYPE bug, which is why the fix belongs here
 * rather than in a form. Three surfaces write these columns — `saveProfileSection`,
 * `editPersonRecord` and `updateUserProfile` — and all three go through
 * `pickProfileColumns`, so this is the one place that covers them. Fixed in a form it would
 * have been fixed in one of the three.
 *
 * ── WHY ONLY THESE TWO, AND WHAT TO DO WHEN A THIRD ARRIVES ───────────────────────
 * Every other writable profile column is `text`, which accepts `''` happily. So this is not
 * "coerce empty strings everywhere" — that would be a different and larger decision about
 * whether a cleared middle name is `''` or NULL, which the directory has never needed to
 * answer and which no error is forcing. It is specifically: a column whose TYPE rejects the
 * only value a blank input can send.
 *
 * A `date`, `numeric`, `integer`, `uuid` or `boolean` column added to
 * `WRITABLE_PROFILE_COLUMNS` needs its name here in the same commit. The failure mode if it is
 * forgotten is loud (a 22007-shaped error the moment somebody clears the field) rather than
 * silent, which is the right way round — but it is loud in production and quiet in review, so
 * the two lists are worth reading together.
 */
const BLANK_IS_NULL = new Set<string>(['date_of_birth', 'sunset_date'])

/**
 * Drop every key that is not a writable profile column, and NORMALISE the ones that have a
 * canonical form.
 *
 * Silently, rather than erroring: an unknown field is version skew between a cached
 * client bundle and the server, and the fields that ARE known should still save.
 * Deliberately an allow-list and not a deny-list — a column added to `people` next
 * month is unwritable by default instead of writable until somebody remembers.
 *
 * ── WHY NORMALISATION LIVES HERE, IN THE FILTER, RATHER THAN BESIDE IT ──────────────
 * This function's header used to say it "decides which keys reach the row and says nothing
 * about their contents", and that separation was clean right up to the point where it had a
 * cost. Two columns have a canonical form — a name's capitalisation and a phone number's
 * country code — and both were being stored however they happened to be typed, so the
 * directory held "mary allen", "MARY ALLEN" and "Mary Allen" as three kinds of record and
 * four renderings of one phone number.
 *
 * A second exported function would have been tidier and would be applied at two of the three
 * call sites within a year. THIS is the chokepoint every profile write already passes
 * through — `saveProfileSection`, `updateUserProfile` and `editPersonRecord` — and it is
 * exactly the argument that put the allow-list here rather than in each action. One
 * function, enforced by construction; the alternative is enforced by memory.
 *
 * BOTH NORMALISERS ARE CONSERVATIVE BY DESIGN and neither can reject a value. Read their
 * headers before widening either: `toNameCase` leaves any mixed-case name untouched because
 * mixed case is a signal of intent, and `normalizePhone` returns anything it does not
 * recognise unchanged rather than guessing. A normaliser that refuses a save, or that
 * "corrects" `McDonald`, is a worse bug than the inconsistency it set out to fix.
 *
 * `undefined` is passed through by both, so a PATCH that omits a field still omits it —
 * writing a normalised `null` over a name the form never showed is how a partial update
 * silently clears a column.
 */
export function pickProfileColumns<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!ALLOWED.has(key)) continue

    // Only strings are normalised. A caller could hand any JSON value for any key — these
    // are public endpoints — and handing a number to a string normaliser would coerce it
    // into the row as text. Leave a non-string exactly as it arrived and let the column's
    // own type or CHECK constraint refuse it, which is the layer that can.
    // BEFORE the normalisers, because a blank is not a value either of them should see and
    // `''` is what an emptied `<input type="date">` sends. `.trim()` first: a field the browser
    // has autofilled and the member has cleared can come back as whitespace.
    if (typeof value === 'string' && BLANK_IS_NULL.has(key) && value.trim() === '') {
      out[key] = null
    } else if (typeof value === 'string' && NAME_COLUMNS.has(key)) {
      out[key] = toNameCase(value)
    } else if (typeof value === 'string' && PHONE_SET.has(key)) {
      out[key] = normalizePhone(value)
    } else {
      out[key] = value
    }
  }
  return out as Partial<T>
}

const NAME_COLUMNS = new Set<string>(NAME_CASE_COLUMNS)
const PHONE_SET = new Set<string>(PHONE_COLUMNS)
