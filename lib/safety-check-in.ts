/**
 * Emergency check-in — who was asked whether they are safe, and what came back.
 *
 * ── WHY THIS IS A PURE MODULE ──────────────────────────────────────────────────────
 * The two reasons every other module of this shape here has. `app/actions/safety-check-ins.ts`
 * is `'use server'`, and everything exported from one of those gets a URL — so a helper that
 * turns a roster into a list of addressed relatives could not live there and be shared. That
 * is not a theoretical objection: an endpoint whose whole job is to turn a rule into a list of
 * every relative's address is the reconnaissance half of the mail cannon `lib/email/README.md`
 * is about, and this feature mails on the strength of it.
 *
 * And AGENTS.md §7b: this is the arithmetic. Who is addressed, who could not be reached, and
 * what the roster adds up to are all decidable from arguments, so they are decided here where
 * `npm test` can reach them. The RLS suite cannot check a figure — its fixture has six people
 * — and every rule in this file is one that is wrong at the EDGES rather than in the middle:
 * the family with no chapters, the relative with no mailbox, the check-in nobody has answered.
 *
 * NOTHING HERE READS THE WORLD. No clock, no database, no `crypto`. `summarize` takes `now` as
 * a parameter for §7b's reason — a module that reads `new Date()` internally is a module whose
 * edges cannot be tested, which is why `duesPlanMath` takes `today` and why every other helper
 * in `lib/dues-utils.ts` never was.
 *
 * ── THE ONE NUMBER THIS FEATURE EXISTS TO DRIVE TO ZERO ────────────────────────────
 * FutureFeature.md's proposal is explicit and it governs every decision below: *"The unanswered
 * column is the product. The other two are only how it gets shorter."* So this module's whole
 * job is to keep that column HONEST — which means, above all, keeping three different reasons
 * for an empty answer apart from each other:
 *
 *   * asked, and has not answered yet          — the work
 *   * asked, and the message did not go        — a delivery problem somebody must fix
 *   * never asked, because there is no mailbox — a phone call somebody must make
 *
 * Collapsing any of those into "not answered" turns the number into one that cannot reach zero,
 * and a number that cannot reach zero stops being read at all.
 */

/**
 * How wide a check-in is aimed.
 *
 * ── `named` IS THE ONE THIS FEATURE COULD NOT DO WITHOUT ───────────────────────────
 * The first three are the vocabulary `lib/distribution-audience.ts` and `lib/election-area.ts`
 * already use, and they are kept identical rather than re-spelled. The fourth is new here, and
 * FutureFeature.md's second decision is why:
 *
 *   *"An area is not a chapter, and neither answer works alone. A chapter is how a family
 *   ORGANISED itself; a disaster addresses where people ARE."*
 *
 * A hurricane crosses three counties. The family's Gulf chapter covers some of the people in
 * them, misses the cousin who moved to Houston last year, and includes an aunt who has since
 * moved to Denver. There is no derivable audience for "the relatives in the path of this
 * storm", so the person raising it has to be able to name them — and the relative who MOVED is
 * exactly the one an organised audience silently drops, which is to say the one most likely to
 * be in the wrong place.
 *
 * WHAT IT IS NOT: a way to send mail to an arbitrary list. `raiseCheckIn` resolves every id
 * against the family's own roster before a row exists, so a `named` check-in can only ever
 * reach people who are already in this family. That is the same rule `scheduleMeeting` states
 * ("THE CLIENT NAMES BODIES AND NEVER SENDS PEOPLE") with the one exception that screen also
 * makes for `additionalIds`, and for the same reason: some rooms have no body to point at.
 */
export type CheckInScope = 'family' | 'region' | 'chapter' | 'named'

/**
 * What a relative said.
 *
 * THREE VALUES, AND NO FOURTH. In particular there is no `unreachable` here, and that is the
 * sharpest modelling decision in this file: "we could not ask them" is not something a person
 * SAID, so it does not belong in the column that records what people say. It lives in `reach`
 * below, and the two columns answer two different questions — which is what stops this becoming
 * the `is_minor` trap (AGENTS.md §4b), two facts about one thing that come to disagree.
 *
 * The test that keeps them apart: a relative can be `reach: 'sent'` and `state: 'awaiting'`
 * (asked, silent) or `reach: 'skipped'` and `state: 'awaiting'` (never asked). One column cannot
 * express both, and a single enum that tried would have to pick which of the two facts to lose.
 */
