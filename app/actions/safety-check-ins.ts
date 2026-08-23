'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/auth/guard'
import { can, canAny } from '@/lib/auth/permissions'
import { belongsToFamily } from '@/lib/auth/family'
import { emailOrigin, sendEmail } from '@/lib/email/send'
import { safetyCheckInEmail } from '@/lib/email/templates'
import { notifySafetyCheckIn } from '@/lib/notifications'
import {
  checkInProgress,
  resolveRoster,
  tally,
  type CheckInAudience,
  type CheckInCandidate,
  type CheckInProgress,
  type CheckInReach,
  type CheckInResponse,
  type CheckInScope,
  type CheckInTally,
  type RosterRow,
} from '@/lib/safety-check-in'

/**
 * Emergency check-in — `/community/safety-check-ins`, Free.
 *
 * A hurricane crosses the Gulf coast. Somebody with the grant raises a check-in addressed to
 * the relatives who live there; everybody addressed is asked *are you safe?* and answers with
 * one tap. Whoever raised it watches a roster fill in.
 *
 * FutureFeature.md §5 argued the whole design before any of it existed, and one sentence in it
 * governs every decision below: **the unanswered column is the product.** Everything here that
 * looks like over-engineering is in service of keeping that column honest.
 *
 * ── TWO DIFFERENT GATES, AND THE SECOND IS THE ABUSE CASE ──────────────────────────
 * §5's fourth decision, implemented exactly:
 *
 *   RAISING is `canAny`, never `can`. It is family-wide operation with no coherent "own"
 *   version, and *"a false alarm to the whole family at 3 a.m. is exactly what the grant
 *   exists to prevent"*. Same argument as a disbursement paying the person recording it.
 *
 *   ANSWERING is self-service — `requireMember()`, the caller's own row, no grant at all.
 *   `create` and `edit` default to scope `'none'` on a template, so demanding a grant here
 *   would lock the whole family out of answering, which is AGENTS.md §2's worked example in
 *   its most literal form.
 *
 * AND THERE IS NO "I SPOKE TO HER, SHE'S FINE". §5 names it as *"the most requested feature in
 * every system of this kind"* and as a write to somebody else's row. Nothing here accepts a
 * `personId` on an answer; `answerCheckIn` resolves the row from the caller's own guard.
 *
 * ── NOTHING RAISES A CHECK-IN AUTOMATICALLY ────────────────────────────────────────
 * There is no alert-feed poller and no scheduler in this module, and the migration's header
 * argues why at length. The short version is that an automated raiser is §5's 3 a.m. abuse case
 * arriving from a robot, and that a scheduled job has no `auth.uid()` — so automating the RAISE
 * means inventing a system actor and hanging the family's most sensitive write off it. If a feed
 * is ever wired in it must SUGGEST and a person must RAISE.
 *
 * ── THE ASKING IS CHUNKED, BECAUSE THERE IS NO JOB RUNNER IN THIS PRODUCT ──────────
 * `sendEmail` takes ONE `to` per call and there is no cron, no worker and no queue anywhere
 * here, so the ROSTER ROWS ARE THE QUEUE: `raiseCheckIn` resolves the audience and writes them,
 * `sendCheckInAsks` claims and mails a bounded slice, and the client calls it until nothing is
 * pending. That is `app/actions/distributions.ts`' arrangement, deliberately reused rather than
 * reinvented, and FutureFeature.md tells the next feature of this shape to read that file first.
 *
 * WHAT IT BUYS HERE THAT MATTERS MORE THAN IT DID THERE: the send survives a closed laptop.
 * Somebody raising a check-in during an actual emergency is not a person who will sit and watch
 * a progress bar, and the state is in the table rather than in a request.
 *
 * ── THE ONE THING THIS FEATURE CANNOT DO, SAID OUT LOUD ────────────────────────────
 * §5's first decision: *"Reaching people is the whole feature, and the product cannot do it
 * yet… a check-in nobody receives is worse than none, because it is believed."* The bell needs
 * an open tab and `IdleTimeout` signs a member out after 60 idle minutes, so the honest maximum
 * with today's infrastructure is EMAIL plus a notification, and neither is a guarantee.
 *
 * So every read in this module reports `reach` per person and the screen prints it. The rule
 * that falls out, and it is the one to defend in any future change here:
 *
 *     NO SURFACE MAY SAY "EVERYBODY HAS BEEN ASKED" — the roster says how many were asked, how
 *     many could not be, and why. `inviteMember` is the pattern: it withholds the invitation
 *     token when the send worked and hands it back, with an explicit failure notice, when it
 *     did not.
 *
 * ── EVERY WRITE IS THE ADMIN CLIENT; ONE READ IS DELIBERATELY NOT ──────────────────
 * Neither table has an INSERT, UPDATE or DELETE policy, so §2c denies the browser those
 * outright and these actions are the boundary. `.eq('family_code', …)` is by hand on every
 * statement (§3).
 *
 * `getMyOpenCheckIns` is the exception and uses the USER client on purpose: the policies'
 * `self_expr` is exactly the narrowing that read needs, so RLS can do the work and AGENTS.md
 * §3 says to prefer it where that is true. It is also the one thing in this feature the RLS
 * suite can test against a real policy rather than against a hand-written filter.
 *
 * THE ROSTER READ AT RAISE TIME IS ADMIN-CLIENT, and it is the sharpest §3 decision here — the
 * same one `readRoster` in distributions makes. If the audience narrowed to what the RAISER is
 * entitled to read, a member without `community/directory` at `'any'` would ask a subset of the
 * family and be told everybody had been asked. A wrong number rather than a missing one.
 */

// ── Pacing ────────────────────────────────────────────────────────────────────────────

/**
 * How many relatives one call asks, and how long it waits between them.
 *
 * The same two numbers `app/actions/distributions.ts` argues, bounded by the same two limits
 * nobody here controls — Resend's requests-per-second, and the platform's wall-clock ceiling
 * (10s on some plans, 15s by default on others, and there is no `vercel.json` to raise it).
 * `BATCH_SIZE * SEND_SPACING_MS` is about 6.6 seconds of spacing with the provider call on top.
 * IF YOU RAISE EITHER, DO THE MULTIPLICATION FIRST: exceeding the provider limit records 429s as
 * `failed`, so a pacing bug presents as a delivery problem and sends somebody looking at DNS.
 *
 * A STRANDED `sending` ROW IS RECOVERABLE, which is what `retryCheckInAsks` is for. Without it
 * a killed batch would leave twelve relatives permanently unasked with nothing on the screen
 * able to fix it — and on this feature "permanently unasked" is the failure that matters.
 */
const BATCH_SIZE = 12
const SEND_SPACING_MS = 550

