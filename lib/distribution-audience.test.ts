import { describe, expect, it } from 'vitest'
import {
  bodyParagraphs,
  countStates,
  distributionProgress,
  inAudience,
  normalizeAddress,
  resolveRecipients,
  type AudienceCandidate,
  type DistributionAudience,
  type RecipientCounts,
} from '@/lib/distribution-audience'

/**
 * The distribution audience rules, under `npm test` — a `verify.yml` step, so these gate a
 * pull request.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────
 * `/pricing` sells this feature as *"Distributions that draw straight from your membership, so
 * nobody is missed and nobody is on it twice."* Both halves of that sentence are assertions
 * about a computation, and both fail silently in the expensive direction:
 *
 *   "nobody is missed"       a filter that is one conjunct too narrow does not error. It
 *                            mails 38 relatives out of 141 and reports success.
 *   "nobody is on it twice"  a dedupe that is keyed wrongly sends the same message to the
 *                            same mailbox twice, which is the thing a family notices and the
 *                            product cannot take back.
 *
 * And `tests/rls` cannot check either. Its fixture is six people in two families with no
 * chapters and no shared addresses, so every one of the cases below would exercise nothing
 * there and pass — the "green suite is not evidence" failure AGENTS.md §7 warns about, in the
 * exact shape §7b exists to catch.
 *
 * ── CHECKED BY MUTATION, as §7b requires ────────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Eleven mutations, each tripping
 * its own cases and, where noted, only its own (2026-08-22):
 *
 *   1.  `inAudience` region branch -> `return true`                        5 failed
 *   2.  `inAudience` region branch drops the `regionId !== null` guard     1 failed
 *   3.  `inAudience` chapter branch -> `return true`                       2 failed
 *   4.  `normalizeAddress` stops lower-casing                             2 failed
 *   5.  `normalizeAddress` also strips `+tag`                             1 failed
 *   6.  the `emailIsPlaceholder` branch removed                           2 failed
 *   7.  the placeholder branch moved BELOW the dedupe branch              1 failed
 *   8.  `rosterOrder` returns 0 always (dedupe becomes input-order)       1 failed
 *   9.  `distributionProgress` checks `failed` before `pending`           1 failed
 *   10. `distributionProgress` `mailable` counts `unreachable` too        2 failed
 *   11. `bodyParagraphs` splits on `\n` rather than `\n{2,}`              1 failed
 *
 * FOUR OF THE ELEVEN TRIP EXACTLY ONE CASE, and that is worth reading as a property of the
 * suite rather than as thin coverage: each of those four is a rule with one witness, written
 * because the rule has no other observable consequence. Mutation 7 is the sharpest — it is
 * the only mutation here that changes no count and no total, and it silently decides WHICH of
 * two relatives sharing a mailbox is the one who gets the mail. Mutation 8 is the same defect
 * arriving through the sort. Before deleting a case that looks redundant, check which mutation
 * it is the only witness for.
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────────────
//
// Named rather than generated, because every one of them is a case: the shared mailbox, the
// recorded grandmother, the member in no chapter. A `makePerson(i)` loop would make the file
// shorter and would stop saying what each row is for.

const TEXAS = 'region-texas'
const EAST = 'region-east'
const AUSTIN = 'chapter-austin'
const HOUSTON = 'chapter-houston'
const BOSTON = 'chapter-boston'

function person(over: Partial<AudienceCandidate> & { personId: string }): AudienceCandidate {
  return {
    firstName: 'A',
    lastName: 'Person',
    email: `${over.personId}@example.com`,
    emailIsPlaceholder: false,
    chapterId: null,
    regionId: null,
    ...over,
  }
}

/** Two in Austin, one in Houston (same region), one in Boston, one National. */
const ROSTER: AudienceCandidate[] = [
  person({ personId: 'p1', firstName: 'Ada', lastName: 'Allen', chapterId: AUSTIN, regionId: TEXAS }),
  person({ personId: 'p2', firstName: 'Ben', lastName: 'Brook', chapterId: AUSTIN, regionId: TEXAS }),
  person({ personId: 'p3', firstName: 'Cal', lastName: 'Croft', chapterId: HOUSTON, regionId: TEXAS }),
  person({ personId: 'p4', firstName: 'Dot', lastName: 'Dunne', chapterId: BOSTON, regionId: EAST }),
  // NO CHAPTER, therefore NO REGION. This is the row the announcement rule would have mailed
  // on a regional send and this one does not — the defect FutureFeature.md says not to inherit.
  person({ personId: 'p5', firstName: 'Eve', lastName: 'Ellis' }),
]

