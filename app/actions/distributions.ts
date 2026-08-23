'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember } from '@/lib/auth/guard'
import { can, canAny } from '@/lib/auth/permissions'
import { belongsToFamily } from '@/lib/auth/family'
import { emailOrigin, sendEmail } from '@/lib/email/send'
import { distributionEmail } from '@/lib/email/templates'
import {
  bodyParagraphs,
  countStates,
  distributionProgress,
  resolveRecipients,
  type AudienceCandidate,
  type DistributionAudience,
  type DistributionProgress,
  type DistributionScope,
  type RecipientCounts,
} from '@/lib/distribution-audience'

/**
 * Email distributions — `/community/distributions`, Premium.
 *
 * ── WHAT THIS IS, AND WHY IT IS NOT AN OPEN RELAY ──────────────────────────────────
 * A member writes a subject and a message, picks an audience, and presses Send. Everything
 * addressed in that audience gets one email. `/pricing` has sold it since the Premium card
 * existed: *"Email the whole family without building a list — distributions that draw
 * straight from your membership, so nobody is missed and nobody is on it twice."*
 *
 * That is, structurally, the shape lib/email/README.md's first rule exists to forbid: a
 * signed-in caller supplying a subject and a body and having it delivered over GENORRA's
 * authenticated domain, with our SPF and DKIM on it. Four things are what make this a
 * feature rather than that, and every one of them has to survive any future change here:
 *
 *   1. THE CALLER NEVER NAMES A RECIPIENT. They name an AUDIENCE — a scope and at most one
 *      area id — and the server resolves it against the family's own roster. This is
 *      `scheduleMeeting`'s rule ("THE CLIENT NAMES BODIES AND NEVER SENDS PEOPLE") applied
 *      to mail, where the stakes are higher: accepting a resolved list would let a caller
 *      send any address at all, and a server action is a public HTTP endpoint.
 *   2. THE AUDIENCE CANNOT LEAVE THE FAMILY. The roster read is family-scoped by hand (§3),
 *      the area id is checked with `belongsToFamily` before it is written (§4), and the
 *      guard triggers refuse a cross-family id underneath both.
 *   3. SENDING IS `canAny`, NEVER `can`. Mail to the whole family is family-wide operation
 *      with no coherent "own" version, and the row a member would "own" — a distribution
 *      they sent themselves — is precisely the abuse case. Same argument as a disbursement
 *      paying the person recording it.
 *   4. NOTHING ABOUT THE MESSAGE'S IDENTITY IS A PARAMETER. `From` is ours and fixed;
 *      `reply_to` is read off the sender's own `people` row. A caller-chosen reply-to on
 *      authenticated mail is a phishing header, which is the same rule as (1) about a
 *      different field.
 *
 * ── THE FAN-OUT IS CHUNKED, BECAUSE THERE IS NO JOB RUNNER IN THIS PRODUCT ─────────
 * `sendEmail` takes ONE `to` per call — deliberately, because a shared array is how one
 * family's members read each other's addresses in the To line — and a hundred and forty
 * relatives is a hundred and forty HTTP calls at a provider rate limit. That does not fit
 * one request, and there is no cron, no worker and no queue anywhere here (FutureFeature.md
 * makes the same observation about a GEDCOM import: "It needs an upload, a job, and a page
 * that can be left and come back to — none of which this product has").
 *
 * So the RECIPIENT ROWS ARE THE QUEUE. `sendDistribution` resolves the audience and writes
 * them; `sendDistributionBatch` claims and sends a bounded slice and reports progress; the
 * client calls it until nothing is pending. Three properties fall out of that and all three
 * are worth having:
 *
 *   * A send survives a closed laptop, because the state is in the table rather than in a
 *     request. "Try again" resumes it rather than restarting it.
 *   * Every row records its own outcome, which is the only way to be honest about a sender
 *     that FAILS SOFT by design. AGENTS.md's rule for this whole layer is that "a caller
 *     must not render success over an email that did not go".
 *   * Two callers cannot mail one relative twice, because the claim is a single statement
 *     under `FOR UPDATE SKIP LOCKED` in `claim_distribution_recipients()`.
 *
 * ── EVERY WRITE IS THE ADMIN CLIENT, AND THE READS ARE TOO ─────────────────────────
 * Neither table has an INSERT, UPDATE or DELETE policy, so §2c denies the browser those
 * outright and these actions are the boundary. `.eq('family_code', …)` is by hand on every
 * statement (§3).
 *
 * THE ROSTER READ IS ADMIN-CLIENT ON PURPOSE, and it is the sharpest §3 decision in this
 * file: if the audience narrowed to what the SENDER is entitled to read, "nobody is missed"
 * would be false. A sender who does not hold `community/directory` at `'any'` would mail a
 * subset of the family and be told it went to everybody — a wrong number rather than a
 * missing one, which is the same argument the four activity reports make.
 */

// ── Pacing ────────────────────────────────────────────────────────────────────────────