export type CheckInResponse = 'awaiting' | 'safe' | 'needs_help'

/**
 * Whether the ask reached them, which is a different question from what they answered.
 *
 *   `pending`  addressed, and the message has not been attempted yet. The queue.
 *   `sent`     the provider accepted it. NOT "they read it" — nothing in this product can
 *              know that, and the screen must not imply otherwise.
 *   `failed`   a real address that the provider refused or bounced. ACTIONABLE: somebody
 *              should check the address.
 *   `skipped`  there is no mailbox to try. A recorded relative with a GENERATED placeholder
 *              address, which is FutureFeature.md's third decision:
 *
 *                *"A record cannot answer, and must not read as unanswered. The roster owes a
 *                third state — no way to reach them — sitting apart from 'not answered'."*
 *
 *              Filed as `failed` it would sit forever in the column somebody works through, and
 *              a delivery nobody can fix would be reported as a delivery somebody should retry.
 *              `placeholderEmail()` builds those addresses on **@genorra.com** — a REAL domain —
 *              so `sendEmail`'s reserved-TLD guard does NOT catch them, and mailing one is a
 *              hard bounce against our own sending reputation.
 */
export type CheckInReach = 'pending' | 'sent' | 'failed' | 'skipped'

/**
 * One person the roster offered, with everything the addressing rule reads.
 *
 * `regionId` is DERIVED from the chapter by the caller (`chapter_id -> chapters.region_id`) and
 * is not a column on `people` — there is no `people.region_id` and this module must not imply
 * one. `null` means National, which is the ABSENCE of a region rather than a region.
 */
export interface CheckInCandidate {
  personId: string
  firstName: string
  lastName: string
  /** `primary_email`. Nullable because the column is, though in practice it is set. */
  email: string | null
  /** The address is ours and generated. There is no mailbox here — see `skipped`. */
  emailIsPlaceholder: boolean
  chapterId: string | null
  regionId: string | null
}

/** Where a check-in is aimed. An area scope names exactly one area; `named` names people. */
export interface CheckInAudience {
  scope: CheckInScope
  regionId: string | null
  chapterId: string | null
  /** For `named` only. Ids the CALLER supplied, already narrowed to this family's roster. */
  personIds: readonly string[]
}

/** One addressed relative, as the roster is first written. */
export interface ResolvedMember {
  personId: string
  /** For the roster on screen. Trimmed, and never empty — falls back to the address. */
  name: string
  /**
   * The address AT RAISE TIME, or `null` where there is none to record.
   *
   * A SNAPSHOT, NOT A JOIN, and the same decision `gathering_tasks` makes about its `label`
   * and `distribution_recipients` makes about its address: a relative who changes their address
   * next month must not retroactively rewrite the history of who this check-in reached. When
   * somebody is investigating a message that did not arrive, the only useful answer is which
   * address it actually went to.
   */
  email: string | null
  reach: Extract<CheckInReach, 'pending' | 'skipped'>
}

/** What a resolution addressed, and what it declined to. */
export interface ResolvedRoster {
  members: readonly ResolvedMember[]
  /**
   * People the roster offered whom this audience did not address.
   *
   * Reported rather than discarded, for `resolveRecipients`' reason: *"38 of 141 relatives"* is
   * a fact somebody can check against what they meant, and a bare *"38 addressed"* is not. It
   * matters more here than for mail, because the thing being checked is whether the audience
   * covers the disaster — and the cost of aiming a check-in too narrowly is that the relative
   * nobody asked about is the one nobody finds.
   */
  notAddressed: number
}

