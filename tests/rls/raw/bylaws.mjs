/**
 * `perm:bylaws:select`, reached straight through PostgREST — because the action in front of
 * it answers for half the policy and hides the other half completely.
 *
 * ── WHY THIS FILE EXISTS, AND IT IS A MUTATION CHECK THAT SAID SO ───────────────────
 * The policy is two conjuncts:
 *
 *     family_code = auth_family_code()  AND  auth_membership_approved()
 *
 * `BYLAW_CASES` in `cases.mjs` covers both through `getBylaws`, and only one of those
 * coverages is real. Measured 2026-08-22, each mutation reverted before the next:
 *
 *     the FAMILY conjunct removed (policy `USING (true)`)
 *       -> `bylaws.getBylaws` goes RED. The action-shaped case is genuine evidence.
 *     the APPROVAL conjunct removed (policy `USING (family_code = auth_family_code())`)
 *       -> `bylaws.getBylaws (pending member)` STAYS GREEN.
 *
 * The second is AGENTS.md's "an action narrowed by hand hides its own policy", arriving
 * through a GUARD rather than through a filter: `getBylaws` opens with `requireMember()`, which
 * refuses an applicant and returns `[]` before a query is ever sent. So the applicant case is
 * evidence for the guard and for nothing else, and the conjunct that is supposed to be holding
 * the database shut is asserted by nothing.
 *
 * That is not a flaw in the action — checking membership before reading is the right order.
 * It means the conjunct has to be reached with no action in the way, exactly as
 * `raw/journals.mjs` had to be for the office conjunct and `raw/elections.mjs` for the area
 * one. **An applicant who has joined by family code holds a real JWT and can ask PostgREST for
 * the table directly**, which is the whole attack this probe makes.
 *
 * ── WHAT A ROW HERE IS ──────────────────────────────────────────────────────────────
 * The rules a family agreed to live by, plus `file_path` — the object key for a file in the
 * PRIVATE `documents` bucket. The second is the sharper half: a leaked row is not only what
 * the bylaws say, it is what to ask storage for.
 *
 * ── THE ERROR IS NEVER DISCARDED ────────────────────────────────────────────────────
 * `42501` (refused) and `[]` (matched nothing) are opposite facts that look identical in a
 * response. `raw.mjs`'s header carries the full argument.
 */
import { rawSelect } from '../raw.mjs'

/**
 * Every bylaw the caller can read, straight off PostgREST.
 *
 * `family_code` comes back so a case can assert on WHOSE row arrived rather than on a count,
 * and `file_path` because it is the half of the row that is a credential rather than prose.
 */
export async function selectBylaws() {
  return rawSelect('bylaws', 'id, family_code, title, file_path')
}