const FAMILY: DistributionAudience = { scope: 'family', regionId: null, chapterId: null }

function counts(over: Partial<RecipientCounts>): RecipientCounts {
  return { pending: 0, sent: 0, failed: 0, duplicate: 0, unreachable: 0, cancelled: 0, ...over }
}

// ── inAudience ────────────────────────────────────────────────────────────────────────

describe('inAudience', () => {
  it('addresses the whole roster on a family distribution', () => {
    expect(ROSTER.filter(p => inAudience(p, FAMILY)).map(p => p.personId))
      .toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
  })

  it('narrows a region distribution to that region, and not to the family', () => {
    // THE CASE THIS FEATURE WAS WRITTEN AROUND. `addressedTo` would return every one of the
    // five here, because a regional announcement reaches everybody by design. Mail must not.
    const audience: DistributionAudience = { scope: 'region', regionId: TEXAS, chapterId: null }
    expect(ROSTER.filter(p => inAudience(p, audience)).map(p => p.personId))
      .toEqual(['p1', 'p2', 'p3'])
  })

  it('leaves a member with no chapter out of every region distribution', () => {
    // Correct rather than convenient: they have not told the family where they are. It is
    // asserted on its own because it is the case that reads as a bug on the screen, which is
    // why `resolveRecipients` reports the excluded count for the screen to print.
    const texas: DistributionAudience = { scope: 'region', regionId: TEXAS, chapterId: null }
    const east: DistributionAudience = { scope: 'region', regionId: EAST, chapterId: null }
    const eve = ROSTER.find(p => p.personId === 'p5')!
    expect(inAudience(eve, texas)).toBe(false)
    expect(inAudience(eve, east)).toBe(false)
  })

  it('narrows a chapter distribution to that chapter', () => {
    const audience: DistributionAudience = { scope: 'chapter', regionId: null, chapterId: AUSTIN }
    expect(ROSTER.filter(p => inAudience(p, audience)).map(p => p.personId))
      .toEqual(['p1', 'p2'])
  })

  it('addresses nobody when an area scope names no area', () => {
    // THE OPPOSITE OF THE ANNOUNCEMENT RULE, deliberately. There, an empty picker widens to
    // family-wide; here that would be a mail cannon. `sendDistribution` refuses such an
    // audience outright and this is the floor underneath it — so if that check is ever
    // removed the failure is zero messages rather than a hundred and forty.
    const region: DistributionAudience = { scope: 'region', regionId: null, chapterId: null }
    const chapter: DistributionAudience = { scope: 'chapter', regionId: null, chapterId: null }
    expect(ROSTER.filter(p => inAudience(p, region))).toHaveLength(0)
    expect(ROSTER.filter(p => inAudience(p, chapter))).toHaveLength(0)
  })

  it('ignores a chapter id on a region scope, and the reverse', () => {
    // The two fields are set together by the form and only one is ever read. Pinned because a
    // future "and also these chapters" feature would be tempted to read both.
    const region: DistributionAudience = { scope: 'region', regionId: EAST, chapterId: AUSTIN }
    expect(ROSTER.filter(p => inAudience(p, region)).map(p => p.personId)).toEqual(['p4'])
  })
})

// ── normalizeAddress ──────────────────────────────────────────────────────────────────

