/**
 * Who a distribution is addressed to, and what each address resolves to.
 *
 * ── WHY THIS IS A PURE MODULE ──────────────────────────────────────────────────────
 * Two reasons, and they are the two AGENTS.md gives for every other module of this shape.
 *
 * `app/actions/distributions.ts` is `'use server'`, and everything exported from one of
 * those gets a URL — so a helper that takes a roster and an audience and returns a list of
 * ADDRESSES could not live there and be shared. That is not a theoretical objection here:
 * an endpoint whose whole job is to turn a rule into a list of every relative's email
 * address is the reconnaissance half of the mail cannon this feature exists not to be.
 *
 * And §7b: this is the arithmetic. Which relatives are addressed, which of them share an
 * address, which have no mailbox at all, and what the counts add up to afterwards are all
 * decidable from arguments, so they are decided here where `npm test` can reach them. The
 * RLS suite cannot check a figure — its fixture has six people — and this is exactly the
 * kind of rule that is wrong at the edges rather than in the middle.
 *
 * NOTHING HERE READS THE WORLD. No clock, no database, no `crypto`. The caller passes the
 * roster it has already scoped by family; this decides what to do with it.
 */

/**
 * How wide a distribution is aimed.
 *
 * The same three-word vocabulary an election scopes itself with and a board position is
 * created with — `lib/election-area.ts`, `user_roles.scope`. Not a fourth spelling of one
 * idea: `'family'` is what those two call `'national'`, and it is spelled differently here
 * for a reason worth stating, because it is the one place the vocabularies legitimately
 * diverge. An election is national because the FAMILY is the nation it is held in; a
 * distribution addressed to everybody is addressed to the family, and "National
 * distribution" would read on the screen as a distribution to some PART of the family
 * rather than to all of it.
 */
export type DistributionScope = 'family' | 'region' | 'chapter'

/**
 * What happened to one addressed person.
 *
 * SIX VALUES, AND THE LAST THREE ARE THE FEATURE. `pending`, `sent` and `failed` are the
 * obvious three and they are not sufficient — each of the others is a fact that would
 * otherwise be reported as one of those three and be WRONG:
 *
 *   `duplicate`    somebody whose address a relative already has. They were addressed, and
 *                  the mail went once. Recording them as `sent` would claim a second
 *                  delivery; leaving them out of the roster would make the addressed count
 *                  disagree with the family's own arithmetic.
 *   `unreachable`  a person on the tree with no mailbox — a generated placeholder address
 *                  (`email_is_placeholder`). NOT a failure: nothing went wrong and nobody
 *                  should chase it. Filed as `failed` it would sit in the column an
 *                  organizer works through, permanently, and the one number this screen
 *                  exists to drive to zero could never reach zero. That is the same
 *                  argument FutureFeature.md's emergency-check-in proposal makes about a
 *                  recorded grandmother, and it arrives here first.
 *   `cancelled`    somebody who was addressed and deliberately not mailed, because the send
 *                  was stopped. Distinct from `failed` for the reason a reopened gathering
 *                  task is a different bell entry from a denied one: what happened to them
 *                  is not what happened to a bounce.
 */
export type RecipientState =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'duplicate'
  | 'unreachable'
  | 'cancelled'

/** Every state a resolution can assign. Sending is what moves a row off `pending`. */
export type ResolvedState = Extract<RecipientState, 'pending' | 'duplicate' | 'unreachable'>

/**
 * One person the roster offered, with everything the addressing rule reads.
 *
 * `regionId` is DERIVED from the chapter by the caller (`chapter_id -> chapters.region_id`)
 * and is not a column on `people` — there is no `people.region_id` and this module must not
 * imply one. `null` means National, which is the ABSENCE of a region rather than a region.
 */
export interface AudienceCandidate {
  personId: string
  firstName: string
  lastName: string
  /** `primary_email`. Nullable because the column is, though in practice it is set. */
  email: string | null
  /** The address is ours and generated. Never mail it — see `unreachable` above. */
  emailIsPlaceholder: boolean
  chapterId: string | null
  regionId: string | null
}