/**
 * Is this person addressed by this audience?
 *
 * ── AN AREA SCOPE NARROWS, WHICH IS DELIBERATELY NOT THE ANNOUNCEMENT RULE ─────────
 * `addressedTo` in `lib/announcement-audience.ts` treats a national or regional announcement as
 * reaching everybody, and its own comment records that as a decision. FutureFeature.md names
 * that widening as *"One defect it must not inherit"*, and this is where it is not inherited:
 *
 *   *"Defensible for an announcement and bad for a check-in — and region derivation now exists,
 *   so the cost of narrowing it is small."*
 *
 * The cost is one thing the screen must say out loud: a member in NO chapter is in no region, so
 * a regional check-in does not reach them. That is correct — they have not told the family where
 * they are — and it is the sort of correct that reads as a bug unless the number is printed,
 * which is why `resolveRoster` reports what it excluded rather than only what it kept.
 *
 * AN UNNAMED AREA ADDRESSES NOBODY, the second inversion of the announcement rule. There,
 * "Chapter" with an empty picker is treated as family-wide because publishing to nobody is
 * worse. Here, widening a misconfigured audience to the whole family means waking a hundred and
 * forty relatives at 3 a.m. about a storm four of them are in. `raiseCheckIn` refuses such an
 * audience before a row exists, the table CHECKs it, and this answering `false` is the floor
 * under both.
 */
export function inAudience(person: CheckInCandidate, audience: CheckInAudience): boolean {
  switch (audience.scope) {
    case 'family':
      return true
    case 'region':
      return audience.regionId !== null && person.regionId === audience.regionId
    case 'chapter':
      return audience.chapterId !== null && person.chapterId === audience.chapterId
    case 'named':
      return audience.personIds.includes(person.personId)
  }
}

/** How a person's name reads on the roster. Falls back to the address, never to blank. */
function displayName(person: CheckInCandidate): string {
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim()
  return name || (person.email ?? '').trim() || 'Unnamed relative'
}

/**
 * The roster order.
 *
 * Surname, then forename, then id — the same total order `rosterOrder` uses in
 * `lib/distribution-audience.ts`, and total for the same reason: two people in one family really
 * can share a name, which is why `disambiguatedName` exists at all. A partial order would let
 * two renders of one roster disagree about who is listed first, which on a screen somebody is
 * scanning under pressure is worse than it sounds.
 */
function rosterOrder(a: CheckInCandidate, b: CheckInCandidate): number {
  const last = (a.lastName ?? '').localeCompare(b.lastName ?? '')
  if (last !== 0) return last
  const first = (a.firstName ?? '').localeCompare(b.firstName ?? '')
  if (first !== 0) return first
  return a.personId.localeCompare(b.personId)
}

/**
 * Turn a roster and an audience into the rows to write.
 *
 * ── THE ROSTER IS RESOLVED ONCE, AT RAISE TIME, AND IS THEN THE LIST ───────────────
 * FutureFeature.md's second decision, and the whole reason this returns rows rather than a
 * predicate: *"All three — chapter, geography, hand-picked names — must resolve to ONE EXPLICIT
 * ROSTER at raise time, and the roster is then the list rather than the rule that built it.
 * Anything else silently drops the relative who moved."*
 *
 * So `safety_check_ins` records what was ASKED FOR (the scope and the area) and
 * `safety_check_in_people` records who that turned out to be. The second is never recomputed.
 * A relative who joins the family, changes chapter or leaves it tomorrow does not appear in, or
 * vanish from, a check-in that was raised today — which is what makes the unanswered column a
 * fact about an event rather than a query whose answer drifts under it.
 *
 * ── EVERY ADDRESSED PERSON GETS A ROW, INCLUDING THE ONES WITH NO MAILBOX ──────────
 * The `unreachable`-versus-`failed` argument at `CheckInReach`, applied. A recorded grandmother
 * is IN the family — on the tree, in the Directory, and squarely among the people somebody is
 * worried about — so leaving her out of the roster would make this screen quietly disagree with
 * every other count of the family, and would hide the one person who most needs a phone call.
 * AGENTS.md's PICKER-versus-PROJECTION distinction is the general form: a roster is a
 * projection, and a projection counts everybody.
 *
 * ── THERE IS NO DEDUPE HERE, AND THAT IS NOT AN OVERSIGHT ──────────────────────────
 * `resolveRecipients` files the second relative sharing a mailbox as `duplicate`, because a
 * distribution's claim is *"nobody is on it twice"* and two copies of a newsletter is a defect.
 * A check-in asks a QUESTION OF A PERSON, and two people sharing a mailbox are two people who
 * each have to answer. Suppressing the second ask would leave a relative in the unanswered
 * column having never been asked — the exact failure this module is built around. They get one
 * email each, at the same address, and each answers for themselves.
 */