describe('normalizeAddress', () => {
  it('folds case and trims, because a mailbox does', () => {
    expect(normalizeAddress('  Ada.Allen@Example.COM ')).toBe('ada.allen@example.com')
  })

  it('does NOT strip a plus tag or a dot', () => {
    // Both are Gmail rules and neither is universal. Applying them generally would decline to
    // mail somebody at an address that is genuinely theirs — "nobody is missed" broken by the
    // code that exists to keep the other half of the sentence true.
    expect(normalizeAddress('ada+family@example.com'))
      .not.toBe(normalizeAddress('ada@example.com'))
    expect(normalizeAddress('a.da@example.com'))
      .not.toBe(normalizeAddress('ada@example.com'))
  })
})

// ── resolveRecipients ─────────────────────────────────────────────────────────────────

describe('resolveRecipients', () => {
  it('gives every addressed relative a row, in surname order', () => {
    const { recipients, notAddressed } = resolveRecipients(ROSTER, FAMILY)
    expect(recipients.map(r => r.personId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(recipients.every(r => r.state === 'pending')).toBe(true)
    expect(notAddressed).toBe(0)
  })

  it('counts the relatives an area scope did not address', () => {
    // The number the screen prints beside the audience. Without it, "3 addressed" on a family
    // of five is unverifiable by the person who chose the audience.
    const audience: DistributionAudience = { scope: 'region', regionId: TEXAS, chapterId: null }
    const { recipients, notAddressed } = resolveRecipients(ROSTER, audience)
    expect(recipients).toHaveLength(3)
    expect(notAddressed).toBe(2)
  })

  it('mails a shared mailbox once and still records both relatives', () => {
    // "nobody is on it twice", and the other half of it: the couple is still two people, so
    // the addressed count must not quietly become one.
    const shared = [
      person({ personId: 'p1', firstName: 'Ada', lastName: 'Allen', email: 'household@example.com' }),
      person({ personId: 'p2', firstName: 'Ben', lastName: 'Allen', email: 'HOUSEHOLD@example.com' }),
    ]
    const { recipients } = resolveRecipients(shared, FAMILY)
    expect(recipients).toHaveLength(2)
    expect(recipients.filter(r => r.state === 'pending')).toHaveLength(1)
    expect(recipients.filter(r => r.state === 'duplicate')).toHaveLength(1)
    // Ada sorts before Ben, so Ada is the one on the mail — every time. See the next case.
    expect(recipients.find(r => r.state === 'pending')!.personId).toBe('p1')
  })

  it('picks the same relative off a shared mailbox however the roster arrives', () => {
    // MUTATION 8's case. Dedupe on input order means a retry, or a second read of the same
    // roster in a different order, silently reassigns who gets the message — and nothing
    // anywhere reports it, because the counts are identical.
    const a = person({ personId: 'p1', firstName: 'Ada', lastName: 'Allen', email: 'h@example.com' })
    const b = person({ personId: 'p2', firstName: 'Ben', lastName: 'Allen', email: 'h@example.com' })
    const forwards = resolveRecipients([a, b], FAMILY)
    const backwards = resolveRecipients([b, a], FAMILY)
    expect(forwards.recipients.find(r => r.state === 'pending')!.personId).toBe('p1')
    expect(backwards.recipients.find(r => r.state === 'pending')!.personId).toBe('p1')
  })

  it('marks a placeholder address unreachable rather than pending or failed', () => {
    // A recorded grandmother. `placeholderEmail` builds these on @genorra.com — a REAL domain,
    // so `sendEmail`'s reserved-TLD guard does not catch them and mailing one is a hard bounce
    // against our own sending reputation. This is the check `lib/family-tree.ts` says every
    // sender owes.
    const roster = [
      person({ personId: 'p1', firstName: 'Ada', lastName: 'Allen' }),
      person({
        personId: 'p2',
        firstName: 'Gran',
        lastName: 'Bell',
        email: 'alpha_gran_bell_abcd1234@genorra.com',
        emailIsPlaceholder: true,
      }),
    ]
    const { recipients } = resolveRecipients(roster, FAMILY)
    const gran = recipients.find(r => r.personId === 'p2')!
    expect(gran.state).toBe('unreachable')
    expect(gran.note).toBe('No email address on file')
    expect(recipients.filter(r => r.state === 'pending').map(r => r.personId)).toEqual(['p1'])
  })

  it('treats placeholder and duplicate independently of the order they are checked in', () => {
    // MUTATION 7's case, and the only one it trips. A placeholder that also happened to
    // collide must come out `unreachable` — it has no mailbox, which is a stronger fact than
    // somebody else having the same one — and swapping the two branches inverts that.
    const roster = [
      person({ personId: 'p1', firstName: 'Ada', lastName: 'Allen', email: 'dup@genorra.com' }),
      person({
        personId: 'p2', firstName: 'Ben', lastName: 'Brook',
        email: 'DUP@genorra.com', emailIsPlaceholder: true,
      }),
    ]
    const { recipients } = resolveRecipients(roster, FAMILY)
    expect(recipients.find(r => r.personId === 'p2')!.state).toBe('unreachable')
  })

  it('does not make a recipient of somebody with no address, and counts them', () => {
    const roster = [
      person({ personId: 'p1', firstName: 'Ada', lastName: 'Allen' }),
      person({ personId: 'p2', firstName: 'Nil', lastName: 'Blank', email: null }),
      person({ personId: 'p3', firstName: 'Sp', lastName: 'Ace', email: '   ' }),
    ]
    const { recipients, notAddressed } = resolveRecipients(roster, FAMILY)
    expect(recipients.map(r => r.personId)).toEqual(['p1'])
    expect(notAddressed).toBe(2)
  })

  it('copies the address rather than pointing at the person', () => {
    // The record has to say where the mail actually went — the same decision a gathering task
    // makes about its label. Asserted by value so a future "join it at render time" refactor
    // has something to break.
    const { recipients } = resolveRecipients(
      [person({ personId: 'p1', firstName: 'Ada', lastName: 'Allen', email: 'Ada@Example.com' })],
      FAMILY,
    )
    expect(recipients[0].email).toBe('Ada@Example.com')
  })

  it('falls back to the address when a person has no name', () => {
    const { recipients } = resolveRecipients(
      [person({ personId: 'p1', firstName: '', lastName: '', email: 'x@example.com' })],
      FAMILY,
    )
    expect(recipients[0].name).toBe('x@example.com')
  })

  it('answers an empty roster with an empty audience rather than throwing', () => {
    expect(resolveRecipients([], FAMILY)).toEqual({ recipients: [], notAddressed: 0 })
  })
})

// ── countStates ───────────────────────────────────────────────────────────────────────

describe('countStates', () => {
  it('reports a zero for a state nothing is in', () => {
    // Exhaustive keys, so `counts.failed` is 0 rather than undefined — which is what lets the
    // progress arithmetic add them without a coalesce at every term.
    expect(countStates(['sent', 'sent', 'pending'])).toEqual(
      counts({ sent: 2, pending: 1 }),
    )
  })

  it('ignores a state it does not recognise', () => {
    // The column is a CHECK-constrained text, so this cannot arrive from the database — but it
    // can arrive from a migration adding a seventh state before this module knows about it, and
    // dropping it is better than an undefined in a total.
    expect(countStates(['sent', 'quantum'])).toEqual(counts({ sent: 1 }))
  })
})

// ── distributionProgress ──────────────────────────────────────────────────────────────

describe('distributionProgress', () => {
  it('reports in flight while anything is pending, even with failures', () => {
    // MUTATION 9. An organizer told "3 could not be delivered" about a job with 90 to go
    // investigates a number that is about to change.
    const p = distributionProgress(counts({ pending: 90, sent: 7, failed: 3 }))
    expect(p.sending).toBe(true)
    expect(p.tone).toBe('withheld')
    expect(p.label).toBe('Sending — 7 of 100 delivered')
  })

  it('affirms a clean send', () => {
    const p = distributionProgress(counts({ sent: 12 }))
    expect(p).toMatchObject({ sending: false, tone: 'affirm', label: 'Sent to 12 relatives' })
  })

  it('says "1 relative" rather than "1 relatives"', () => {
    expect(distributionProgress(counts({ sent: 1 })).label).toBe('Sent to 1 relative')
  })

  it('reports a failure as destructive once nothing is pending', () => {
    // The one `--destructive` in this feature: mail that was meant to arrive did not.
    const p = distributionProgress(counts({ sent: 8, failed: 2 }))
    expect(p).toMatchObject({ sending: false, tone: 'destructive' })
    expect(p.label).toBe('8 sent, 2 could not be delivered')
  })

  it('reports a stopped send as withheld, not as a failure', () => {
    // Somebody pressed Stop. Nothing went wrong, so this is not an error — the same reading
    // the dues ladder takes of an unpaid installment.
    const p = distributionProgress(counts({ sent: 4, cancelled: 20 }))
    expect(p).toMatchObject({ sending: false, tone: 'withheld' })
    expect(p.label).toBe('Stopped — 4 sent, 20 not sent')
  })

  it('does not count an unreachable relative as somebody mail was attempted for', () => {
    // MUTATION 10, and the sharpest of them. Six addressed, four with a mailbox: reporting
    // "4 of 6 delivered" on a finished send would leave two names looking undelivered forever,
    // which is the column an organizer works through and can never empty.
    const p = distributionProgress(counts({ sent: 4, unreachable: 2 }))
    expect(p.addressed).toBe(6)
    expect(p.mailable).toBe(4)
    expect(p.tone).toBe('affirm')
    expect(p.label).toBe('Sent to 4 relatives')
  })

  it('counts a duplicate as addressed but not as mailable', () => {
    const p = distributionProgress(counts({ sent: 3, duplicate: 1 }))
    expect(p.addressed).toBe(4)
    expect(p.mailable).toBe(3)
  })

  it('says nobody rather than sent when no addressed relative had a mailbox', () => {
    // Not an error and not a success. "Sent" over zero messages is the lie this branch exists
    // to refuse.
    const p = distributionProgress(counts({ unreachable: 3 }))
    expect(p).toMatchObject({ tone: 'plain', sending: false, label: 'Nobody to send to' })
    expect(p.addressed).toBe(3)
  })

  it('says nobody for an audience that resolved to nothing at all', () => {
    expect(distributionProgress(counts({})).label).toBe('Nobody to send to')
  })
})

// ── bodyParagraphs ────────────────────────────────────────────────────────────────────

describe('bodyParagraphs', () => {
  it('splits on blank lines and joins wrapped lines', () => {
    // MUTATION 11. Splitting on every newline turns one wrapped sentence into four one-line
    // paragraphs with air between them, in somebody else's mail client.
    expect(bodyParagraphs('The reunion is\non the 4th.\n\nBring a dish.'))
      .toEqual(['The reunion is on the 4th.', 'Bring a dish.'])
  })

  it('handles CRLF, because a Windows browser sends it', () => {
    expect(bodyParagraphs('One.\r\n\r\nTwo.')).toEqual(['One.', 'Two.'])
  })

  it('collapses runs of blank lines rather than emitting empty paragraphs', () => {
    expect(bodyParagraphs('One.\n\n\n\nTwo.')).toEqual(['One.', 'Two.'])
  })

  it('answers an empty list for a blank message', () => {
    // What stops an empty distribution rendering the chrome with no content in it. The action
    // refuses a blank body as well; this is the floor.
    expect(bodyParagraphs('   \n\n  ')).toEqual([])
  })
})