/** Where a distribution is aimed. An area scope names exactly one area. */
export interface DistributionAudience {
  scope: DistributionScope
  regionId: string | null
  chapterId: string | null
}

/** One addressed person, and what the send should do about them. */
export interface ResolvedRecipient {
  personId: string
  /** For the roster on screen. Trimmed, and never empty — falls back to the address. */
  name: string
  /** The address AT RESOLUTION TIME. A snapshot, not a join — see `resolveRecipients`. */
  email: string
  state: ResolvedState
  /**
   * Why this row is not `pending`, in words a member reads. `null` for a `pending` row,
   * because "it is going to be sent" is not a note.
   */
  note: string | null
}

/**
 * The address as the dedupe key.
 *
 * LOWER-CASED AND TRIMMED, AND NOTHING MORE. The temptation is to go further — strip `.`
 * from a Gmail local part, drop a `+tag` — and it is the wrong call twice over. Those rules
 * are Gmail's and are not true of every provider, so applying them generally means silently
 * declining to mail somebody at an address that is genuinely theirs; and a distribution that
 * quietly drops a relative is the exact failure "nobody is missed" is sold against. The
 * domain half is case-insensitive by RFC and every mailbox provider in practice treats the
 * local part that way too, so this much is safe and the rest is not.
 */
