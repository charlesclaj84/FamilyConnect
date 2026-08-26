/**
 * A gathering's occurrences, reached straight through PostgREST — because no action can reach
 * that policy.
 *
 * ── WHY THIS FILE EXISTS BEFORE ANYTHING HAS GONE WRONG ─────────────────────────────
 * AGENTS.md §7 states the rule outright, and it was learned the expensive way on
 * `position_journal_notes`: *"Every child table added under a scoped parent owes a `raw/` SELECT
 * probe of its own, unless you have watched its policy's conjunct come out and something go
 * red. The tell is an action that reads a parent and then filters the child by ids the parent
 * returned."*
 *
 * That is exactly the shape of every read of this table:
 *
 *     getGatheringDetail reads the GATHERING first, then its occurrences with
 *     `.in('gathering_id', [gatheringId])` — one id it already holds. getCalendarMonth is the
 *     same one row wider: it reads the gatherings the caller may see and asks for the
 *     occurrences of THOSE. For a caller who may see no gathering, neither function ever
 *     mentions an occurrence, so the parent's policy answers for both tables and
 *     `gathering_occurrences_select` is never consulted.
 *
 * Neither query is wrong — narrowing to the rows you can see is what a read should do. It means
 * the child's policy has to be reached with no action in the way. **A member who knows a
 * gathering id can ask PostgREST for its occurrences directly**, which is the whole attack here.
 *
 * ── WHAT A ROW HERE IS, AND WHY IT IS WORTH A PROBE ─────────────────────────────────
 * When and where a family gathers, with times. Not a secret in the way an officer's notes are —
 * `gatherings:view` defaults to `'everyone'` — and that is the point of testing the conjunct
 * that is NOT the grant: `auth_may_see_gathering()` carries the FAMILY and the APPROVAL as well,
 * and a family's calendar is exactly the sort of thing a stranger who has typed a family code
 * and not been admitted should not be reading.
 *
 * ── AND IT IS THE ONE PLACE THE RECURSION WOULD SHOW ────────────────────────────────
 * `20260826000001` uses a SECURITY DEFINER helper rather than an inline `EXISTS`, pre-empting
 * AGENTS.md §7's 42P17 entry. A 42P17 returns nothing to EVERYBODY, so every cross-family
 * assertion would pass over it — the POSITIVE CONTROLS below are what would notice, which is
 * the fourth time that argument has been made in this suite and the reason each of these cases
 * has one.
 *
 * Each function takes no actor argument, exactly as a server action's `createClient()` takes
 * none — `currentActor()` supplies it, and `run.mjs` drives these like any other module.
 *
 * ── EVERY PROBE RETURNS THE ERROR ───────────────────────────────────────────────────
 * `42501` (refused) and `[]` (matched nothing) are opposite facts that look identical in a
 * response. `raw.mjs`'s header carries the full argument.
 */
import { rawInsert, rawSelect } from '../raw.mjs'

/**
 * Every occurrence the caller can read.
 *
 * `gathering_id` and `family_code` come back so a case can assert on WHICH row arrived rather
 * than on a count — a count-shaped assertion passes over a policy that returns the wrong
 * family's rows in the right quantity.
 */
export async function selectOccurrences() {
  return rawSelect(
    'gathering_occurrences',
    'id, gathering_id, family_code, starts_on, start_time, ends_on, end_time',
  )
}

/**
 * File an occurrence against a gathering, straight through PostgREST.
 *
 * ── NO WRITE POLICY EXISTS, WHICH IS WHAT THIS ASSERTS ─────────────────────────────
 * §2c: a table in `public` is born writable by `anon` and `authenticated`, and RLS is the whole
 * gate — so a table with a SELECT policy and no INSERT policy denies the insert outright, with
 * a 42501. That is the arrangement `20260819000000` chose for all six Gatherings tables and
 * this is the seventh; the migration asserts the policy COUNT, and this asserts what the count
 * means from the outside.
 *
 * `rawInsert` takes no `.select()`, for the reason `raw.mjs` states: PostgreSQL ANDs the SELECT
 * policy into any statement carrying a RETURNING clause, so a probe with one reports a refusal
 * that came from the wrong policy.
 */
export async function insertOccurrence(familyCode, gatheringId, startsOn) {
  return rawInsert('gathering_occurrences', {
    family_code: familyCode,
    gathering_id: gatheringId,
    starts_on: startsOn,
    position: 99,
  })
}
