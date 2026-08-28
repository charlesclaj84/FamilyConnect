import type { SupabaseClient } from '@supabase/supabase-js'

import {
  normaliseWhen, whenEnvelope, whenProblems,
  type GatheringWhen,
} from '@/lib/gathering-when'

/**
 * Writing a gathering's occurrences — the one place it happens.
 *
 * ── A PLAIN MODULE TAKING THE ADMIN CLIENT, WHICH IS `lib/dues-routing.ts`'s SHAPE ──
 * Three actions write a gathering's dates: `scheduleGathering` (the member's), `createGathering`
 * and `updateGathering` (the organizer's). All three live in `'use server'` files, so a helper
 * shared between them cannot live in either of those — everything exported from one gets a URL,
 * and an exported "write these occurrences" function would be a public endpoint that takes a
 * gathering id and a set of dates with no gate of its own.
 *
 * So it is here, and it takes the client as a parameter. `lib/chapter-propagation.ts` is the
 * precedent and its header carries the second reason: `npm run audit:family-scope` decides which
 * client a file uses by whether the FILE imports `createAdminClient`, so a helper that named it
 * would put every query in this module on the review list rather than the ones that matter.
 *
 * ── REPLACE, NOT MERGE, AND THE ORDER IS LOAD-BEARING ──────────────────────────────
 * `writeOccurrences` deletes the gathering's rows and inserts the new set. Diffing them would be
 * cheaper and is wrong here: an occurrence has no identity a form could carry — it is a date and
 * two times — so "the same occasion, moved" and "one occasion removed and another added" are
 * indistinguishable from the outside, and a diff would have to guess.
 *
 * The DELETE runs first and the INSERT second, inside one action rather than one transaction —
 * supabase-js has no transaction — so a failure between them leaves a gathering with no
 * occurrences. `tg_gathering_when_envelope` is written for exactly that: with zero rows it
 * leaves the envelope alone rather than clearing it, so the gathering keeps the dates it had and
 * stays on the calendar where somebody can see it and fix it. That is why the trigger has that
 * branch, and it must not be "simplified" into clearing the columns.
 */

type AdminClient = SupabaseClient

export type WhenWriteResult =
  | { ok: true; startsOn: string; endsOn: string | null }
  | { ok: false; message: string }

/**
 * What each problem says to a CALLER of an action, as opposed to somebody looking at the form.
 *
 * Separate from `WHEN_PROBLEM_TEXT` because the audiences differ: the form's copy can say "that
 * is not a date we can read" beside the box it means, and an action's has to name the thing it
 * is talking about because there is no box. Same codes, so the two cannot describe different
 * rules.
 */
function messageFor(problems: ReturnType<typeof whenProblems>): string {
  const first = problems[0]
  switch (first?.code) {
    case 'no-occurrence':
      return 'Give a date for this gathering.'
    case 'bad-date':
      return 'That is not a date we can read.'
    case 'bad-time':
      return 'That is not a time we can read.'
    case 'end-before-start':
      return 'The end of a gathering cannot be before its start.'
    case 'end-time-before-start':
      return 'On a single day, the end time has to be after the start time.'
    case 'end-time-without-start':
      return 'A gathering with an end time needs a start time as well.'
    case 'continuous-needs-one':
      return 'A continuous gathering is one span, so it has one set of dates.'
    case 'time-needs-zone':
      return 'A gathering with a time needs the timezone that time is in.'
    case 'bad-zone':
      return 'That is not a timezone we recognise.'
    default:
      return 'Those dates are not something we can save.'
  }
}

/**
 * The caller's `when`, or the old `startsOn`/`endsOn` pair read as one.
 *
 * ── ONE FUNCTION, SO THE TWO ACTIONS CANNOT DISAGREE ABOUT WHICH SHAPE WINS ────────
 * `when` does. It is the richer answer, and a caller sending both has already decided.
 *
 * ── AND IT LIVES HERE RATHER THAN BESIDE EITHER ACTION ─────────────────────────────
 * Both callers are `'use server'` files, and everything exported from one gets a URL — so an
 * export shared between them would be a third public endpoint, and Next requires those exports
 * to be async, which this has no reason to be. Same argument as `lib/notifications.ts` and
 * `lib/invitations.ts`: the senders stay in plain modules and the actions import them.
 *
 * ── THE OLD PAIR IS STILL READ, DELIBERATELY ───────────────────────────────────────
 * Not politeness to an imaginary caller. A browser tab open across the deploy posts the old
 * shape, and refusing it would fail a member's schedule with a message about a field their form
 * does not have.
 */