export function normalizeAddress(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Is this person addressed by this audience?
 *
 * ── AN AREA SCOPE NARROWS. THIS IS DELIBERATELY NOT THE ANNOUNCEMENT RULE ──────────
 * `addressedTo` in lib/announcement-audience.ts treats a national or regional announcement
 * as reaching everybody, and its own comment records that as a decision. It is the right
 * decision there and the wrong one here, and the difference is what the two surfaces DO: an
 * announcement that reaches too far is a card on a dashboard somebody scrolls past, and a
 * distribution that reaches too far is mail in a hundred and forty inboxes that cannot be
 * recalled.
 *
 * FutureFeature.md names that widening as a defect not to inherit, and this is where it is
 * not inherited. The cost is one thing worth being explicit about on screen: a member in NO
 * chapter is in no region, so a region distribution does not reach them. That is correct —
 * they have not told the family where they are — and it is the sort of correct that looks
 * like a bug unless the screen says the number out loud, which is why `resolveRecipients`
 * reports what it excluded rather than only what it kept.
 *
 * AN UNNAMED AREA ADDRESSES NOBODY, which is the second inversion of the announcement rule.
 * There, "Chapter" with an empty picker is treated as family-wide, because an author who
 * chose it meant to publish something and showing it to nobody is worse. Here, widening a
 * misconfigured audience to the whole family IS the mail cannon; `sendDistribution` refuses
 * such an audience before a row exists, and this answering `false` is the floor under that.
 */
export function inAudience(person: AudienceCandidate, audience: DistributionAudience): boolean {
  switch (audience.scope) {
    case 'family':
      return true
    case 'region':
      return audience.regionId !== null && person.regionId === audience.regionId
    case 'chapter':
      return audience.chapterId !== null && person.chapterId === audience.chapterId
  }
}

/** How a person's name reads on the roster. Falls back to the address, never to blank. */
function displayName(person: AudienceCandidate, email: string): string {
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim()
  return name || email
}

/**
 * The roster order, and it is load-bearing rather than cosmetic.
 *
 * Two relatives sharing an address means one of them is `pending` and the other is
 * `duplicate`, and which is which has to be the same answer every time — otherwise
 * re-resolving the same audience (a retry, a second distribution, a test) silently
 * reassigns who is on the mail. Surname, then forename, then id: the last is the tie-break
 * that makes the order total, because two people in one family really can share a name,
 * which is why `disambiguatedName` exists at all.
 */
function rosterOrder(a: AudienceCandidate, b: AudienceCandidate): number {
  const last = (a.lastName ?? '').localeCompare(b.lastName ?? '')
  if (last !== 0) return last
  const first = (a.firstName ?? '').localeCompare(b.firstName ?? '')
  if (first !== 0) return first
  return a.personId.localeCompare(b.personId)
}

/** What a resolution addressed, and what it declined to. */
export interface ResolvedAudience {
  recipients: readonly ResolvedRecipient[]
  /**
   * People the roster offered whom this audience did not address — the region or chapter
   * filter dropped them, or they have no address column at all.
   *
   * Reported rather than discarded, because it is the number that makes an area
   * distribution legible: "38 of 141 relatives" is a fact an organizer can check against
   * what they meant, and a bare "38 addressed" is not. AGENTS.md's rule about never
   * truncating quietly, applied to an audience instead of to a list.
   */
  notAddressed: number
}

/**
 * Turn a roster and an audience into the rows to write.
 *
 * ── THE ADDRESS IS COPIED, NOT JOINED, AND IT IS THE DECISION A TASK MAKES ─────────
 * `email` comes out of here as a value and is stored on the recipient row. A gathering task
 * carries its own `label` and `kind` rather than reading them through `step_id`, for the
 * reason AGENTS.md states at length: what somebody was asked must not change when the
 * template is edited afterwards. This is that rule about a delivery — the record has to say
 * where the mail actually went, and a relative who changes their address next month must not
 * retroactively rewrite the history of a message that reached the old one.
 *
 * ── DEDUPE IS THE CLAIM `/pricing` MAKES, SO IT IS DONE HERE AND ENFORCED IN SQL ────
 * "nobody is missed and nobody is on it twice". The first half is the audience; this is the
 * second. Two relatives who share a mailbox get one message and TWO rows — one `pending`,
 * one `duplicate` — so the family's arithmetic still accounts for both of them. A partial
 * unique index on `(distribution_id, lower(email)) WHERE state <> 'duplicate'` is what makes
 * that structural rather than a property of this function; see the migration.
 *
 * A PERSON WITH NO ADDRESS AT ALL IS NOT A RECIPIENT and gets no row. `primary_email` is NOT
 * NULL in practice, so this is a defensive branch rather than a case the product produces —
 * and the honest answer for somebody with no address is that they were not addressed, which
 * is what `notAddressed` counts.
 */
export function resolveRecipients(
  candidates: readonly AudienceCandidate[],
  audience: DistributionAudience,
): ResolvedAudience {
  const addressed = [...candidates].filter(c => inAudience(c, audience)).sort(rosterOrder)
  const notAddressed = candidates.length - addressed.length

  const seen = new Set<string>()
  const recipients: ResolvedRecipient[] = []
  let unaddressable = 0

  for (const person of addressed) {
    const email = (person.email ?? '').trim()
    if (!email) {
      unaddressable += 1
      continue
    }

    // PLACEHOLDER FIRST, BEFORE DEDUPE. A generated address is unique per person by
    // construction (`placeholderEmail` folds the name and a suffix into it), so it would
    // never collide anyway — but checking it first is what keeps the ORDER of these two
    // branches from mattering, and a rule whose answer depends on the order it is applied
    // in is one somebody will reorder.
    if (person.emailIsPlaceholder) {
      recipients.push({
        personId: person.personId,
        name: displayName(person, email),
        email,
        state: 'unreachable',
        note: 'No email address on file',
      })
      continue
    }

    const key = normalizeAddress(email)
    if (seen.has(key)) {
      recipients.push({
        personId: person.personId,
        name: displayName(person, email),
        email,
        state: 'duplicate',
        note: 'Shares an address with another relative',
      })
      continue
    }

    seen.add(key)
    recipients.push({
      personId: person.personId,
      name: displayName(person, email),
      email,
      state: 'pending',
      note: null,
    })
  }

  return { recipients, notAddressed: notAddressed + unaddressable }
}

/** How many recipients sit in each state. Keys are exhaustive, so a zero is a zero. */
export type RecipientCounts = Record<RecipientState, number>

const ZERO_COUNTS: RecipientCounts = {
  pending: 0, sent: 0, failed: 0, duplicate: 0, unreachable: 0, cancelled: 0,
}

/** Tally a set of states. Anything unrecognised is ignored rather than thrown on. */
export function countStates(states: readonly string[]): RecipientCounts {
  const counts: RecipientCounts = { ...ZERO_COUNTS }
  for (const s of states) {
    if (s in counts) counts[s as RecipientState] += 1
  }
  return counts
}

/**
 * What the screen says a distribution is doing, and how it says it.
 *
 * DERIVED FROM THE COUNTS, NEVER STORED. A `status` column on `distributions` would be a
 * second fact about the same thing, kept in step by whichever write path remembered — which
 * is the `is_minor` trap (AGENTS.md §4b) and would go stale the first time a send was
 * interrupted. The rows are the truth and this reads them.
 *
 * `tone` maps onto the brand roles, and the mapping is the argument:
 *
 *   `affirm`      every addressed relative who has a mailbox got the message.
 *   `withheld`    something has not happened yet — mail still queued, or a send stopped. A
 *                 capability or an action being withheld, which is what that token is for.
 *   `destructive` a delivery FAILED. The one case in this feature that is an error in the
 *                 sense `--destructive` owns: mail that was supposed to arrive did not, and
 *                 somebody has to do something about it. Contrast an unreachable relative,
 *                 which is `plain` — nothing went wrong there.
 *   `plain`       nothing to report either way.
 */
export interface DistributionProgress {
  /** One line, for the row and the detail heading. */
  label: string
  tone: 'plain' | 'affirm' | 'withheld' | 'destructive'
  /** True while there is mail still to send. What the client loops on. */
  sending: boolean
  /** Everybody addressed, including the ones nothing was mailed to. */
  addressed: number
  /** Addressed people a message was actually attempted for. */
  mailable: number
}

export function distributionProgress(counts: RecipientCounts): DistributionProgress {
  const addressed = counts.pending + counts.sent + counts.failed
    + counts.duplicate + counts.unreachable + counts.cancelled
  const mailable = counts.pending + counts.sent + counts.failed + counts.cancelled

  // ORDER OF PRECEDENCE, AND IT IS DELIBERATE: in flight beats stopped beats failed beats
  // done. A send with three failures that is still running must report that it is running —
  // an organizer told "3 could not be delivered" about a job with 90 still to go would go
  // and investigate a number that is about to change.
  if (counts.pending > 0) {
    return {
      label: `Sending — ${counts.sent} of ${mailable} delivered`,
      tone: 'withheld',
      sending: true,
      addressed,
      mailable,
    }
  }
  if (counts.cancelled > 0) {
    return {
      label: `Stopped — ${counts.sent} sent, ${counts.cancelled} not sent`,
      tone: 'withheld',
      sending: false,
      addressed,
      mailable,
    }
  }
  if (counts.failed > 0) {
    return {
      label: `${counts.sent} sent, ${counts.failed} could not be delivered`,
      tone: 'destructive',
      sending: false,
      addressed,
      mailable,
    }
  }
  if (mailable === 0) {
    // NOT AN ERROR AND NOT A SUCCESS. An audience that resolved to nobody with a mailbox is
    // a fact about the family — every relative it addressed is on the tree without an
    // address — and saying "Sent" over it would be a claim about zero messages.
    return { label: 'Nobody to send to', tone: 'plain', sending: false, addressed, mailable }
  }
  return {
    label: counts.sent === 1 ? 'Sent to 1 relative' : `Sent to ${counts.sent} relatives`,
    tone: 'affirm',
    sending: false,
    addressed,
    mailable,
  }
}

/**
 * A member's typed message, split into the paragraphs the email chrome renders.
 *
 * ── IT RETURNS PLAIN TEXT, AND THE CALLER ESCAPES IT ───────────────────────────────
 * `EmailOptions.paragraphs` takes HTML, because every other template interpolates a family
 * name or a link into it. This one's input is free text a relative typed into a form, which
 * is then rendered in somebody else's mail client — so it MUST go through `esc()`, and doing
 * that here would make the return value HTML and this module impure in the way that matters
 * (it would have to import the email layer to be correct). The composer does it, one line
 * from here, and `distributionEmail` says so.
 *
 * BLANK LINES SEPARATE PARAGRAPHS, SINGLE NEWLINES DO NOT. That is what somebody typing into
 * a textarea means by pressing Return twice, and treating every newline as a paragraph break
 * turns one wrapped sentence into four one-line paragraphs with air between them.
 */
export function bodyParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.trim().replace(/\n/g, ' '))
    .filter(p => p.length > 0)
}