/**
 * How many relatives one call mails, and how long it waits between them.
 *
 * BOTH NUMBERS ARE ABOUT LIMITS WE DO NOT CONTROL, and getting either wrong fails in a way
 * that looks like something else:
 *
 *   * Resend rate-limits requests per second. Exceed it and sends come back 429 — which
 *     this code would faithfully record as `failed`, so a pacing bug presents as a
 *     delivery problem and sends somebody looking at DNS.
 *   * A serverless function has a wall-clock ceiling (10s on some plans, 15s by default on
 *     others, and no `vercel.json` here raises it). A batch that approaches it is killed
 *     mid-flight, which strands its claimed rows in `sending`.
 *
 * So the batch is sized so that `BATCH_SIZE * SEND_SPACING_MS` stays comfortably under the
 * smallest of those ceilings, with the provider call itself on top. Twelve at 550ms is about
 * 6.6 seconds of spacing. IF YOU RAISE EITHER, do the multiplication first.
 *
 * A STRANDED `sending` ROW IS RECOVERABLE and that is why `requeueDistribution` exists: it
 * puts `sending` and `failed` rows back to `pending`. Without it a killed batch would leave
 * twelve relatives permanently un-mailed with nothing on the screen able to fix it.
 */
const BATCH_SIZE = 12
const SEND_SPACING_MS = 550