/** Space out the provider calls. `await` on a timer, which is all a rate limit needs. */
function pace(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** A note a relative leaves with their answer. Clipped, not refused — see `answerCheckIn`. */
const NOTE_LIMIT = 500
const TITLE_LIMIT = 120
const DETAIL_LIMIT = 2000

// ── Shapes ────────────────────────────────────────────────────────────────────────────

export interface CheckInRights {
  /** May raise one, and close one. `canAny` on `create`. */
  raise: boolean
  /** May delete the record. `canAny` on `delete`. */
  remove: boolean
  /**
   * May read a full roster — every relative's answer, not just their own.
   *
   * `canAny` on `view`, and it is a SEPARATE question from being on the screen: scope `'own'`
   * is what the General template holds, which admits somebody to the page and to the check-ins
   * they raised. The roster of a check-in somebody else raised is the PII §5's fifth decision
   * is about, so it takes `'any'`.
   */
  seeRoster: boolean
}

/** One check-in as the list renders it. */
export interface CheckInSummary {
  id: string
  title: string
  detail: string | null
  scope: CheckInScope
  areaName: string | null
  status: 'open' | 'closed'
  raisedByName: string | null
  createdAt: string
  closedAt: string | null
  notAddressed: number
  tally: CheckInTally
  progress: CheckInProgress
  /** True where the caller may read every row rather than only their own. */
  rosterVisible: boolean
}

export interface CheckInDetail extends CheckInSummary {
  roster: readonly RosterRow[]
}

/** One audience the raiser can aim at, with what it addresses today. */
export interface CheckInAudienceOption {
  scope: Exclude<CheckInScope, 'named'>
  id: string | null
  label: string
  addressed: number
  /** Of those, how many have no mailbox — the phone calls, stated before the ask goes out. */
  unreachable: number
}

/** One relative the `named` picker offers. */
export interface CheckInPickerPerson {
  personId: string
  firstName: string
  lastName: string
  /** True where there is no mailbox — the picker says so rather than implying an ask will go. */
  unreachable: boolean
}

export interface CheckInComposer {
  audiences: readonly CheckInAudienceOption[]
  people: readonly CheckInPickerPerson[]
}

/** What the Dashboard banner needs: an open check-in I am on, and whether I have answered. */
export interface MyCheckIn {
  checkInId: string
  title: string
  detail: string | null
  raisedByName: string | null
  createdAt: string
  myState: CheckInResponse
  myNote: string | null
}

export interface ActionResult {
  success: boolean
  message?: string
}

// ── The roster, read once, on the admin client ─────────────────────────────────────────

/**
 * Every approved person in the family, with what the addressing rule reads.
 *
 * ── WHY IT COUNTS EVERYBODY, INCLUDING THE PEOPLE IT CANNOT REACH ──────────────────
 * AGENTS.md's PICKER-versus-PROJECTION distinction: a picker is accounts-only because you
 * cannot record a payment from somebody who cannot log in, and a projection counts everybody
 * because a recorded relative is still owed. A roster is a projection, and on this feature that
 * is not a nicety — the recorded grandmother is precisely the person somebody needs to be told
 * to telephone. Leaving her out would make this screen quietly disagree with the Directory AND
 * hide the one relative most at risk of being forgotten.
 *
 * ── §3 BY HAND, AND THE REGION IS DERIVED ──────────────────────────────────────────
 * The service role applies no RLS. `.eq('family_code', …)` is what makes this the family's own
 * roster. The chapter → region walk is done inline rather than through `chapterPlaces`, which
 * returns NAMES where this needs region IDS — the same call `readRoster` in
 * `app/actions/distributions.ts` makes, with the reason written down rather than the shared
 * module bent for one caller.
 */
async function readRoster(familyCode: string): Promise<{
  candidates: CheckInCandidate[]
  ok: boolean
}> {
  const admin = createAdminClient()

  const { data: people, error } = await admin
    .from('people')
    .select('id, first_name, last_name, primary_email, email_is_placeholder, chapter_id')
    .eq('family_code', familyCode)
    .eq('membership_status', 'approved')

  // §8. A REFUSED READ MUST NOT LOOK LIKE AN EMPTY FAMILY, and here that is not a cosmetic
  // distinction: it would be a check-in that addressed nobody and reported itself as sent, in
  // an emergency, to somebody who then stopped looking. The caller is told and nothing is
  // written.
  if (error) {
    console.error(`[safety-check-ins] roster read failed for ${familyCode}: ${error.message}`)
    return { candidates: [], ok: false }
  }

  type PersonRow = {
    id: string
    first_name: string | null
    last_name: string | null
    primary_email: string | null
    email_is_placeholder: boolean | null
    chapter_id: string | null
  }
  const rows = (people ?? []) as PersonRow[]

  const chapterIds = [...new Set(rows.map(r => r.chapter_id).filter((c): c is string => !!c))]
  const regionOf = new Map<string, string | null>()
  if (chapterIds.length > 0) {
    const { data: chapters, error: chapterError } = await admin
      .from('chapters')
      .select('id, region_id')
      .eq('family_code', familyCode)
      .in('id', chapterIds)
    if (chapterError) {
      // SAME RULE, AND IT MATTERS MORE THAN IT LOOKS: with no map every chapter resolves to no
      // region, so every REGIONAL check-in silently addresses nobody. That must not be reported
      // as a family with nobody in that region.
      console.error(
        `[safety-check-ins] chapter regions failed for ${familyCode}: ${chapterError.message}`,
      )
      return { candidates: [], ok: false }
    }
    for (const c of (chapters ?? []) as { id: string; region_id: string | null }[]) {
      regionOf.set(c.id, c.region_id)
    }
  }

  return {
    ok: true,
    candidates: rows.map(r => ({
      personId: r.id,
      firstName: r.first_name ?? '',
      lastName: r.last_name ?? '',
      email: r.primary_email,
      emailIsPlaceholder: r.email_is_placeholder === true,
      chapterId: r.chapter_id,
      regionId: r.chapter_id ? (regionOf.get(r.chapter_id) ?? null) : null,
    })),
  }
}

// ── Reading ───────────────────────────────────────────────────────────────────────────

/** What the caller may do. For the controls, never for the gate. */
export async function getCheckInRights(): Promise<CheckInRights> {
  const g = await requireMember()
  if (!g.ok) return { raise: false, remove: false, seeRoster: false }
  const [raise, remove, seeRoster] = await Promise.all([
    canAny(g.userId, 'community/safety-check-ins', 'create'),
    canAny(g.userId, 'community/safety-check-ins', 'delete'),
    canAny(g.userId, 'community/safety-check-ins', 'view'),
  ])
  return { raise, remove, seeRoster }
}

/**
 * The audiences this family can aim at, and the people a `named` check-in can pick from.
 *
 * ── THE COUNTS ARE THE POINT, AND SO IS THE `unreachable` FIGURE BESIDE THEM ───────
 * *"Everyone in the family (141 · 4 with no email)"* is what lets somebody check the audience
 * against what they meant BEFORE anybody is woken, which is the only moment checking is any
 * use. And stating the unreachable count IN ADVANCE is what stops it reading as a failure
 * afterwards: four relatives with no mailbox is a fact about the family, and the same four
 * discovered in a roster during an emergency looks like the product broke.
 *
 * A REGION OR CHAPTER THAT ADDRESSES NOBODY IS STILL LISTED — the opposite of
 * `getMeetingAttendeeOptions`, which lists only boards somebody holds an office on. There, an
 * empty board is a control that selects nobody. Here, an empty chapter with its count showing IS
 * the answer to "why did nobody in Boston get asked", and hiding it leaves that unanswerable.
 */
export async function getCheckInComposer(): Promise<CheckInComposer> {
  const g = await requireMember()
  if (!g.ok) return { audiences: [], people: [] }
  // `canAny` on `create`, matching `raiseCheckIn`. Reading the audience list in order to raise is
  // the same grant as raising — a read one grant cheaper than the write it exists to set up is
  // the mismatch `getMemberProfileForEdit` documents.
  if (!(await canAny(g.userId, 'community/safety-check-ins', 'create'))) {
    return { audiences: [], people: [] }
  }

  const { candidates, ok } = await readRoster(g.familyCode)
  if (!ok) return { audiences: [], people: [] }

  const admin = createAdminClient()
  const [regionsRes, chaptersRes] = await Promise.all([
    admin.from('regions').select('id, name').eq('family_code', g.familyCode).order('name'),
    admin.from('chapters').select('id, name').eq('family_code', g.familyCode).order('name'),
  ])

  const tallyFor = (audience: CheckInAudience) => {
    const { members } = resolveRoster(candidates, audience)
    return {
      addressed: members.length,
      unreachable: members.filter(m => m.reach === 'skipped').length,
    }
  }

  const audiences: CheckInAudienceOption[] = [{
    scope: 'family',
    id: null,
    label: 'Everyone in the family',
    ...tallyFor({ scope: 'family', regionId: null, chapterId: null, personIds: [] }),
  }]

  // §8 on both. A refused read here would offer a family with regions no regional audience at
  // all, and the raiser would conclude the family has none — then aim wider than they meant.
  if (regionsRes.error) {
    console.error(`[safety-check-ins] regions read failed: ${regionsRes.error.message}`)
  } else {
    for (const r of (regionsRes.data ?? []) as { id: string; name: string }[]) {
      audiences.push({
        scope: 'region',
        id: r.id,
        label: `${r.name} region`,
        ...tallyFor({ scope: 'region', regionId: r.id, chapterId: null, personIds: [] }),
      })
    }
  }
  if (chaptersRes.error) {
    console.error(`[safety-check-ins] chapters read failed: ${chaptersRes.error.message}`)
  } else {
    for (const c of (chaptersRes.data ?? []) as { id: string; name: string }[]) {
      audiences.push({
        scope: 'chapter',
        id: c.id,
        label: `${c.name} chapter`,
        ...tallyFor({ scope: 'chapter', regionId: null, chapterId: c.id, personIds: [] }),
      })
    }
  }

  return {
    audiences,
    // THE PICKER IS EVERY APPROVED PERSON, and it is built for a hundred and fifty (AGENTS.md,
    // "Build every member list for a hundred-member family"). `PersonMultiSelect` is what
    // renders it, so the search, the chips and the honest overflow come with it.
    people: candidates.map(c => ({
      personId: c.personId,
      firstName: c.firstName,
      lastName: c.lastName,
      unreachable: c.emailIsPlaceholder || !(c.email ?? '').trim(),
    })),
  }
}

/** The area's name for one check-in row, or null. Resolved per row rather than embedded. */
async function areaNames(
  familyCode: string,
  regionIds: readonly string[],
  chapterIds: readonly string[],
): Promise<{ regions: Map<string, string>; chapters: Map<string, string> }> {
  const admin = createAdminClient()
  const regions = new Map<string, string>()
  const chapters = new Map<string, string>()

  if (regionIds.length > 0) {
    const { data } = await admin.from('regions').select('id, name')
      .eq('family_code', familyCode).in('id', [...new Set(regionIds)])
    for (const r of (data ?? []) as { id: string; name: string }[]) regions.set(r.id, r.name)
  }
  if (chapterIds.length > 0) {
    const { data } = await admin.from('chapters').select('id, name')
      .eq('family_code', familyCode).in('id', [...new Set(chapterIds)])
    for (const c of (data ?? []) as { id: string; name: string }[]) chapters.set(c.id, c.name)
  }
  return { regions, chapters }
}

type CheckInRow = {
  id: string
  title: string
  detail: string | null
  scope: string
  region_id: string | null
  chapter_id: string | null
  status: string
  raised_by: string | null
  created_at: string
  closed_at: string | null
  not_addressed: number
}

type RosterDbRow = {
  check_in_id: string
  person_id: string
  state: string
  reach: string
  note: string | null
  responded_at: string | null
}

/** People ids -> a display name, for the raiser column and the roster. */
async function nameMap(
  familyCode: string,
  personIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(personIds.filter(Boolean))]
  const names = new Map<string, string>()
  if (ids.length === 0) return names
  const { data } = await createAdminClient()
    .from('people').select('id, first_name, last_name')
    .eq('family_code', familyCode).in('id', ids)
  for (const p of (data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
    names.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed relative')
  }
  return names
}

function summaryOf(
  row: CheckInRow,
  rows: readonly RosterRow[],
  raisedByName: string | null,
  areaName: string | null,
  rosterVisible: boolean,
): CheckInSummary {
  const t = tally(rows)
  const status = row.status === 'closed' ? 'closed' as const : 'open' as const
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    scope: row.scope as CheckInScope,
    areaName,
    status,
    raisedByName,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    notAddressed: row.not_addressed,
    tally: t,
    progress: checkInProgress(t, status),
    rosterVisible,
  }
}