export function resolveRoster(
  candidates: readonly CheckInCandidate[],
  audience: CheckInAudience,
): ResolvedRoster {
  const addressed = [...candidates].filter(c => inAudience(c, audience)).sort(rosterOrder)

  const members: ResolvedMember[] = addressed.map(person => {
    const email = (person.email ?? '').trim()
    // NO ADDRESS AND A GENERATED ADDRESS ARE THE SAME ANSWER, deliberately. Both mean "there is
    // no mailbox to try", and distinguishing them on screen would offer a difference nobody can
    // act on differently — the phone call is the same phone call.
    if (!email || person.emailIsPlaceholder) {
      return {
        personId: person.personId,
        name: displayName(person),
        email: email || null,
        reach: 'skipped' as const,
      }
    }
    return {
      personId: person.personId,
      name: displayName(person),
      email,
      reach: 'pending' as const,
    }
  })

  return { members, notAddressed: candidates.length - addressed.length }
}

/** One row of the roster as the screen reads it back. */
export interface RosterRow {
  personId: string
  name: string
  state: CheckInResponse
  reach: CheckInReach
  /** Their own words, if they left any. */
  note: string | null
  respondedAt: string | null
}

/**
 * The four numbers the screen is for, and they do not add up the obvious way.
 *
 * `safe` + `needsHelp` + `awaiting` + `unreachable` = `addressed`, and `awaiting` is deliberately
 * the NARROW reading: people who were successfully asked and have not answered. The ones nobody
 * could ask are counted separately, because they are a different job for a different person.
 *
 * `undelivered` OVERLAPS `unreachable` AND IS NOT PART OF THE SUM. It counts every row whose
 * message did not go — `failed` and `skipped` together — because that is the number somebody
 * chasing people needs in one place, and it is the number a naive implementation would fold
 * into `awaiting` and lose.
 */
export interface CheckInTally {
  addressed: number
  safe: number
  needsHelp: number
  /** Asked, and silent. NOT including anybody the ask never reached. */
  awaiting: number
  /** Never asked, because there was no mailbox. Needs a phone call, not a retry. */
  unreachable: number
  /** Every row the ask did not reach: `failed` + `skipped`. Overlaps `unreachable`. */
  undelivered: number
  /** Rows still queued for a first attempt. What the client loops on. */
  queued: number
}

export function tally(rows: readonly RosterRow[]): CheckInTally {
  let safe = 0
  let needsHelp = 0
  let awaiting = 0
  let unreachable = 0
  let undelivered = 0
  let queued = 0

  for (const row of rows) {
    if (row.reach === 'skipped') unreachable += 1
    if (row.reach === 'skipped' || row.reach === 'failed') undelivered += 1
    if (row.reach === 'pending') queued += 1

    if (row.state === 'safe') safe += 1
    else if (row.state === 'needs_help') needsHelp += 1
    // AN UNREACHABLE RELATIVE IS NOT `awaiting`, and this branch is the whole point of the
    // distinction. Counting them here is what would make the number this feature exists to
    // drive to zero unable to reach zero.
    else if (row.reach !== 'skipped') awaiting += 1
  }

  return { addressed: rows.length, safe, needsHelp, awaiting, unreachable, undelivered, queued }
}

