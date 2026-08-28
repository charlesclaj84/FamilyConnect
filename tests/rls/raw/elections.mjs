/**
 * The election policies, reached straight through PostgREST — because no server action can
 * reach them.
 *
 * ── WHY THIS FILE EXISTS, AND IT IS THE MUTATION CHECK THAT SAID SO ─────────────────
 * `20260821000001` narrowed every policy on the four election tables with
 * `auth_may_see_election()`, so one chapter's election is refused to the rest of its own
 * family at the database. The first pass at testing that used the ACTIONS —
 * `getElectionsForMember`, `getElectionDetail` — and those cases passed.
 *
 * They also passed with the conjunct REPLACED BY `true`. Measured, on the day it was written:
 * every one of the four election policies neutered, and the suite reported 649/649. The reason
 * is that `lib/election-area.ts` filters in the app as well (AGENTS.md §5, and it has to —
 * `getElectionResults` reads on the service role where no policy applies), so an
 * action-shaped case can never tell which layer refused. A green case that stays green under
 * the mutation is not evidence, which is the whole of AGENTS.md §7's argument.
 *
 * So these probes call PostgREST with no action in the way, exactly as
 * `tests/rls/raw/sweep.mjs` does for the policies `lib/notifications.ts` keeps off the URL
 * space. The POLICY is the only thing that can refuse them.
 *
 * ── THE TWO THINGS THEY ARE FOR ─────────────────────────────────────────────────────
 *   1. **The area boundary**, which is a rule INSIDE one family. `alphaOther` is in the
 *      chapter and `alphaMember` is in none, so the pair differ in nothing else — same
 *      family, same template, same approval.
 *   2. **The secret ballot.** Until 20260821000001 `election_votes`' cross-member SELECT
 *      policy was satisfied by `community/elections:view = 'any'`, which every member holds by
 *      default, so any signed-in member could read every vote in the family off PostgREST —
 *      who voted and for whom. It demands `admin/elections:view` now. No action exposes that
 *      read at all (`getElectionResults` tallies on the service role), so a probe is the ONLY
 *      way to assert it.
 *
 * Each function takes no actor argument, exactly as a server action's `createClient()` takes
 * none — `currentActor()` supplies it, and `run.mjs` drives these like any other module.
 *
 * ── EVERY PROBE RETURNS THE ERROR ───────────────────────────────────────────────────
 * `42501` (refused) and `[]` (matched nothing) are opposite facts that look identical in a
 * response. `raw.mjs`'s header carries the full argument; here the shape is that a SELECT
 * probe hands back rows AND the error, so a case can tell the two apart.
 */
import { rawDelete, rawRpc, rawSelect } from '../raw.mjs'

/**
 * Every election the caller can read. The scope columns come back so a case can assert on the
 * LEVEL as well as on the row.
 */
export async function selectElections() {
  return rawSelect('elections', 'id, title, family_code, status, scope, chapter_id, region_id')
}

/**
 * Every nomination the caller can read.
 *
 * `election_nominations` carries a real `self_expr` (`nominee_id = auth_person_id()`) so a
 * nominee always reaches their own row whatever the family has done to `elections:view` — and
 * that survives the area narrowing, because a nominee is in the area by construction. The
 * probe is what shows the two rules composing rather than one overriding the other.
 */
export async function selectElectionNominations() {
  return rawSelect('election_nominations', 'id, election_id, nominee_id, accepted')
}

/**
 * Every vote the caller can read. THE SECRET BALLOT PROBE.
 *
 * Two policies are OR-ed over this table: `perm:voters can see own votes`, which is the one a
 * member is entitled to, and `perm:admins can view all votes`, which is the one that used to
 * admit everybody. A case asserts on `voter_id`: a member must see their own row and no other.
 */
export async function selectElectionVotes() {
  return rawSelect('election_votes', 'id, election_id, voter_id, nominee_id')
}

/**
 * Try to take somebody ELSE's name off a nomination, straight through PostgREST.
 *
 * ── WHY THE ACTION CANNOT TEST THIS, WHICH IS THIS FILE'S WHOLE ARGUMENT AGAIN ──────
 * `retractNomination` states `.eq('person_id', g.personId)` in its own statement — belt on
 * the policy's brace, and deliberate: without it the DELETE asks to remove EVERY supporter of
 * the nomination and is narrowed to one row only by `perm:family can retract a nomination`,
 * so a future widening of that policy would silently turn the control into "remove
 * everybody's nomination".
 *
 * The cost is that no action-shaped case can reach the policy's `person_id =
 * auth_person_id()` conjunct: the action narrows to the caller first, so the attack half
 * passes with that conjunct deleted. Measured, exactly as this file's header describes for
 * the area rule — the conjunct removed, the suite still green.
 *
 * So the probe sends what the action refuses to send: a DELETE aimed at another member's
 * supporter row, by both key columns, with nothing in the way but the policy.
 */
export async function deleteNominationSupport(nominationId, personId) {
  return rawDelete('election_nomination_supporters',
    { nomination_id: nominationId, person_id: personId })
}

/**
 * Ask the database whether a window is open, as a real member, through the real grant.
 *
 * ── WHY THIS IS THE ONLY HONEST TEST OF `20260826000005` ─────────────────────────────
 * That migration repaired `election_window_open()`, which decided the window with
 * `CURRENT_DATE` — the DATABASE's date, and on hosted Supabase that is UTC. For a family in
 * Central time voting stopped at 19:00 CDT on the closing day and nominations opened five
 * hours early, and the refusal came from an RLS policy rather than from a form.
 *
 * NOTHING ELSE CAN SEE THE REPAIR:
 *
 *   * An action-shaped case cannot. `castVote` and `submitNomination` check
 *     `electionPhase(...)` in TypeScript FIRST and return before sending anything, so the
 *     policy is never consulted — AGENTS.md §7's "a guard hides a policy" in its exact form.
 *   * The migration's verify block cannot. The function opens with
 *     `public.auth_family_code()`, which needs a session, and a migration has none — so it
 *     returns `false` for every call from a `DO` block whatever the dates say.
 *   * A test that fixes the clock cannot. `now()` is not overridable from the client, so the
 *     only variable a probe can move is THE ZONE.
 *
 * So this probe takes the zone as the discriminator: the same election, the same window dates,
 * asked twice with two different zones stamped on it. Under the repair the answers differ;
 * under `CURRENT_DATE` they are identical, because the zone is not consulted at all.
 *
 * `rawRpc` rather than a table probe, because the function IS the subject. It is granted to
 * `authenticated` (§2b), so PostgREST publishes it — which is also why this is a real
 * end-to-end check of that grant rather than only of the arithmetic.
 */
export async function electionWindowOpen(electionId, window) {
  return rawRpc('election_window_open', { p_election_id: electionId, p_window: window })
}
