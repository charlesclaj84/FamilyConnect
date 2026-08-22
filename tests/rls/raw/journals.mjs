/**
 * The journal notes and the meeting attendee lists, reached straight through PostgREST —
 * because no server action can reach either policy.
 *
 * ── WHY THIS FILE EXISTS, AND IT IS THE MUTATION CHECK THAT SAID SO ─────────────────
 * `20260822000001` put a SELECT policy on `position_journal_notes` whose whole content is
 * `auth_holds_journal_entry_office(entry_id)` — do you hold the office this topic belongs to.
 * The first pass at testing it used the action, `getJournalEntries`, and that case passed.
 *
 * It also passed with the conjunct DELETED. Measured, on the day it was written: 43/43 green
 * with the notes SELECT policy reduced to family plus approval. The reason is AGENTS.md's
 * "an action that narrows a write by hand hides its own policy from the suite", in its read
 * form and one table down:
 *
 *     getJournalEntries reads the ENTRIES first, whose policy still tests the office, and
 *     then reads notes with `.in('entry_id', <the ids it just got back>)`. For a caller who
 *     holds no office that list is empty, so the function returns before it ever asks about
 *     a note. The entries policy answers for both tables and the notes policy is never
 *     consulted.
 *
 * That is not a flaw in the action — narrowing to the entries you can see is the right query.
 * It means the notes policy has to be reached with no action in the way, exactly as
 * `tests/rls/raw/elections.mjs` had to be for the area conjunct and `sweep.mjs` for the
 * policies `lib/notifications.ts` keeps off the URL space. **A member who knows an entry id
 * can ask PostgREST for its notes directly**, which is the whole attack these probes make.
 *
 * ── AND THE ATTENDEE LIST IS THE SAME SHAPE, WITH A SECOND REASON ───────────────────
 * `position_journal_attendees` is read by the action under the same `.in()` narrowing, AND it
 * is only asked for at all when the entries that came back include a meeting. Two layers of
 * app-side narrowing over one policy.
 *
 * ── WHAT A ROW HERE IS ──────────────────────────────────────────────────────────────
 * Worth stating because it is what makes these the sharpest probes in the suite: a note is an
 * officer's working prose — half-finished reconciliations, what went wrong at the last
 * reunion, who to call about the hall — and an attendee row is a list of relatives who sat in
 * a room. Neither is family-wide data that a permission grant releases. `journals:view`
 * defaults to 'everyone' and buys nothing here, by design, so if these policies do not hold
 * there is nothing else in the product that does.
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
 * Every journal note the caller can read.
 *
 * `entry_id` and `author_id` come back so a case can assert on WHICH note arrived rather than
 * on a count: the fixture's two office-holders have each written one, and a policy that
 * tested the byline instead of the office would let each of them see only their own — which
 * is a different bug from a leak and would pass a count-shaped assertion.
 */
export async function selectJournalNotes() {
  return rawSelect('position_journal_notes', 'id, entry_id, author_id, body, family_code')
}

/**
 * A note filed against an entry, under a byline the caller chooses.
 *
 * ── WHY THE BYLINE IS A PARAMETER HERE AND NEVER IN THE ACTION ──────────────────────
 * `addJournalNote` takes no `author_id` at all — it reads the caller's own person id from the
 * guard, which is AGENTS.md §2b ("never take an identity as a parameter"). That is exactly
 * why the INSERT policy's `author_id = auth_person_id()` conjunct is unreachable from the
 * action: the action can only ever send the value the policy demands, so the conjunct is
 * satisfied by construction and deleting it changes nothing any action-shaped case can see.
 *
 * The endpoint underneath takes whatever it is given. This probe sends what the action refuses
 * to send — somebody else's person id — and the policy is the only thing that can refuse it.
 *
 * NO `.select()`, per `raw.mjs`: PostgreSQL ANDs the SELECT policy into any statement carrying
 * a RETURNING clause, so a probe with one would report a refusal that came from the wrong
 * policy. The case's own probe reads the row back through the service role instead.
 */
export async function insertJournalNote(familyCode, entryId, authorId, body) {
  return rawInsert('position_journal_notes', {
    family_code: familyCode, entry_id: entryId, author_id: authorId, body,
  })
}

// ── TWO ATTENDEE PROBES LEFT WITH THEIR TABLE, 2026-08-22 ──────────────
// `position_journal_attendees` is dropped (`20260822000019`). `selectMeetingAttendees` and
// `insertMeetingAttendee` went with it, along with the four cases that used them.
//
// WHAT THEY WERE FOR is worth keeping as a note, because the same shapes exist on the new
// tables and are covered differently: the SELECT probe reached a policy two layers of
// app-side narrowing hid, and the INSERT probe was the only route to a guard trigger under a
// service-role write. On `meeting_*` the second of those is exercised by the migration
// itself, against real rows; the first has no probe yet and `tests/rls/seed.mjs` says so.