export function whenFromInput(input: {
  when?: GatheringWhen
  startsOn?: string
  endsOn?: string | null
}): GatheringWhen {
  if (input.when) return input.when
  return {
    // NO ZONE, and none is needed: the legacy shape carries no times, so there is nothing for
    // a zone to qualify and `whenProblems` does not ask for one. A tab open across the deploy
    // therefore still schedules successfully rather than being refused for a field its form
    // does not have — which is the whole reason this fallback exists.
    timeZone: null,
    isContinuous: true,
    occurrences: [{
      startsOn: input.startsOn ?? '',
      startTime: null,
      endsOn: input.endsOn || null,
      endTime: null,
    }],
  }
}

/**
 * Validate a proposed `when` and hand back the envelope, or the sentence to refuse with.
 *
 * ── THE SAME FUNCTION THE FORM CALLED (§2) ─────────────────────────────────────────
 * `whenProblems` is the rule; the form in front of the action is a convenience. And the
 * DATABASE states the same three ordering rules a third time as CHECK constraints, which is not
 * belt-and-braces: these actions write on the service role, so those constraints are the only
 * thing underneath them.
 *
 * Returns the envelope because the PARENT insert needs it — `gatherings.starts_on` is NOT NULL
 * and the row exists before its occurrences do. The trigger then recomputes the same value from
 * the children, which its `WHERE` clause makes a no-op.
 */
export function resolveWhen(when: GatheringWhen | undefined | null): WhenWriteResult & {
  normalised?: GatheringWhen
} {
  const proposed: GatheringWhen = {
    isContinuous: when?.isContinuous !== false,
    occurrences: Array.isArray(when?.occurrences) ? when.occurrences : [],
    timeZone: when?.timeZone ?? null,
  }
  const problems = whenProblems(proposed)
  if (problems.length > 0) return { ok: false, message: messageFor(problems) }

  const normalised = normaliseWhen(proposed)
  const env = whenEnvelope(normalised)
  if (!env.startsOn) return { ok: false, message: 'Give a date for this gathering.' }
  return { ok: true, startsOn: env.startsOn, endsOn: env.endsOn, normalised }
}

/**
 * Replace a gathering's occurrences with the given set.
 *
 * ── §3 BY HAND, ON BOTH STATEMENTS ─────────────────────────────────────────────────
 * `.eq('family_code', familyCode)` on the delete as well as on the insert rows. The gathering id
 * came out of a family-scoped read at every call site, so the conjunct is belt-and-braces there
 * — and `deleteRegion` and `revokeRoleByAssignmentId` are both in AGENTS.md as
 * `.eq('id', id)`-was-the-whole-predicate holes written by somebody who knew the rule, so it
 * goes on both.
 *
 * The guard trigger on the table refuses a cross-family parent underneath this regardless (§4).
 */