/** Space out the provider calls. `await` on a timer, which is all a rate limit needs. */
function pace(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Shapes ────────────────────────────────────────────────────────────────────────────

/** One distribution as the list renders it. */
export interface DistributionSummary {
  id: string
  subject: string
  /** First line or so, for the list. The full body is on the detail. */
  preview: string
  scope: DistributionScope
  /** "Everyone", or the region or chapter name. Resolved server-side. */
  audienceLabel: string
  senderName: string | null
  notAddressed: number
  createdAt: string
  counts: RecipientCounts
  progress: DistributionProgress
}

/** One addressed relative, as the roster renders them. */
export interface DistributionRecipientRow {
  id: string
  name: string
  email: string
  state: string
  sentAt: string | null
}

export interface DistributionDetail extends DistributionSummary {
  body: string
  recipients: DistributionRecipientRow[]
}

/** What a member may do here. For the controls, never for the gate. */
export interface DistributionRights {
  send: boolean
  remove: boolean
}

/** An area a distribution can be aimed at. Names only — see `getDistributionAudiences`. */
export interface AudienceOption {
  scope: DistributionScope
  /** `null` for the family-wide option, which names no area. */
  id: string | null
  label: string
  /** How many relatives it addresses today. */
  addressed: number
  /** How many of those have no mailbox — see `unreachable` in the pure module. */
  unreachable: number
}

// ── The roster ────────────────────────────────────────────────────────────────────────

/**
 * Every approved relative, with their address and where they sit in the geography.
 *
 * ── WHO IS ON IT: `'approved'` ONLY, ACCOUNT OR NOT ────────────────────────────────
 * The Dues Projections rule, and for the same reason. Approval is the line because somebody
 * who has not been admitted has not joined, and mailing an applicant the family's internal
 * news before anybody decided to admit them is the one direction that cannot be undone.
 *
 * ACCOUNT-LESS RELATIVES ARE INCLUDED, and they are why `unreachable` exists. A recorded
 * grandmother is a member of the family; she is on the roster, she is counted as addressed,
 * and she is not mailed — because her address is generated. Leaving her off the roster
 * entirely would make the addressed count quietly disagree with the Directory, and mailing
 * her would hard-bounce against our own sending domain. AGENTS.md's PICKER-versus-PROJECTION
 * distinction says a projection counts everybody; a roster is a projection.
 *
 * ── §3 BY HAND, AND THE REGION IS DERIVED ──────────────────────────────────────────
 * The service role applies no RLS. `.eq('family_code', …)` is what makes this the family's
 * own roster, and the chapter/region join goes through `chapterPlaces`-shaped logic done
 * inline: this needs chapter IDs mapped to REGION IDs, where that helper returns NAMES. A
 * second reader of that module would have to widen its return type for one caller, so the
 * two-column read is done here and the reason is written down rather than the module bent.
 */
async function readRoster(familyCode: string): Promise<{
  candidates: AudienceCandidate[]
  ok: boolean
}> {
  const admin = createAdminClient()

  const { data: people, error } = await admin
    .from('people')
    .select('id, first_name, last_name, primary_email, email_is_placeholder, chapter_id')
    .eq('family_code', familyCode)
    .eq('membership_status', 'approved')

  // §8. A REFUSED READ MUST NOT LOOK LIKE AN EMPTY FAMILY. Everywhere else in this codebase
  // that would be a wrong figure on a screen; here it would be a distribution that addressed
  // nobody and reported itself as sent, which is worse — so the caller is told and nothing is
  // written.
  if (error) {
    console.error(`[distributions] roster read failed for ${familyCode}: ${error.message}`)
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

  // The chapter -> region map, for the region audiences. Skipped entirely for a family with
  // no chapters, which is most of them — `/admin/members/organization` is Plus.
  const chapterIds = [...new Set(rows.map(r => r.chapter_id).filter((c): c is string => !!c))]
  const regionOf = new Map<string, string | null>()
  if (chapterIds.length > 0) {
    const { data: chapters, error: chapterError } = await admin
      .from('chapters')
      .select('id, region_id')
      .eq('family_code', familyCode)
      .in('id', chapterIds)
    if (chapterError) {
      // SAME RULE AS ABOVE, and it matters more than it looks: with no map every chapter
      // resolves to no region, so every REGION audience silently addresses nobody. That is
      // the announcement bug in the other direction and it must not be reported as a family
      // with nobody in that region.
      console.error(
        `[distributions] chapter regions failed for ${familyCode}: ${chapterError.message}`,
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

/** May the caller send, and may they delete a record? For the controls, never for the gate. */
export async function getDistributionRights(): Promise<DistributionRights> {
  const g = await requireMember()
  if (!g.ok) return { send: false, remove: false }
  const [send, remove] = await Promise.all([
    canAny(g.userId, 'community/distributions', 'create'),
    canAny(g.userId, 'community/distributions', 'delete'),
  ])
  return { send, remove }
}

/**
 * The audiences this family can aim at, each with the number it addresses today.
 *
 * ── THE COUNTS ARE THE FEATURE OF THIS FUNCTION ────────────────────────────────────
 * "Everyone (141)" and "Texas region (38)" are what let somebody check the audience against
 * what they meant BEFORE the mail goes, which is the only moment checking is any use. An
 * unlabelled picker over a hundred and forty relatives is how a regional message reaches
 * everybody.
 *
 * `unreachable` is reported per audience too, because it is the number that otherwise reads
 * as a failure afterwards: "38 addressed, 4 with no email on file" said in advance is a fact
 * about the family, and the same 4 discovered in the roster after sending looks like a bug.
 *
 * A REGION OR CHAPTER THAT ADDRESSES NOBODY IS STILL LISTED, and that is deliberate — the
 * opposite of `getMeetingAttendeeOptions`, which lists only boards somebody holds an office
 * on. There, an empty board is a control that selects nobody; here, an empty chapter with
 * its count showing IS the answer to "why did nobody in Boston get it", and hiding the
 * option leaves that question unanswerable.
 */
export async function getDistributionAudiences(): Promise<AudienceOption[]> {
  const g = await requireMember()
  if (!g.ok) return []
  // `canAny` on `create`, matching `sendDistribution`. Reading the audience list in order to
  // send is the same grant as sending — a read that is one grant cheaper than the write it
  // exists to set up is the mismatch `getMemberProfileForEdit` documents.
  if (!(await canAny(g.userId, 'community/distributions', 'create'))) return []

  const { candidates, ok } = await readRoster(g.familyCode)
  if (!ok) return []

  const admin = createAdminClient()
  const [regionsRes, chaptersRes] = await Promise.all([
    admin.from('regions').select('id, name').eq('family_code', g.familyCode).order('name'),
    admin.from('chapters').select('id, name').eq('family_code', g.familyCode).order('name'),
  ])

  const options: AudienceOption[] = []

  const tally = (audience: DistributionAudience) => {
    const { recipients } = resolveRecipients(candidates, audience)
    return {
      addressed: recipients.length,
      unreachable: recipients.filter(r => r.state === 'unreachable').length,
    }
  }

  options.push({
    scope: 'family',
    id: null,
    label: 'Everyone in the family',
    ...tally({ scope: 'family', regionId: null, chapterId: null }),
  })

  // §8 on both: a refused read here would silently offer a family with regions no regional
  // audience at all, and the sender would conclude the family has none.
  if (regionsRes.error) {
    console.error(`[distributions] regions read failed: ${regionsRes.error.message}`)
  } else {
    for (const r of (regionsRes.data ?? []) as { id: string; name: string }[]) {
      options.push({
        scope: 'region',
        id: r.id,
        label: `${r.name} region`,
        ...tally({ scope: 'region', regionId: r.id, chapterId: null }),
      })
    }
  }

  if (chaptersRes.error) {
    console.error(`[distributions] chapters read failed: ${chaptersRes.error.message}`)
  } else {
    for (const c of (chaptersRes.data ?? []) as { id: string; name: string }[]) {
      options.push({
        scope: 'chapter',
        id: c.id,
        label: `${c.name} chapter`,
        ...tally({ scope: 'chapter', regionId: null, chapterId: c.id }),
      })
    }
  }

  return options
}

/** The two embeds this module uses, with their constraints named. See the note below. */
const DISTRIBUTION_SELECT =
  '*, people!distributions_sent_by_fkey(first_name, last_name),'
  + ' regions!distributions_region_id_fkey(name), chapters!distributions_chapter_id_fkey(name)'

/**
 * CONSTRAINTS ARE NAMED ON EVERY EMBED, EVEN THOUGH TODAY THEY NEED NOT BE.
 *
 * `distributions` has exactly ONE foreign key to `people`, to `regions` and to `chapters`, so
 * bare embeds resolve as of 2026-08-22 — measured against the live stack rather than assumed.
 * They are named anyway for the reason §8's `announcement_unpins` incident happened at all:
 * this feature adds `distribution_recipients`, a table with foreign keys to exactly
 * `distributions` and `people`, which is the junction SHAPE that made a year-old correct
 * embed on `announcements` start answering PGRST201 — and therefore `[]`, from an action that
 * discarded the error, on a page nobody had edited.
 *
 * Two independent things keep that from happening here: the uniqueness on
 * `(distribution_id, person_id)` is an INDEX rather than a constraint, so relationship
 * inference does not read it (the migration argues that at length), and these embeds name
 * their path. Belt and braces, on a rule that has emptied a production page twice.
 */
type DistributionRow = {
  id: string
  subject: string
  body: string
  scope: string
  region_id: string | null
  chapter_id: string | null
  not_addressed: number | null
  created_at: string
  people: unknown
  regions: unknown
  chapters: unknown
}

function embedName(value: unknown): string | null {
  const row = (Array.isArray(value) ? value[0] : value) as
    { first_name?: string; last_name?: string; name?: string } | null | undefined
  if (!row) return null
  if (typeof row.name === 'string') return row.name
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || null
}

function isScope(value: string): value is DistributionScope {
  return value === 'family' || value === 'region' || value === 'chapter'
}

/**
 * How an audience reads on the screen, long after it was sent.
 *
 * The AREA NAME comes off the embed rather than being stored, so a renamed chapter reads
 * correctly in the history — the opposite decision from the recipient ADDRESS, which is
 * snapshotted. The two are different on purpose: which chapter was addressed is a reference
 * to a thing that still exists and can be renamed, while where a message was delivered is a
 * fact about an event that already happened.
 *
 * A DELETED area falls back to naming the scope rather than to a blank, because
 * `region_id`/`chapter_id` are `ON DELETE SET NULL` and "a region" is truer than "".
 */
function audienceLabelOf(row: DistributionRow): string {
  if (row.scope === 'region') {
    const name = embedName(row.regions)
    return name ? `${name} region` : 'A region that has since been removed'
  }
  if (row.scope === 'chapter') {
    const name = embedName(row.chapters)
    return name ? `${name} chapter` : 'A chapter that has since been removed'
  }
  return 'Everyone in the family'
}

function previewOf(body: string): string {
  const first = bodyParagraphs(body)[0] ?? ''
  return first.length > 160 ? `${first.slice(0, 157)}…` : first
}

/**
 * Every distribution this caller may read, newest first, with its delivery counts.
 *
 * ── THE COUNTS ARE TWO QUERIES, NOT A JOIN, AND `[]` IS NOT ALLOWED TO MEAN ZERO ───
 * The recipient states are read in one `.in('distribution_id', …)` — the TRANSITIVE shape
 * `audit:family-scope` recognises, narrowed to ids that came out of a family-scoped read,
 * and carrying its own `family_code` conjunct as well.
 *
 * A REFUSED COUNT READ REFUSES THE WHOLE LIST. Not a cosmetic choice: with no recipient rows
 * every distribution reports `Nobody to send to`, so an outage would render as a family that
 * has never successfully mailed anybody — a wrong figure rather than a missing one, which is
 * the rule the four activity reports state and the one §8 is about.
 */
export async function getDistributions(): Promise<DistributionSummary[] | null> {
  const g = await requireMember()
  if (!g.ok) return null
  // `can`, matching the page's `requireView`: scope `'own'` is a real narrowing here ("the
  // ones I sent") and the SELECT policy expresses it, so demanding `canAny` would refuse a
  // caller the screen admits.
  if (!(await can(g.userId, 'community/distributions', 'view'))) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('distributions')
    .select(DISTRIBUTION_SELECT)
    .eq('family_code', g.familyCode)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`[distributions] list failed for ${g.familyCode}: ${error.message}`)
    return null
  }

  const rows = (data ?? []) as unknown as DistributionRow[]
  if (rows.length === 0) return []

  const counts = await readCounts(rows.map(r => r.id), g.familyCode)
  if (!counts) return null

  return rows.map(r => summarize(r, counts.get(r.id) ?? countStates([])))
}

function summarize(row: DistributionRow, counts: RecipientCounts): DistributionSummary {
  return {
    id: row.id,
    subject: row.subject,
    preview: previewOf(row.body),
    scope: isScope(row.scope) ? row.scope : 'family',
    audienceLabel: audienceLabelOf(row),
    senderName: embedName(row.people),
    notAddressed: row.not_addressed ?? 0,
    createdAt: row.created_at,
    counts,
    progress: distributionProgress(counts),
  }
}

/** States per distribution. `null` on a refused read — see `getDistributions`. */
async function readCounts(
  ids: readonly string[],
  familyCode: string,
): Promise<Map<string, RecipientCounts> | null> {
  if (ids.length === 0) return new Map()
  const { data, error } = await createAdminClient()
    .from('distribution_recipients')
    .select('distribution_id, state')
    // TRANSITIVE: the ids came out of a family-scoped read. The conjunct is here anyway (§3),
    // because "it came from a scoped read" is a property of today's caller and the conjunct is
    // a property of the statement.
    .eq('family_code', familyCode)
    .in('distribution_id', ids as string[])

  if (error) {
    console.error(`[distributions] recipient counts failed for ${familyCode}: ${error.message}`)
    return null
  }

  const byId = new Map<string, string[]>()
  for (const r of (data ?? []) as { distribution_id: string; state: string }[]) {
    byId.set(r.distribution_id, [...(byId.get(r.distribution_id) ?? []), r.state])
  }
  const counts = new Map<string, RecipientCounts>()
  for (const id of ids) counts.set(id, countStates(byId.get(id) ?? []))
  return counts
}

/**
 * One distribution with its full message and its roster.
 *
 * THE ROSTER IS THE POINT OF THIS SCREEN. It is where somebody finds out that four relatives
 * have no address on file and two bounced — which no aggregate can say and which is the
 * whole reason a fail-soft sender needs a per-recipient record.
 */
export async function getDistribution(id: string): Promise<DistributionDetail | null> {
  const g = await requireMember()
  if (!g.ok) return null
  if (!(await can(g.userId, 'community/distributions', 'view'))) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('distributions')
    .select(DISTRIBUTION_SELECT)
    .eq('id', id)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (error) {
    console.error(`[distributions] detail failed for ${id}: ${error.message}`)
    return null
  }
  const row = (data ?? null) as unknown as DistributionRow | null
  if (!row) return null

  const { data: people, error: peopleError } = await admin
    .from('distribution_recipients')
    // The constraint is named — see the note above `DISTRIBUTION_SELECT`. This is the embed
    // that would break first if the uniqueness ever became a constraint again.
    .select('id, email, state, sent_at, people!distribution_recipients_person_id_fkey(first_name, last_name)')
    .eq('distribution_id', id)
    .eq('family_code', g.familyCode)
    .order('state')
    .order('email')

  if (peopleError) {
    console.error(`[distributions] roster failed for ${id}: ${peopleError.message}`)
    return null
  }

  const recipients = ((people ?? []) as Record<string, unknown>[]).map(r => ({
    id: r.id as string,
    name: embedName(r.people) ?? (r.email as string),
    email: r.email as string,
    state: r.state as string,
    sentAt: (r.sent_at as string | null) ?? null,
  }))

  const counts = countStates(recipients.map(r => r.state))
  return { ...summarize(row, counts), body: row.body, recipients }
}

// ── Sending ───────────────────────────────────────────────────────────────────────────

export interface SendDistributionInput {
  subject: string
  body: string
  scope: DistributionScope
  /** The one area id, for an area scope. Verified against the family before it is written. */
  areaId?: string | null
}

export interface SendDistributionResult {
  success: boolean
  message?: string
  /** Present on success. What the client passes to `sendDistributionBatch`. */
  distributionId?: string
  /** How many relatives will be mailed, so the client can size its progress. */
  queued?: number
}

/**
 * Resolve the audience, write the queue, and mail nobody yet.
 *
 * ── IT DELIBERATELY SENDS NOTHING ──────────────────────────────────────────────────
 * The first draft resolved and sent in one call and it is wrong twice over. A hundred and
 * forty provider calls do not fit a request, so the tail would be killed mid-flight; and
 * with the rows written first, a send that dies has a resumable state instead of an unknown
 * one. So this commits the DECISION — who was addressed, what was written, who sent it — and
 * `sendDistributionBatch` does the work. The same separation `create_family_invitation` makes
 * between minting a token and mailing it.
 *
 * ── THE AUDIENCE IS RESOLVED HERE AND FROZEN ───────────────────────────────────────
 * Not re-resolved per batch. A relative admitted halfway through a send is not on it, and
 * that is the correct answer rather than a limitation: "who was this addressed to" must have
 * one answer, and re-resolving would make the roster depend on when each batch happened to
 * run. It also means a batch cannot silently widen the audience.
 */
export async function sendDistribution(
  input: SendDistributionInput,
): Promise<SendDistributionResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }

  // §2: `canAny`, not `can`. Mail to the whole family is family-wide operation with no
  // coherent "own" version, and the distribution a member would own is the abuse case.
  if (!(await canAny(g.userId, 'community/distributions', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const subject = input.subject?.trim() ?? ''
  const body = input.body?.trim() ?? ''
  if (!subject) return { success: false, message: 'Give the message a subject' }
  if (!body) return { success: false, message: 'Write something to send' }
  // A CEILING ON BOTH, because these are stored, escaped and rendered in a mail client, and
  // an unbounded textarea is an unbounded row. Generous rather than tight: a long family
  // update is a legitimate thing to send.
  if (subject.length > 200) {
    return { success: false, message: 'The subject is too long — keep it under 200 characters.' }
  }
  if (body.length > 20_000) {
    return { success: false, message: 'The message is too long — keep it under 20,000 characters.' }
  }

  if (!isScope(input.scope)) return { success: false, message: 'Choose who this is going to' }

  // ── THE AREA, CHECKED BEFORE IT IS WRITTEN (§4) ────────────────────────────────────
  // A row stamped with the caller's own family_code satisfies every policy while the id it
  // carries points anywhere. `belongsToFamily` is what closes that, and the guard trigger is
  // underneath it.
  //
  // AN AREA SCOPE MUST NAME ITS AREA, and refusing here is the opposite of the announcement
  // rule. There, 'chapter' with an empty picker widens to family-wide, because publishing to
  // nobody is worse than publishing too far. Here, widening a misconfigured audience to the
  // whole family IS the mail cannon — so it is refused, said plainly, and `inAudience` returns
  // false underneath as well.
  const areaId = input.areaId?.trim() || null
  let regionId: string | null = null
  let chapterId: string | null = null

  if (input.scope === 'region') {
    if (!areaId) return { success: false, message: 'Choose which region this is going to' }
    if (!(await belongsToFamily('regions', areaId, g.familyCode))) {
      return { success: false, message: 'Region not found' }
    }
    regionId = areaId
  } else if (input.scope === 'chapter') {
    if (!areaId) return { success: false, message: 'Choose which chapter this is going to' }
    if (!(await belongsToFamily('chapters', areaId, g.familyCode))) {
      return { success: false, message: 'Chapter not found' }
    }
    chapterId = areaId
  }

  const { candidates, ok } = await readRoster(g.familyCode)
  if (!ok) {
    // NOTHING IS WRITTEN ON A REFUSED ROSTER READ. An empty roster and a broken read are
    // indistinguishable at this layer, and one of them means "this family has nobody" while
    // the other means "we could not tell" — writing a distribution addressed to nobody over
    // the second would report a completed send of zero messages.
    return {
      success: false,
      message: 'We could not read the family roster just now. Nothing has been sent.',
    }
  }

  const audience: DistributionAudience = { scope: input.scope, regionId, chapterId }
  const { recipients, notAddressed } = resolveRecipients(candidates, audience)

  if (recipients.length === 0) {
    return {
      success: false,
      message: 'Nobody in the family matches that audience, so there is nothing to send.',
    }
  }
  if (!recipients.some(r => r.state === 'pending')) {
    // EVERY ADDRESSED RELATIVE IS UNREACHABLE. Refused rather than recorded, because a
    // distribution that can mail nobody is not a thing that happened — and the message says
    // WHY, since "no email address on file" is fixable and "nobody matched" is not.
    return {
      success: false,
      message: 'Everyone in that audience is on the family tree without an email address, '
        + 'so there is nobody to send to.',
    }
  }

  // The sender's own address, for `reply_to`. Read off their own row, never a parameter.
  const admin = createAdminClient()
  let replyTo: string | null = null
  if (g.personId) {
    const { data: me } = await admin
      .from('people')
      .select('primary_email, email_is_placeholder')
      .eq('id', g.personId)
      .eq('family_code', g.familyCode)
      .maybeSingle()
    const mine = (me ?? null) as
      { primary_email: string | null; email_is_placeholder: boolean | null } | null
    // A GENERATED ADDRESS IS NOT A REPLY-TO. Somebody sending from a record with a placeholder
    // address would otherwise point the whole family's replies at a mailbox that bounces —
    // and `support@` is a better answer than that.
    if (mine?.primary_email && mine.email_is_placeholder !== true) replyTo = mine.primary_email
  }

  const { data: created, error: createError } = await admin
    .from('distributions')
    .insert({
      family_code: g.familyCode,
      subject,
      body,
      scope: input.scope,
      region_id: regionId,
      chapter_id: chapterId,
      sent_by: g.personId || null,
      reply_to: replyTo,
      not_addressed: notAddressed,
    })
    .select('id')
    .single()

  if (createError || !created) {
    console.error(`[distributions] create failed: ${createError?.message ?? 'no row'}`)
    return { success: false, message: createError?.message ?? 'That could not be saved.' }
  }

  const distributionId = (created as { id: string }).id

  const { error: rosterError } = await admin.from('distribution_recipients').insert(
    recipients.map(r => ({
      family_code: g.familyCode,
      distribution_id: distributionId,
      person_id: r.personId,
      email: r.email,
      state: r.state,
    })),
  )

  if (rosterError) {
    // THE PARENT IS REMOVED RATHER THAN LEFT. A distribution with no roster is a record of a
    // message that went to nobody, sitting in the log looking like a send that failed
    // completely — and the cascade means removing it takes any partial roster with it. The
    // caller is told nothing was sent, which is true.
    console.error(`[distributions] roster insert failed: ${rosterError.message}`)
    await admin.from('distributions').delete()
      .eq('id', distributionId).eq('family_code', g.familyCode)
    return { success: false, message: 'That could not be prepared. Nothing has been sent.' }
  }

  revalidatePath('/community/distributions')
  return {
    success: true,
    distributionId,
    queued: recipients.filter(r => r.state === 'pending').length,
  }
}

export interface BatchResult {
  success: boolean
  message?: string
  /** True while anything is still pending. What the client loops on. */
  sending?: boolean
  counts?: RecipientCounts
  progressLabel?: string
}

/**
 * Mail the next slice, and report where the send has got to.
 *
 * ── THE CLAIM IS ONE STATEMENT AND THAT IS THE WHOLE DESIGN ────────────────────────
 * `claim_distribution_recipients()` flips up to `BATCH_SIZE` rows from `pending` to `sending`
 * and returns them, under `FOR UPDATE SKIP LOCKED`. A read-then-write here instead would let
 * two administrators pressing Send — or one member with two tabs — each claim the same rows,
 * and what that produces is not a lost update, it is the same message delivered twice to the
 * same relative. That cannot be taken back, which is why the primitive is in SQL.
 *
 * ── EVERY OUTCOME IS WRITTEN BACK, ONE ROW AT A TIME ───────────────────────────────
 * `sendEmail` never throws and returns `{ sent: false, error }` for a refusal, a timeout and
 * a missing API key alike. That is right for the sender and it means the CALLER owns the
 * truth: each row records `sent` or `failed` with the diagnostic, so the screen can say "8
 * sent, 2 could not be delivered" instead of "sent". A batch that reported only its own total
 * would be exactly the success-over-a-dropped-email failure AGENTS.md forbids.
 *
 * WRITTEN BACK INDIVIDUALLY rather than in two grouped updates, deliberately: if this
 * function is killed halfway (the platform ceiling), the rows already mailed are already
 * recorded, and only the un-written ones are left in `sending` for `requeueDistribution` to
 * recover. A grouped write at the end would lose the outcome of everything in the batch and
 * re-mail all twelve.
 */
export async function sendDistributionBatch(distributionId: string): Promise<BatchResult> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  // SENDING, NOT VIEWING. The batch is the act of mailing, so it takes the same grant as
  // starting one — a caller who may only read the log must not be able to drive a send.
  if (!(await canAny(g.userId, 'community/distributions', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const admin = createAdminClient()

  // §3/§4: the distribution must be this family's before anything is claimed. The claim
  // function asserts the same thing again — see its header on being written as if reachable.
  const { data: row, error: readError } = await admin
    .from('distributions')
    .select('id, subject, body, reply_to, people!distributions_sent_by_fkey(first_name, last_name)')
    .eq('id', distributionId)
    .eq('family_code', g.familyCode)
    .maybeSingle()

  if (readError) {
    console.error(`[distributions] batch read failed for ${distributionId}: ${readError.message}`)
    return { success: false, message: 'That could not be read just now.' }
  }
  const distribution = (row ?? null) as {
    id: string; subject: string; body: string; reply_to: string | null; people: unknown
  } | null
  if (!distribution) return { success: false, message: 'Not found' }

  const { data: claimed, error: claimError } = await admin.rpc('claim_distribution_recipients', {
    p_distribution_id: distributionId,
    p_family_code: g.familyCode,
    p_limit: BATCH_SIZE,
  })

  if (claimError) {
    console.error(`[distributions] claim failed for ${distributionId}: ${claimError.message}`)
    return { success: false, message: 'That send could not be continued just now.' }
  }

  const batch = (claimed ?? []) as { id: string; person_id: string; email: string }[]

  // Composed ONCE per batch rather than once per recipient: the message is identical for
  // everybody and `renderEmailFrom` is not free. What is per-recipient is the `to`.
  const composed = distributionEmail({
    origin: emailOrigin(),
    familyName: await familyNameOf(g.familyCode),
    subject: distribution.subject,
    paragraphs: bodyParagraphs(distribution.body),
    senderName: embedName(distribution.people),
  })

  for (const [index, recipient] of batch.entries()) {
    // PACED BETWEEN CALLS, NOT BEFORE THE FIRST. See BATCH_SIZE — the spacing is about the
    // provider's per-second limit, and a wait before the first call is pure latency.
    if (index > 0) await pace(SEND_SPACING_MS)

    const result = await sendEmail({
      to: recipient.email,
      subject: composed.subject,
      html: composed.html,
      tag: composed.tag,
      replyTo: distribution.reply_to ?? undefined,
    })

    const { error: writeError } = await admin
      .from('distribution_recipients')
      .update({
        state: result.sent ? 'sent' : 'failed',
        sent_at: result.sent ? new Date().toISOString() : null,
        // TRUNCATED. A provider error body can be an HTML page from a proxy, and this column
        // is read by an engineer rather than rendered.
        error: result.sent ? null : (result.error ?? 'unknown').slice(0, 300),
      })
      .eq('id', recipient.id)
      .eq('family_code', g.familyCode)

    if (writeError) {
      // NOT FATAL, AND LOUD. The mail has already gone; failing the batch here would leave the
      // row in `sending` and invite `requeueDistribution` to send it a second time. Logging
      // and carrying on leaves one stranded row, which is recoverable and does not duplicate.
      console.error(
        `[distributions] could not record ${recipient.id} after a `
        + `${result.sent ? 'successful' : 'failed'} send: ${writeError.message}`,
      )
    }
  }

  const counts = await readCounts([distributionId], g.familyCode)
  if (!counts) return { success: false, message: 'The send progressed but could not be read.' }
  const progress = distributionProgress(counts.get(distributionId)!)

  revalidatePath('/community/distributions')
  return {
    success: true,
    sending: progress.sending,
    counts: counts.get(distributionId)!,
    progressLabel: progress.label,
  }
}

/** The family's own name, for the email. One read, and a fallback rather than a throw. */
async function familyNameOf(familyCode: string): Promise<string> {
  const { data } = await createAdminClient()
    .from('families').select('family_name').eq('family_code', familyCode).maybeSingle()
  return ((data ?? null) as { family_name: string | null } | null)?.family_name || 'your family'
}

/**
 * Stop a send that is under way.
 *
 * ── IT IS BEHIND `create`, NOT `delete`, AND THAT IS DELIBERATE ────────────────────
 * Whoever may start a mail cannon may stop one. Making the emergency brake a stronger grant
 * than the trigger is backwards: the moment this is needed is the moment somebody has just
 * realised the audience was wrong, and the answer to "who can stop it" must not be "not you".
 *
 * ── IT CANCELS THE UNSENT AND TOUCHES NOTHING ELSE ─────────────────────────────────
 * `pending` becomes `cancelled`. `sent` rows stay sent, because they have been — a stop is
 * not an undo, and there is no such thing as un-sending mail. `sending` rows are left alone
 * too: those are claimed and quite possibly already at the provider, so re-labelling them
 * would be recording a cancellation of a message that went. The screen therefore says
 * "Stopped — 4 sent, 20 not sent", which is the truth.
 */
export async function cancelDistribution(
  distributionId: string,
): Promise<{ success: boolean; message?: string; cancelled?: number }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'community/distributions', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const admin = createAdminClient()
  if (!(await belongsToFamily('distributions', distributionId, g.familyCode))) {
    return { success: false, message: 'Not found' }
  }

  const { data, error } = await admin
    .from('distribution_recipients')
    .update({ state: 'cancelled' })
    .eq('distribution_id', distributionId)
    .eq('family_code', g.familyCode)
    .eq('state', 'pending')
    .select('id')

  if (error) return { success: false, message: error.message }

  revalidatePath('/community/distributions')
  // ZERO IS REPORTED HONESTLY rather than as a success. Pressing Stop on a send that had
  // already finished must not say "stopped" — nothing was stopped, and the counts beside it
  // would contradict the message.
  return { success: true, cancelled: ((data ?? []) as unknown[]).length }
}

/**
 * Put the failures and anything stranded back in the queue.
 *
 * ── TWO STATES, AND THE SECOND ONE IS WHY THIS IS NOT OPTIONAL ─────────────────────
 * `failed` is the obvious half: a transient provider refusal or a timeout, worth another go.
 *
 * `sending` is the half that would otherwise be a dead end. A batch killed at the platform's
 * wall-clock ceiling leaves its claimed rows in `sending` with nothing able to move them, so
 * those relatives would be permanently un-mailed and the distribution would report itself as
 * finished. This is the recovery path the pacing constants' header points at.
 *
 * `cancelled` IS NOT REQUEUED. Somebody stopped that on purpose, and a "Try again" that
 * quietly resumed a cancelled send would be the worst button in the product. Re-sending to a
 * cancelled audience means composing a new distribution, which leaves a record of the
 * decision.
 */
export async function requeueDistribution(
  distributionId: string,
): Promise<{ success: boolean; message?: string; requeued?: number }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'community/distributions', 'create'))) {
    return { success: false, message: 'Not authorized' }
  }

  const admin = createAdminClient()
  if (!(await belongsToFamily('distributions', distributionId, g.familyCode))) {
    return { success: false, message: 'Not found' }
  }

  const { data, error } = await admin
    .from('distribution_recipients')
    .update({ state: 'pending', error: null })
    .eq('distribution_id', distributionId)
    .eq('family_code', g.familyCode)
    .in('state', ['failed', 'sending'])
    .select('id')

  if (error) return { success: false, message: error.message }

  revalidatePath('/community/distributions')
  return { success: true, requeued: ((data ?? []) as unknown[]).length }
}

/**
 * Remove the record of a distribution.
 *
 * A STRICTLY STRONGER GRANT than sending, because it destroys the audit trail of what was
 * mailed to whom — which is the one thing this feature produces that cannot be reconstructed.
 * The recipients go with it through `ON DELETE CASCADE`.
 *
 * IT DOES NOT STOP A SEND IN FLIGHT, and does not pretend to: deleting a distribution whose
 * batches are running would remove the queue from underneath them. `cancelDistribution` is
 * the control for that, and the screen offers it first while anything is pending.
 */
export async function deleteDistribution(
  distributionId: string,
): Promise<{ success: boolean; message?: string }> {
  const g = await requireMember()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await canAny(g.userId, 'community/distributions', 'delete'))) {
    return { success: false, message: 'Not authorized' }
  }

  const admin = createAdminClient()

  // ── §8b: THIS CHECK IS WHAT STOPS A ZERO-ROW DELETE REPORTING SUCCESS ─────────────
  // Without it, `.delete().eq('id', …).eq('family_code', …)` for another family's id matches
  // NOTHING and PostgREST hands back `{ error: null }` — so the action returned
  // `{ success: true }` over a write that did not happen. That is the exact defect
  // `lib/confirmed-write.ts` exists for, and it is not hypothetical here: `tests/rls` caught
  // it on the first run of this feature's cases, through the `expectRefusal` half rather than
  // the probe (the probe was perfectly happy — the row was untouched, which is the point).
  //
  // `belongsToFamily` rather than `confirmWrite`, for consistency with `cancelDistribution`
  // and `requeueDistribution`, which already resolve the parent this way. Three actions in one
  // file answering "is this distribution mine?" three different ways is worse than any one of
  // the three answers.
  //
  // AND IT COMES BEFORE THE PENDING PRE-CHECK, deliberately. The other order would tell a
  // caller from another family "this send has not finished", which is both the wrong answer and
  // a disclosure that a send is under way in a family they cannot see.
  if (!(await belongsToFamily('distributions', distributionId, g.familyCode))) {
    return { success: false, message: 'Not found' }
  }

  const { data: pending, error: pendingError } = await admin
    .from('distribution_recipients')
    .select('id')
    .eq('distribution_id', distributionId)
    .eq('family_code', g.familyCode)
    .eq('state', 'pending')
    .limit(1)

  if (pendingError) {
    console.error(`[distributions] delete pre-check failed: ${pendingError.message}`)
    return { success: false, message: 'That could not be removed just now.' }
  }
  if (((pending ?? []) as unknown[]).length > 0) {
    return {
      success: false,
      message: 'This send has not finished. Stop it first, then remove it.',
    }
  }

  const { error } = await admin
    .from('distributions')
    .delete()
    .eq('id', distributionId)
    .eq('family_code', g.familyCode)

  if (error) return { success: false, message: error.message }

  revalidatePath('/community/distributions')
  return { success: true }
}