/**
 * Every check-in the caller may read, newest first.
 *
 * `null` MEANS REFUSED AND `[]` MEANS NONE, and the two must stay distinguishable all the way to
 * the screen. §8's rule, and on this feature the cost of conflating them is that somebody reads
 * "no check-ins" as "nothing is happening".
 *
 * ── SCOPE `'own'` IS A REAL WAY TO HOLD THIS KEY, so this is `can` and not `canAny` ──
 * The General template holds `view` at `'own'`, which means "the check-ins I raised, plus my own
 * row in any I was asked about". Demanding `canAny` here would refuse an ordinary member their
 * own list — and it is the SELECT policies that do the narrowing, which is why this one read
 * goes through the user client.
 */
export async function getCheckIns(): Promise<CheckInSummary[] | null> {
  const g = await requireMember()
  if (!g.ok) return null
  if (!(await can(g.userId, 'community/safety-check-ins', 'view'))) return null

  const seeRoster = await canAny(g.userId, 'community/safety-check-ins', 'view')

  // THE USER CLIENT, so the policies decide which check-ins this caller may list. That is
  // AGENTS.md §3's preference where RLS can do the work, and here it genuinely can: `self_expr`
  // admits the ones they were asked about and `own_expr` the ones they raised.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('safety_check_ins')
    .select('id, title, detail, scope, region_id, chapter_id, status, raised_by, created_at, closed_at, not_addressed')
    .eq('family_code', g.familyCode)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[safety-check-ins] list failed in ${g.familyCode}: ${error.message}`)
    return null
  }
  const rows = (data ?? []) as CheckInRow[]
  if (rows.length === 0) return []

  // THE ROSTER READ IS THE ADMIN CLIENT AND IS GATED BY HAND (§5). A caller at scope `'own'`
  // would, through their own client, receive only their OWN row of each check-in — and the
  // counts built from that would say "1 addressed, 1 safe" over a check-in with forty people on
  // it. That is a WRONG number rather than a missing one, which is the argument the four
  // activity reports make. So either they may see the roster and it is read in full, or they may
  // not and the counts are withheld entirely.
  let rosterRows: RosterDbRow[] = []
  if (seeRoster) {
    const { data: roster, error: rosterError } = await createAdminClient()
      .from('safety_check_in_people')
      .select('check_in_id, person_id, state, reach, note, responded_at')
      .eq('family_code', g.familyCode)
      .in('check_in_id', rows.map(r => r.id))
    if (rosterError) {
      // §8 AGAIN, AND THIS ONE IS THE DANGEROUS DIRECTION. A refused roster read leaves every
      // check-in reporting zero addressed and zero answered — `checkInProgress` would then say
      // "Nobody was addressed" over a live emergency. Refuse the whole report instead.
      console.error(
        `[safety-check-ins] roster read failed in ${g.familyCode}: ${rosterError.message}`,
      )
      return null
    }
    rosterRows = (roster ?? []) as RosterDbRow[]
  }

  const names = await nameMap(g.familyCode, rows.map(r => r.raised_by ?? ''))
  const areas = await areaNames(
    g.familyCode,
    rows.map(r => r.region_id).filter((x): x is string => !!x),
    rows.map(r => r.chapter_id).filter((x): x is string => !!x),
  )

  const byCheckIn = new Map<string, RosterRow[]>()
  for (const r of rosterRows) {
    const list = byCheckIn.get(r.check_in_id) ?? []
    list.push({
      personId: r.person_id,
      name: '',                                 // Names are only resolved on the detail screen.
      state: r.state as CheckInResponse,
      reach: r.reach as CheckInReach,
      note: r.note,
      respondedAt: r.responded_at,
    })
    byCheckIn.set(r.check_in_id, list)
  }

  return rows.map(row => summaryOf(
    row,
    byCheckIn.get(row.id) ?? [],
    row.raised_by ? (names.get(row.raised_by) ?? null) : null,
    row.region_id ? (areas.regions.get(row.region_id) ?? null)
      : row.chapter_id ? (areas.chapters.get(row.chapter_id) ?? null) : null,
    seeRoster,
  ))
}

/**
 * One check-in with its full roster.
 *
 * `canAny` ON `view`, NOT `can`. A roster is every addressed relative's name with their answer
 * and their reachability beside it — §5's fifth decision calls it the sharpest PII this product
 * would hold, and scope `'own'` is not a way to hold it for a check-in somebody else raised.
 *
 * THE OWN-SCOPED CALLER IS NOT LEFT WITH NOTHING, which is the part worth checking before
 * changing this: they still see the check-in in `getCheckIns`, and they still answer their own
 * row through `getMyOpenCheckIns` and the Dashboard banner. What they do not get is the list of
 * who else is unaccounted for.
 */
export async function getCheckIn(id: string): Promise<CheckInDetail | null> {
  const g = await requireMember()
  if (!g.ok) return null
  if (!id) return null
  if (!(await canAny(g.userId, 'community/safety-check-ins', 'view'))) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('safety_check_ins')
    .select('id, title, detail, scope, region_id, chapter_id, status, raised_by, created_at, closed_at, not_addressed')
    .eq('id', id)
    .eq('family_code', g.familyCode)              // §3 by hand — `.eq('id')` alone crosses families.
    .maybeSingle()

  if (error) {
    console.error(`[safety-check-ins] detail read failed for ${id}: ${error.message}`)
    return null
  }
  if (!data) return null
  const row = data as CheckInRow

  const { data: roster, error: rosterError } = await admin
    .from('safety_check_in_people')
    .select('check_in_id, person_id, state, reach, note, responded_at')
    .eq('family_code', g.familyCode)
    .eq('check_in_id', row.id)
  if (rosterError) {
    console.error(`[safety-check-ins] roster read failed for ${id}: ${rosterError.message}`)
    return null
  }
  const rosterDb = (roster ?? []) as RosterDbRow[]

  const names = await nameMap(
    g.familyCode,
    [...rosterDb.map(r => r.person_id), row.raised_by ?? ''],
  )
  const areas = await areaNames(
    g.familyCode,
    row.region_id ? [row.region_id] : [],
    row.chapter_id ? [row.chapter_id] : [],
  )

  const rows: RosterRow[] = rosterDb.map(r => ({
    personId: r.person_id,
    name: names.get(r.person_id) ?? 'Unnamed relative',
    state: r.state as CheckInResponse,
    reach: r.reach as CheckInReach,
    note: r.note,
    respondedAt: r.responded_at,
  }))

  // ORDERED BY WHAT SOMEBODY IS LOOKING FOR, not alphabetically. Needs help first, then the
  // people nobody could reach, then the silent ones, then the safe. That is the order in which
  // this list is ACTED ON, and on a screen being read under pressure the ordering is most of the
  // interface.
  const rank: Record<string, number> = { needs_help: 0, unreachable: 1, awaiting: 2, safe: 3 }
  const bucket = (r: RosterRow) =>
    r.state === 'needs_help' ? 'needs_help'
      : r.reach === 'skipped' || r.reach === 'failed' ? 'unreachable'
        : r.state === 'safe' ? 'safe' : 'awaiting'
  rows.sort((a, b) => {
    const d = rank[bucket(a)] - rank[bucket(b)]
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })

  return {
    ...summaryOf(
      row,
      rows,
      row.raised_by ? (names.get(row.raised_by) ?? null) : null,
      row.region_id ? (areas.regions.get(row.region_id) ?? null)
        : row.chapter_id ? (areas.chapters.get(row.chapter_id) ?? null) : null,
      true,
    ),
    roster: rows,
  }
}

/**
 * The open check-ins this member is being asked about.
 *
 * ── THE ONE READ IN THIS MODULE ON THE USER CLIENT, AND THE ONLY GATE IS MEMBERSHIP ─
 * No permission check at all, deliberately, and it is the same argument as answering: being
 * asked whether you are safe is not a capability a family delegates. The narrowing is the
 * policies' `self_expr` — `person_id = auth_person_id()` on the roster row, and "I am on this
 * roster" on the check-in — which holds at EVERY scope including `'none'`.
 *
 * That is what makes the Dashboard banner work for a member whose family has restricted this key
 * to nothing, and the migration's §10 explains why that redundancy is deliberate: a family must
 * not be able to make its own emergency check-in unanswerable by moving a switch whose label
 * says nothing about answering.
 *
 * ── IT IS ALSO THE ONE THING HERE THE RLS SUITE CAN TEST AGAINST A REAL POLICY ──────
 * Every other read in this module is on the admin client, so no policy is underneath it. This
 * one has nothing BUT a policy underneath it, which is why its case in `tests/rls/cases.mjs` is
 * the one worth mutating.
 */
export async function getMyOpenCheckIns(): Promise<MyCheckIn[]> {
  const g = await requireMember()
  if (!g.ok) return []
  if (!g.personId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('safety_check_in_people')
    // THE CONSTRAINT IS NAMED (§8). `safety_check_in_people` has foreign keys to
    // `safety_check_ins` and `people`, so it is the junction SHAPE that made a bare
    // `announcements` embed PGRST201 — and one unqualified embed answers `[]`, which on this
    // read means a member is never told their family is asking after them.
    .select(`
      check_in_id, state, note,
      safety_check_ins!safety_check_in_people_check_in_id_fkey (
        id, title, detail, status, raised_by, created_at
      )
    `)
    .eq('family_code', g.familyCode)
    .eq('person_id', g.personId)

  if (error) {
    console.error(`[safety-check-ins] my check-ins failed for ${g.personId}: ${error.message}`)
    return []
  }

  type Joined = {
    check_in_id: string
    state: string
    note: string | null
    safety_check_ins: {
      id: string; title: string; detail: string | null
      status: string; raised_by: string | null; created_at: string
    } | null
  }
  const rows = ((data ?? []) as unknown as Joined[])
    .filter(r => r.safety_check_ins?.status === 'open')

  if (rows.length === 0) return []

  const names = await nameMap(
    g.familyCode,
    rows.map(r => r.safety_check_ins?.raised_by ?? ''),
  )

  return rows
    .map(r => ({
      checkInId: r.check_in_id,
      title: r.safety_check_ins!.title,
      detail: r.safety_check_ins!.detail,
      raisedByName: r.safety_check_ins!.raised_by
        ? (names.get(r.safety_check_ins!.raised_by) ?? null)
        : null,
      createdAt: r.safety_check_ins!.created_at,
      myState: r.state as CheckInResponse,
      myNote: r.note,
    }))
    // Newest first: if two are open, the one raised most recently is the one being asked about.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ── Raising ───────────────────────────────────────────────────────────────────────────

function normalizeScope(value: unknown): CheckInScope | null {
  return value === 'family' || value === 'region' || value === 'chapter' || value === 'named'
    ? value
    : null
}

/**
 * Raise a check-in: resolve the audience, write the roster, and queue the asks.
 *
 * ── NOTHING IS MAILED HERE ─────────────────────────────────────────────────────────
 * This writes the queue and returns. `sendCheckInAsks` does the asking, a batch at a time, and
 * the client drives it — because a hundred and forty provider calls at a rate limit do not fit
 * one request and there is nowhere else to run them. See the module header.
 *
 * ── FOUR THINGS STAND BETWEEN THIS AND A MAIL CANNON, AND ALL FOUR MUST SURVIVE ────
 *   1. `canAny` on `create`. Not `can` — see the module header.
 *   2. THE CALLER NEVER NAMES A RECIPIENT ADDRESS. They name a scope, and at most one area id,
 *      or a list of PERSON IDS which are then intersected with this family's own approved
 *      roster. A `named` audience cannot reach outside the family however it is constructed.
 *   3. `belongsToFamily` on the area id before it is written (§4), with the guard trigger
 *      underneath. A row carrying the caller's own `family_code` satisfies every policy while
 *      the id it carries points anywhere — that is the hole RLS structurally cannot close.
 *   4. `reply_to` IS READ OFF THE CALLER'S OWN `people` ROW and is never a parameter. A
 *      caller-chosen reply-to on mail carrying our SPF and DKIM is a phishing header.
 */
export async function raiseCheckIn(input: {
  title: string
  detail?: string
  scope: CheckInScope
  /** Region or chapter id, for those two scopes. Ignored otherwise. */
  areaId?: string | null
  /** For `named` only. Intersected with this family's roster before anything is written. */
  personIds?: readonly string[]
}): Promise<ActionResult & { checkInId?: string; addressed?: number; unreachable?: number }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  // §2: `canAny`, not `can`. Waking the whole family is family-wide operation with no coherent
  // "own" version, and the row a member would own — a check-in they raised — is the abuse case.
  if (!(await canAny(g.userId, 'community/safety-check-ins', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const title = (input?.title ?? '').trim().slice(0, TITLE_LIMIT)
  if (!title) {
    return { success: false, message: 'Say what is happening, so relatives know what they are being asked about' }
  }
  const detail = (input?.detail ?? '').trim().slice(0, DETAIL_LIMIT) || null

  const scope = normalizeScope(input?.scope)
  if (!scope) return { success: false, message: 'Choose who to ask' }

  const areaId = (input?.areaId ?? '') || null
  let regionId: string | null = null
  let chapterId: string | null = null

  // §4. THE AREA ID IS VERIFIED BEFORE IT IS WRITTEN. Without this, BRAVO's administrator could
  // raise a check-in in BRAVO naming ALPHA's chapter: the row's own `family_code` is BRAVO's, so
  // every policy is satisfied, and the id it carries points across the boundary.
  if (scope === 'region') {
    if (!areaId) return { success: false, message: 'Choose a region' }
    if (!(await belongsToFamily('regions', areaId, g.familyCode))) {
      return { success: false, message: 'Region not found' }
    }
    regionId = areaId
  } else if (scope === 'chapter') {
    if (!areaId) return { success: false, message: 'Choose a chapter' }
    if (!(await belongsToFamily('chapters', areaId, g.familyCode))) {
      return { success: false, message: 'Chapter not found' }
    }
    chapterId = areaId
  }

  const { candidates, ok } = await readRoster(g.familyCode)
  if (!ok) {
    // §8, and the one refusal in this action that is about an outage rather than about the
    // caller. Writing a check-in on top of a roster read that failed would address a subset and
    // report it as everybody.
    return {
      success: false,
      message: 'Could not read the family roster just now, so nothing has been sent. Try again.',
    }
  }

  // THE NAMED LIST IS INTERSECTED, NOT TRUSTED. Ids that are not approved members of this family
  // simply are not in `candidates`, so `inAudience` cannot match them — which means a hostile
  // caller passing another family's person ids gets an audience of nobody rather than a refusal
  // naming which ids were real. That is the right answer twice over: it cannot reach outside the
  // family, and it does not confirm whether an id exists.
  const requested = Array.isArray(input?.personIds)
    ? input.personIds.filter((x): x is string => typeof x === 'string' && !!x)
    : []
  if (scope === 'named' && requested.length === 0) {
    return { success: false, message: 'Choose at least one relative to ask' }
  }

  const audience: CheckInAudience = {
    scope, regionId, chapterId,
    personIds: scope === 'named' ? requested : [],
  }
  const { members, notAddressed } = resolveRoster(candidates, audience)

  if (members.length === 0) {
    // REFUSED RATHER THAN WRITTEN. A check-in addressing nobody is a record whose progress line
    // reads "Nobody was addressed" forever, and the raiser almost certainly meant somebody —
    // most often they picked a region nobody has been filed under.
    return {
      success: false,
      message: 'Nobody in the family matches that audience, so nothing has been sent. '
        + 'Check the region or chapter you chose.',
    }
  }

  const admin = createAdminClient()

  // The reply-to, from the caller's own row. Never a parameter — see the header. A GENERATED
  // placeholder is deliberately not used: it is a real domain that hard-bounces, so a reply
  // would vanish rather than reach anybody.
  let replyTo: string | null = null
  if (g.personId) {
    const { data: me } = await admin.from('people')
      .select('primary_email, email_is_placeholder')
      .eq('id', g.personId).eq('family_code', g.familyCode).maybeSingle()
    const row = me as { primary_email: string | null; email_is_placeholder: boolean | null } | null
    if (row && row.email_is_placeholder !== true && (row.primary_email ?? '').trim()) {
      replyTo = row.primary_email!.trim()
    }
  }

  const { data: created, error: createError } = await admin
    .from('safety_check_ins')
    .insert({
      family_code:   g.familyCode,
      title,
      detail,
      scope,
      region_id:     regionId,
      chapter_id:    chapterId,
      raised_by:     g.personId,
      reply_to:      replyTo,
      not_addressed: notAddressed,
    })
    .select('id')
    .single()

  if (createError || !created) {
    console.error(`[safety-check-ins] raise failed in ${g.familyCode}: ${createError?.message}`)
    return { success: false, message: 'Could not raise the check-in' }
  }
  const checkInId = (created as { id: string }).id

  const { error: rosterError } = await admin.from('safety_check_in_people').insert(
    members.map(m => ({
      family_code: g.familyCode,
      check_in_id: checkInId,
      person_id:   m.personId,
      email:       m.email,
      reach:       m.reach,
      // `asked_at` stays NULL until something is actually attempted. A timestamp written here
      // would say the family asked at the moment the row appeared, which is not true of a queue.
      asked_at:    null,
    })),
  )

  if (rosterError) {
    // THE ROSTER IS THE CHECK-IN. A parent row with no roster is an emergency that addresses
    // nobody and cannot be repaired from any screen, so it is removed rather than left standing.
    console.error(
      `[safety-check-ins] roster insert failed for ${checkInId}: ${rosterError.message}`,
    )
    await admin.from('safety_check_ins').delete()
      .eq('id', checkInId).eq('family_code', g.familyCode)
    return { success: false, message: 'Could not build the roster, so nothing has been sent' }
  }

  // THE BELL, FOR EVERYBODY ADDRESSED. It reaches only somebody with the app open — which is
  // exactly the channel §5 says a disaster guarantees is closed — so it is a supplement to the
  // email and never the ask itself. `notifySafetyCheckIn` reads its own errors, because
  // supabase-js RETURNS them rather than throwing and the try/catch here would catch nothing.
  try {
    await notifySafetyCheckIn({
      familyCode: g.familyCode,
      recipientPersonIds: members.map(m => m.personId),
      // The raiser is not told about their own act, the same exclusion `notifyMeetingScheduled`
      // makes. They are still ON the roster and still have to answer — this only suppresses the
      // bell entry.
      excludePersonId: g.personId ?? undefined,
      title,
      link: `/community/safety-check-ins?open=${checkInId}`,
    })
  } catch (e) {
    console.error(`[safety-check-ins] notify failed for ${checkInId}: ${String(e)}`)
  }

  revalidatePath('/community/safety-check-ins')
  revalidatePath('/dashboard')

  return {
    success: true,
    checkInId,
    addressed: members.length,
    unreachable: members.filter(m => m.reach === 'skipped').length,
  }
}

// ── Asking ────────────────────────────────────────────────────────────────────────────

export interface AskBatchResult {
  success: boolean
  message?: string
  /** Rows attempted in this call. Zero means the queue is empty. */
  attempted?: number
  sent?: number
  failed?: number
  /** True while rows remain pending, so the client knows to call again. */
  more?: boolean
}

/**
 * Ask the next batch of relatives, and record what happened to each.
 *
 * `canAny` on `create`, matching `raiseCheckIn`: driving the queue is part of raising, and a
 * separate grant for it would let somebody start an ask they could not finish.
 *
 * ── THE CLAIM IS ONE STATEMENT, IN SQL, AND THAT IS NOT AN OPTIMISATION ────────────
 * `claim_safety_check_in_asks()` flips a bounded set of `pending` rows to `sending` under
 * `FOR UPDATE SKIP LOCKED` and returns them. A read-then-write from here is what two
 * administrators pressing the button at the same moment turn into the same relative asked twice
 * about the same emergency — which cannot be recalled, and which on this feature specifically is
 * how a family learns to ignore these.
 *
 * ── EVERY ROW RECORDS ITS OWN OUTCOME, BECAUSE `sendEmail` FAILS SOFT ──────────────
 * It never throws: every call site runs after a decision is committed, and a mail outage must not
 * surface as a failure to whoever pressed the button. The cost is that a dropped message is
 * invisible unless somebody records it, so `reach` and `reach_error` are written per person and
 * the screen prints the total. That is what makes "everybody has been asked" a sentence this
 * feature never has to say.
 */
export async function sendCheckInAsks(checkInId: string): Promise<AskBatchResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'community/safety-check-ins', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }
  if (!checkInId) return { success: false, message: 'Check-in not found' }

  const admin = createAdminClient()

  // §4/§3: the id came from a client. Verified against this family before it is used as the
  // subject of anything — and the claim function asserts the same thing again underneath,
  // because §2b rule 3 says to write it as if it were reachable.
  if (!(await belongsToFamily('safety_check_ins', checkInId, g.familyCode))) {
    return { success: false, message: 'Check-in not found' }
  }

  const { data: parent, error: parentError } = await admin
    .from('safety_check_ins')
    .select('id, title, detail, status, reply_to, raised_by')
    .eq('id', checkInId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  if (parentError || !parent) {
    console.error(`[safety-check-ins] ask read failed for ${checkInId}: ${parentError?.message}`)
    return { success: false, message: 'Check-in not found' }
  }
  const row = parent as {
    id: string; title: string; detail: string | null
    status: string; reply_to: string | null; raised_by: string | null
  }
  if (row.status !== 'open') {
    return { success: false, message: 'This check-in has been closed, so no more asks will go out' }
  }

  const { data: claimed, error: claimError } = await admin.rpc('claim_safety_check_in_asks', {
    p_check_in_id: checkInId,
    p_family_code: g.familyCode,
    p_limit:       BATCH_SIZE,
  })
  if (claimError) {
    console.error(`[safety-check-ins] claim failed for ${checkInId}: ${claimError.message}`)
    return { success: false, message: 'Could not claim the next batch' }
  }
  const batch = (claimed ?? []) as { id: string; person_id: string; email: string | null }[]
  if (batch.length === 0) return { success: true, attempted: 0, sent: 0, failed: 0, more: false }

  const [familyName, raiserName] = await Promise.all([
    familyNameOf(g.familyCode),
    row.raised_by
      ? nameMap(g.familyCode, [row.raised_by]).then(m => m.get(row.raised_by!) ?? null)
      : Promise.resolve(null),
  ])
  const origin = emailOrigin()
  const link = `${origin}/community/safety-check-ins?open=${checkInId}`

  let sent = 0
  let failed = 0

  for (const [index, target] of batch.entries()) {
    if (index > 0) await pace(SEND_SPACING_MS)

    const address = (target.email ?? '').trim()
    let result: { sent: boolean; error?: string }
    if (!address) {
      // A CLAIMED ROW WITH NO ADDRESS SHOULD NOT EXIST — `resolveRoster` writes those as
      // `skipped` and the claim only takes `pending`. Handled rather than assumed away, because
      // the alternative is a provider call with an empty `to` that fails for an opaque reason.
      result = { sent: false, error: 'no address on the roster row' }
    } else {
      const email = safetyCheckInEmail({
        origin,
        familyName,
        title: row.title,
        detail: row.detail,
        raisedByName: raiserName,
        link,
      })
      result = await sendEmail({
        to: address,
        subject: email.subject,
        html: email.html,
        tag: email.tag,
        replyTo: row.reply_to ?? undefined,
      })
    }

    const { error: writeError } = await admin
      .from('safety_check_in_people')
      .update({
        reach:       result.sent ? 'sent' : 'failed',
        reach_error: result.sent ? null : (result.error ?? 'unknown').slice(0, 500),
        asked_at:    new Date().toISOString(),
      })
      .eq('id', target.id)
      .eq('family_code', g.familyCode)           // §3 by hand, on the write as well as the read.

    if (writeError) {
      // THE ROW IS NOW STRANDED IN `sending` and that is recoverable rather than lost: "Try
      // again" puts it back to `pending`. Logged loudly because the alternative reading — a
      // relative who was asked and whose outcome vanished — is one somebody must be able to find.
      console.error(
        `[safety-check-ins] could not record outcome for ${target.id}: ${writeError.message}`,
      )
    }
    if (result.sent) sent += 1
    else failed += 1
  }

  const { count } = await admin
    .from('safety_check_in_people')
    .select('id', { count: 'exact', head: true })
    .eq('family_code', g.familyCode)
    .eq('check_in_id', checkInId)
    .eq('reach', 'pending')

  revalidatePath('/community/safety-check-ins')

  return { success: true, attempted: batch.length, sent, failed, more: (count ?? 0) > 0 }
}

/** The family's own name, for the email chrome. */
async function familyNameOf(familyCode: string): Promise<string> {
  const { data } = await createAdminClient()
    .from('families').select('family_name').eq('family_code', familyCode).maybeSingle()
  return (data as { family_name: string | null } | null)?.family_name?.trim() || 'your family'
}

/**
 * Put `sending` and `failed` rows back to `pending`, so the queue can be driven again.
 *
 * ── WHAT IT DELIBERATELY DOES NOT TOUCH ────────────────────────────────────────────
 * `skipped` rows stay skipped. There is no mailbox to retry — retrying one means mailing a
 * generated `@genorra.com` address, which is a hard bounce against our own sending reputation
 * and would file the relative as `failed`, moving them out of the column that tells somebody to
 * telephone them and into the column that says a machine should try again. That is the exact
 * conflation this feature's two-column design exists to prevent.
 *
 * `sent` rows stay sent, so pressing this twice cannot ask anybody a second time.
 */
export async function retryCheckInAsks(checkInId: string): Promise<ActionResult & { requeued?: number }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'community/safety-check-ins', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }
  if (!checkInId) return { success: false, message: 'Check-in not found' }
  if (!(await belongsToFamily('safety_check_ins', checkInId, g.familyCode))) {
    return { success: false, message: 'Check-in not found' }
  }

  const { data, error } = await createAdminClient()
    .from('safety_check_in_people')
    .update({ reach: 'pending', reach_error: null })
    .eq('family_code', g.familyCode)
    .eq('check_in_id', checkInId)
    .in('reach', ['sending', 'failed'])
    .select('id')

  if (error) {
    console.error(`[safety-check-ins] requeue failed for ${checkInId}: ${error.message}`)
    return { success: false, message: 'Could not queue those asks again' }
  }

  revalidatePath('/community/safety-check-ins')
  const requeued = (data ?? []).length
  return {
    success: true,
    requeued,
    message: requeued === 0
      // §8b: a write that changed nothing is reported honestly rather than as a success. Here it
      // is not a refusal — there was simply nothing to retry — and saying so is what stops
      // somebody pressing it repeatedly waiting for something to happen.
      ? 'There was nothing left to try again'
      : requeued === 1 ? '1 relative will be asked again' : `${requeued} relatives will be asked again`,
  }
}

// ── Answering ─────────────────────────────────────────────────────────────────────────

/**
 * Say whether you are safe.
 *
 * ── SELF-SERVICE: `requireMember()`, AND THE ROW MUST BE THE CALLER'S OWN ──────────
 * AGENTS.md §2's "Self-service actions check ownership, not a grant". `create` and `edit` default
 * to scope `'none'` on a template, so demanding a grant here would mean nobody could answer —
 * and `requireMember()` additionally demands an APPROVED membership, which is right: an applicant
 * nobody has admitted is not on any roster.
 *
 * **THERE IS NO `personId` PARAMETER, AND THERE MUST NEVER BE ONE.** §5's fourth decision names
 * the feature this rules out — *"an 'I spoke to her, she's fine' button. It is the most requested
 * feature in every system of this kind and it is a write to somebody else's row."* The row is
 * resolved from the caller's own guard, so the endpoint cannot express answering for anybody else.
 *
 * ── AN ANSWER MAY BE CHANGED, WHICH IS UNLIKE A VOTE AND UNLIKE AN APPROVED TASK ───
 * `meeting_votes_are_final` refuses UPDATE for every role including `service_role`, because a
 * vote is a decision. `submitGatheringTask` refuses an APPROVED task, because an approved answer
 * has been ruled on. Neither applies here: *"I said I needed help, and now I am safe"* is the
 * whole point, and a check-in that could not record it would be worse than useless.
 *
 * What IS refused is answering a CLOSED check-in — not to protect the record, but because a
 * closed one is nobody's live concern and an answer landing on it would be seen by nobody.
 */
export async function answerCheckIn(input: {
  checkInId: string
  state: Exclude<CheckInResponse, 'awaiting'>
  note?: string
}): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  // `getMyPersonId` answers '' for a caller it cannot resolve, and '' is not a uuid — unchecked
  // it reaches the database as `invalid input syntax for type uuid: ""` and surfaces that to a
  // member as the whole of the error message.
  if (!g.personId) return { success: false, message: 'Profile not found' }
  if (!input?.checkInId) return { success: false, message: 'Check-in not found' }

  if (input.state !== 'safe' && input.state !== 'needs_help') {
    return { success: false, message: 'Choose whether you are safe' }
  }

  // CLIPPED, NOT REFUSED. Somebody typing an answer during an emergency must not have it thrown
  // back at them over a length limit — the same judgement `normalizePhone` and `toNameCase` make
  // in `pickProfileColumns`, where a normaliser that refuses a save is a worse bug than the
  // inconsistency it fixes.
  const note = typeof input.note === 'string'
    ? (input.note.trim().slice(0, NOTE_LIMIT) || null)
    : null

  const admin = createAdminClient()

  // The roster row, resolved from the CALLER rather than from anything they sent, and scoped by
  // family by hand (§3). If they are not on this check-in's roster there is nothing to update
  // and they are told so — which is also the answer for a check-in in another family, because
  // `family_code` is a conjunct here.
  const { data: mine, error: readError } = await admin
    .from('safety_check_in_people')
    .select('id, check_in_id, state')
    .eq('family_code', g.familyCode)
    .eq('check_in_id', input.checkInId)
    .eq('person_id', g.personId)
    .maybeSingle()

  if (readError) {
    console.error(
      `[safety-check-ins] answer read failed for ${input.checkInId}: ${readError.message}`,
    )
    return { success: false, message: 'Could not record your answer' }
  }
  if (!mine) {
    return { success: false, message: 'You are not on this check-in' }
  }

  const { data: parent } = await admin
    .from('safety_check_ins')
    .select('status, title, raised_by')
    .eq('id', input.checkInId)
    .eq('family_code', g.familyCode)
    .maybeSingle()
  const status = (parent as { status: string } | null)?.status
  if (status !== 'open') {
    return {
      success: false,
      message: 'This check-in has been closed. If you still need help, contact your family directly.',
    }
  }

  const { data: written, error: writeError } = await admin
    .from('safety_check_in_people')
    .update({
      state:        input.state,
      note,
      // WRITTEN TOGETHER WITH `state`, ALWAYS. The table CHECKs that the two agree, so a write
      // that moved one without the other would be refused — which is the point of the CHECK: the
      // answered column and the answered timestamp must never be able to disagree.
      responded_at: new Date().toISOString(),
    })
    .eq('id', (mine as { id: string }).id)
    .eq('family_code', g.familyCode)
    .select('id')

  if (writeError) {
    console.error(
      `[safety-check-ins] answer write failed for ${input.checkInId}: ${writeError.message}`,
    )
    return { success: false, message: 'Could not record your answer' }
  }
  // §8b. A write that matched nothing is a FAILED write, and reporting success over it would tell
  // somebody their family had been told they are safe when nothing was recorded. There is no
  // policy underneath this statement (the table has no UPDATE policy at all), so a zero here
  // means the row moved or vanished between the two statements — rare, and not something to
  // report as done.
  if ((written ?? []).length === 0) {
    return { success: false, message: 'Could not record your answer — try again' }
  }

  revalidatePath('/community/safety-check-ins')
  revalidatePath('/dashboard')

  return {
    success: true,
    message: input.state === 'safe'
      ? 'Thank you — your family can see that you are safe.'
      : 'Your family can see that you need help. Somebody will be in touch.',
  }
}

// ── Closing and deleting ──────────────────────────────────────────────────────────────

/**
 * Stand the family down.
 *
 * `canAny` on `create`, the same grant as raising: *whoever may wake the family may also stand
 * them down, and making the all-clear harder to reach than the alarm is backwards.* That is the
 * argument `cancelDistribution` makes about stopping a send in flight.
 *
 * CLOSING DESTROYS NOTHING. Every answer, every unreachable relative and every unanswered row
 * stays exactly as it was — this only stops further asks going out and takes the banner off
 * everybody's dashboard. A check-in is a record of what a family asked and what came back, and a
 * closed one is still that record.
 */
export async function closeCheckIn(checkInId: string): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'community/safety-check-ins', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }
  if (!checkInId) return { success: false, message: 'Check-in not found' }
  if (!(await belongsToFamily('safety_check_ins', checkInId, g.familyCode))) {
    return { success: false, message: 'Check-in not found' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('safety_check_ins')
    .update({
      status:    'closed',
      // WRITTEN WITH `status`, because the table CHECKs that a closed row carries a time.
      closed_at: new Date().toISOString(),
      closed_by: g.personId,
    })
    .eq('id', checkInId)
    .eq('family_code', g.familyCode)
    .eq('status', 'open')
    .select('id')

  if (error) {
    console.error(`[safety-check-ins] close failed for ${checkInId}: ${error.message}`)
    return { success: false, message: 'Could not close the check-in' }
  }
  // §8b: nothing matched, so nothing was closed. Almost always because it was already closed —
  // two organizers pressing the button — which is worth saying rather than reporting a success
  // that implies this call did it.
  if ((data ?? []).length === 0) {
    return { success: false, message: 'That check-in was already closed' }
  }

  // Queued asks are deliberately left as `pending` rather than swept to `cancelled`. Nothing will
  // pick them up — `sendCheckInAsks` refuses a closed check-in — and rewriting them would erase
  // the fact that the family closed the check-in with relatives still unasked, which is exactly
  // the sort of thing somebody reviewing afterwards needs to be able to see.
  revalidatePath('/community/safety-check-ins')
  revalidatePath('/dashboard')
  return { success: true, message: 'Check-in closed' }
}

/**
 * Delete the record entirely.
 *
 * `canAny` on `delete`, which is a strictly stronger grant than `create` for a reason worth
 * stating: this destroys the account of who was asked, who answered and who was never reached.
 * A family reviewing how a bad night went has nothing else to read.
 *
 * The roster CASCADEs. `belongsToFamily` FIRST, and then `.eq('family_code', …)` on the statement
 * as well — `deleteDistribution` shipped without the former and its RLS case's `told` assertion
 * is what found it, which is why both are here and why AGENTS.md §8b says to read that column.
 */
export async function deleteCheckIn(checkInId: string): Promise<ActionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'community/safety-check-ins', 'delete'))) {
    return { success: false, message: 'Not authorized' }
  }
  if (!checkInId) return { success: false, message: 'Check-in not found' }
  if (!(await belongsToFamily('safety_check_ins', checkInId, g.familyCode))) {
    return { success: false, message: 'Check-in not found' }
  }

  const { data, error } = await createAdminClient()
    .from('safety_check_ins')
    .delete()
    .eq('id', checkInId)
    .eq('family_code', g.familyCode)
    .select('id')

  if (error) {
    console.error(`[safety-check-ins] delete failed for ${checkInId}: ${error.message}`)
    return { success: false, message: 'Could not delete the check-in' }
  }
  if ((data ?? []).length === 0) {
    return { success: false, message: 'Check-in not found' }
  }

  revalidatePath('/community/safety-check-ins')
  revalidatePath('/dashboard')
  return { success: true, message: 'Check-in deleted' }
}