export async function writeOccurrences(
  admin: AdminClient,
  familyCode: string,
  gatheringId: string,
  when: GatheringWhen,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // ── THE PARENT'S ZONE FIRST, AND THE ORDER IS LOAD-BEARING ───────────────────────
  // `gatherings_time_needs_zone` is a CHECK on the PARENT, and the parent's `start_time` is
  // written by `tg_gathering_when_envelope` from the rows inserted below — so inserting a timed
  // occurrence against a parent with no zone fires the trigger, fails the constraint, and takes
  // the whole insert with it. Measured before this line existed: `INSERT 0 1` on the parent,
  // then `ERROR: new row for relation "gatherings" violates check constraint
  // "gatherings_time_needs_zone"`.
  //
  // Stamped HERE rather than left to each caller, so the invariant holds for both of them and
  // for a third written later. `scheduleGathering` also puts it on the parent insert, which is
  // belt on this brace; `updateGathering` relies on this entirely.
  //
  // `normaliseWhen` has already cleared the zone where nothing is timed, so this writes NULL in
  // that case rather than leaving a zone qualifying nothing.
  const { error: zoneError } = await admin
    .from('gatherings')
    .update({ time_zone: when.timeZone })
    .eq('id', gatheringId)
    .eq('family_code', familyCode)
  if (zoneError) {
    console.error(`[gatherings] could not set the zone for ${gatheringId}: ${zoneError.message}`)
    return { ok: false, message: 'Could not save when this gathering happens.' }
  }

  const { error: deleteError } = await admin
    .from('gathering_occurrences')
    .delete()
    .eq('gathering_id', gatheringId)
    .eq('family_code', familyCode)
  if (deleteError) {
    console.error(`[gatherings] could not clear occurrences for ${gatheringId}: ${deleteError.message}`)
    return { ok: false, message: 'Could not save when this gathering happens.' }
  }

  const rows = when.occurrences
    .filter(o => o.startsOn)
    .map((o, position) => ({
      family_code: familyCode,
      gathering_id: gatheringId,
      starts_on: o.startsOn,
      start_time: o.startTime,
      ends_on: o.endsOn,
      end_time: o.endTime,
      // ENTRY ORDER, which is what `position` means on that table — not date order. See its
      // column comment: a family adding a forgotten Saturday to the middle of a series should
      // not have the list resequence itself.
      position,
    }))

  if (rows.length === 0) {
    // Unreachable through `resolveWhen`, which refuses an empty set — and stated rather than
    // assumed, because the trigger's zero-row branch would otherwise silently leave a gathering
    // with the dates it had and report success.
    return { ok: false, message: 'Give a date for this gathering.' }
  }

  const { error: insertError } = await admin.from('gathering_occurrences').insert(rows)
  if (insertError) {
    // A 23514 here is one of the three CHECK constraints, which `resolveWhen` has already
    // refused — so reaching this is a caller that bypassed it or a rule the two disagree about.
    // Loud, because the second would be a real defect.
    console.error(`[gatherings] could not write occurrences for ${gatheringId}: ${insertError.message}`)
    return { ok: false, message: 'Could not save when this gathering happens.' }
  }

  return { ok: true }
}

/**
 * Read a gathering's occurrences back, in entry order.
 *
 * ON THE CLIENT THE CALLER HANDS IT, so a read that should be scoped by RLS can be and one that
 * needs the service role can be too. `family_code` is applied by hand either way (§3).
 */
export async function readOccurrences(
  db: AdminClient,
  familyCode: string,
  gatheringIds: readonly string[],
): Promise<Map<string, GatheringWhen['occurrences']> | null> {
  if (gatheringIds.length === 0) return new Map()
  const { data, error } = await db
    .from('gathering_occurrences')
    .select('gathering_id, starts_on, start_time, ends_on, end_time, position')
    .eq('family_code', familyCode)
    .in('gathering_id', [...gatheringIds])
    .order('position', { ascending: true })

  // §8: `const { data }` discards the error, and an empty map here would render every gathering
  // as having no dates — which on a calendar is an empty month presented as a fact. Null is the
  // caller's signal to report rather than to draw.
  if (error) {
    console.error(`[gatherings] occurrence read failed for ${familyCode}: ${error.message}`)
    return null
  }

  const out = new Map<string, GatheringWhen['occurrences']>()
  for (const row of data ?? []) {
    const id = row.gathering_id as string
    const list = out.get(id) ?? []
    list.push({
      startsOn: row.starts_on as string,
      // NORMALISED ON THE WAY OUT. Postgres hands back `11:00:00` and every consumer — the form,
      // the calendar's label, the comparison in `whenProblems` — expects `HH:MM`. Doing it here
      // means no consumer has to remember.
      startTime: trimTime(row.start_time as string | null),
      endsOn: (row.ends_on as string | null) ?? null,
      endTime: trimTime(row.end_time as string | null),
    })
    out.set(id, list)
  }
  return out
}

function trimTime(raw: string | null): string | null {
  return raw ? raw.slice(0, 5) : null
}
