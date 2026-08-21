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
 *      policy was satisfied by `review/elections:view = 'any'`, which every member holds by
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
import { rawSelect } from '../raw.mjs'

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