/**
 * What the screen says a check-in is doing, and how it says it.
 *
 * DERIVED FROM THE ROWS, NEVER STORED. A `progress` column would be a second fact about the
 * same thing kept in step by whichever write path remembered — the `is_minor` trap again, and
 * stale the first moment somebody answers. `distributions` made the same call about its
 * `status` and for the same reason.
 *
 * ── THE TONES, AND WHY NONE OF THEM IS `destructive` ───────────────────────────────
 * FutureFeature.md's sixth decision: *"The colour does not exist yet, and it is not
 * `--destructive`. That token owns errors and deletions, `FormError` owns reporting a failure,
 * and `--brand-withheld` is a capability going away. An emergency banner is none of the three."*
 *
 *   `urgent`    somebody has said they need help. The one thing on this screen that is a
 *               call to action rather than a status, and the reason `--brand-urgent` exists.
 *   `withheld`  work outstanding — people still to answer, messages still to go. Exactly what
 *               that token is for: something has not happened yet.
 *   `affirm`    everybody who could answer has, and all of them are safe.
 *   `plain`     nothing to report either way.
 *
 * ORDER OF PRECEDENCE, and it is the only order a safety screen may use: somebody needing help
 * outranks everything, including a hundred unanswered relatives. A screen that reported "94 of
 * 141 answered" over a cousin who has said they are trapped would be sorted by the wrong thing.
 */
export interface CheckInProgress {
  label: string
  tone: 'plain' | 'affirm' | 'withheld' | 'urgent'
  /** True while there are messages still to send. What the client loops on. */
  sending: boolean
}

export function checkInProgress(t: CheckInTally, status: 'open' | 'closed'): CheckInProgress {
  const sending = t.queued > 0

  if (t.needsHelp > 0) {
    return {
      label: t.needsHelp === 1
        ? '1 relative needs help'
        : `${t.needsHelp} relatives need help`,
      tone: 'urgent',
      sending,
    }
  }
  if (t.addressed === 0) {
    // NOT AN ERROR AND NOT A SUCCESS. An audience that resolved to nobody is a fact about the
    // family — most often a region nobody has been filed under — and "everybody is safe" over
    // zero people would be a claim about nothing. `raiseCheckIn` refuses to create one of these,
    // so this is a defensive branch rather than a state the product produces.
    return { label: 'Nobody was addressed', tone: 'plain', sending: false }
  }
  if (sending) {
    return {
      label: `Asking — ${t.addressed - t.queued} of ${t.addressed} contacted`,
      tone: 'withheld',
      sending: true,
    }
  }
  if (t.awaiting > 0) {
    return {
      label: t.awaiting === 1
        ? '1 relative has not answered yet'
        : `${t.awaiting} relatives have not answered yet`,
      tone: 'withheld',
      sending: false,
    }
  }
  // EVERYBODY WHO COULD ANSWER HAS. The unreachable ones are named in the same breath rather
  // than rounded away, because "everyone is safe" over four relatives nobody could contact is
  // the single most dangerous sentence this feature could print.
  if (t.unreachable > 0) {
    return {
      label: t.unreachable === 1
        ? `Everyone reached is safe — 1 relative could not be contacted`
        : `Everyone reached is safe — ${t.unreachable} relatives could not be contacted`,
      tone: 'withheld',
      sending: false,
    }
  }
  return {
    label: status === 'closed' ? 'Closed — everybody was safe' : 'Everybody is safe',
    tone: 'affirm',
    sending: false,
  }
}

/**
 * How long a check-in has been open, in the words a screen uses.
 *
 * `now` IS A PARAMETER, per §7b. Every other helper in `lib/dues-utils.ts` reads `new Date()`
 * internally and none of them was ever testable; this one is, and the edges are where it
 * matters — a check-in raised ninety seconds ago must not read "0 hours ago".
 *
 * DELIBERATELY COARSE, and never seconds. A precise clock on an emergency screen invites
 * somebody to read meaning into the difference between four and six minutes, and there is none:
 * what the number is for is telling apart "this is happening now" from "this has been open since
 * yesterday and forty people still have not answered".
 */
export function openedAgo(raisedAtIso: string, now: Date): string {
  const raised = new Date(raisedAtIso)
  const ms = now.getTime() - raised.getTime()
  if (!Number.isFinite(ms)) return 'just now'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}
