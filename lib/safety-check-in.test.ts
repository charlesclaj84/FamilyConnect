import { describe, expect, it } from 'vitest'
import {
  checkInProgress,
  inAudience,
  openedAgo,
  resolveRoster,
  tally,
  type CheckInAudience,
  type CheckInCandidate,
  type RosterRow,
} from '@/lib/safety-check-in'

/**
 * The emergency check-in rules, under `npm test` — a `verify.yml` step, so these gate a pull
 * request.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────────────
 * FutureFeature.md's proposal for this feature turns on one sentence — *"The unanswered column
 * is the product"* — and every way of getting that column wrong is silent:
 *
 *   an audience one conjunct too narrow   asks 4 relatives about a storm 40 are in, and
 *                                         reports "everybody is safe" over the 36 it never
 *                                         addressed.
 *   `unreachable` folded into `awaiting`   makes the number unable to reach zero, so it stops
 *                                         being read, so the relative nobody could contact is
 *                                         never chased.
 *   `needs_help` not sorted first          reports "94 of 141 answered" over a cousin who has
 *                                         said they are trapped.
 *
 * None of the three errors. All three produce a screen that looks finished.
 *
 * And `tests/rls` cannot check any of them. Its fixture is six people in two families, one
 * chapter between them and no relative sharing an address — so an assertion about an audience
 * there exercises one branch and passes while testing nothing, which is the exact failure
 * AGENTS.md §7 warns about.
 *
 * ── CHECKED BY MUTATION, per §7b: "a green run is not evidence until you have seen it fail" ──
 * Seven mutations, each tripping its own cases and no others (2026-08-23):
 *
 *   1. `inAudience` `named` -> `return true`                 5 fail (the audience block)
 *   2. the region conjunct dropped to `person.regionId !== null`
 *                                                            2 fail (regional narrowing)
 *   3. `resolveRoster`'s `emailIsPlaceholder` branch removed  3 fail (skipped/pending split)
 *   4. `tally`'s `row.reach !== 'skipped'` guard on `awaiting`
 *      widened to `else awaiting += 1`                        4 fail (the whole point)
 *   5. `checkInProgress`'s `needsHelp` branch moved BELOW the
 *      `sending` branch                                       2 fail (precedence)
 *   6. the `unreachable > 0` branch deleted from
 *      `checkInProgress`                                      2 fail ("everybody is safe" lie)
 *   7. `openedAgo`'s `minutes < 1` guard removed              1 fails ("0 minutes ago")
 *
 * Mutation 4 is the one to keep in mind: it is a one-word change, it makes every count still
 * sum to `addressed`, and it is the defect this whole file is built around.
 */

// ── The roster this file reasons about ────────────────────────────────────────────────
//
// SIX PEOPLE ACROSS TWO REGIONS, WITH THE THREE EDGES THAT MATTER: a relative in no chapter at
// all (so in no region), a recorded relative with a generated address, and a relative with no
// address column at all. Those three are exactly what the RLS fixture cannot express.

const gulf: CheckInCandidate = {
  personId: 'p-gulf', firstName: 'Ada', lastName: 'Okonkwo',
  email: 'ada@example.test', emailIsPlaceholder: false,
  chapterId: 'c-houston', regionId: 'r-gulf',
}
const gulf2: CheckInCandidate = {
  personId: 'p-gulf-2', firstName: 'Ben', lastName: 'Okonkwo',
  // SHARES ADA'S MAILBOX, deliberately. A distribution would file the second one as
  // `duplicate`; a check-in must ask them both.
  email: 'ada@example.test', emailIsPlaceholder: false,
  chapterId: 'c-houston', regionId: 'r-gulf',
}
const galveston: CheckInCandidate = {
  personId: 'p-galv', firstName: 'Cora', lastName: 'Diaz',
  email: 'cora@example.test', emailIsPlaceholder: false,
  chapterId: 'c-galveston', regionId: 'r-gulf',
}
const denver: CheckInCandidate = {
  personId: 'p-denver', firstName: 'Dele', lastName: 'Okonkwo',
  email: 'dele@example.test', emailIsPlaceholder: false,
  chapterId: 'c-denver', regionId: 'r-mountain',
}
/** In no chapter, therefore in NO REGION. The relative a regional audience does not reach. */
const unfiled: CheckInCandidate = {
  personId: 'p-unfiled', firstName: 'Esi', lastName: 'Mensah',
  email: 'esi@example.test', emailIsPlaceholder: false,
  chapterId: null, regionId: null,
}
/** A recorded grandmother: on the tree, in the Directory, with a generated address. */
const grandmother: CheckInCandidate = {
  personId: 'p-gran', firstName: 'Florence', lastName: 'Okonkwo',
  email: 'florence.okonkwo.a1b2@genorra.com', emailIsPlaceholder: true,
  chapterId: 'c-houston', regionId: 'r-gulf',
}

const ROSTER = [gulf, gulf2, galveston, denver, unfiled, grandmother]

const family: CheckInAudience = { scope: 'family', regionId: null, chapterId: null, personIds: [] }
const gulfRegion: CheckInAudience = {
  scope: 'region', regionId: 'r-gulf', chapterId: null, personIds: [],
}
const houston: CheckInAudience = {
  scope: 'chapter', regionId: null, chapterId: 'c-houston', personIds: [],
}
const named = (...ids: string[]): CheckInAudience => ({
  scope: 'named', regionId: null, chapterId: null, personIds: ids,
})

// ── inAudience ───────────────────────────────────────────────────────────────────────

describe('inAudience', () => {
  it('addresses everybody for a family-wide check-in, including the unfiled relative', () => {
    for (const person of ROSTER) expect(inAudience(person, family)).toBe(true)
  })

  it('narrows a region to that region, and does NOT reach a relative in no chapter', () => {
    // The announcement rule inverted, which is FutureFeature.md's "one defect it must not
    // inherit". `addressedTo` would return true for all six here.
    expect(inAudience(gulf, gulfRegion)).toBe(true)
    expect(inAudience(galveston, gulfRegion)).toBe(true)
    expect(inAudience(denver, gulfRegion)).toBe(false)
    expect(inAudience(unfiled, gulfRegion)).toBe(false)
  })

  it('narrows a chapter to that chapter', () => {
    expect(inAudience(gulf, houston)).toBe(true)
    expect(inAudience(galveston, houston)).toBe(false)
  })

  it('addresses nobody when an area scope names no area', () => {
    // The floor under `raiseCheckIn`'s refusal and the table's CHECK. Widening a misconfigured
    // audience to the whole family is what wakes a hundred and forty relatives at 3 a.m.
    const noRegion: CheckInAudience = {
      scope: 'region', regionId: null, chapterId: null, personIds: [],
    }
    const noChapter: CheckInAudience = {
      scope: 'chapter', regionId: null, chapterId: null, personIds: [],
    }
    for (const person of ROSTER) {
      expect(inAudience(person, noRegion)).toBe(false)
      expect(inAudience(person, noChapter)).toBe(false)
    }
  })

  it('addresses exactly the people a named audience lists', () => {
    // The audience an area cannot express: the cousin who MOVED, plus one who did not.
    const audience = named('p-denver', 'p-unfiled')
    expect(inAudience(denver, audience)).toBe(true)
    expect(inAudience(unfiled, audience)).toBe(true)
    expect(inAudience(gulf, audience)).toBe(false)
    expect(inAudience(grandmother, audience)).toBe(false)
  })

  it('addresses nobody for a named audience with an empty list', () => {
    for (const person of ROSTER) expect(inAudience(person, named())).toBe(false)
  })
})

// ── resolveRoster ────────────────────────────────────────────────────────────────────

describe('resolveRoster', () => {
  it('gives every addressed relative a row, and counts the rest as not addressed', () => {
    const { members, notAddressed } = resolveRoster(ROSTER, gulfRegion)
    // Ada, Ben, Cora and Florence are in the Gulf region. Dele and Esi are not.
    expect(members.map(m => m.personId).sort()).toEqual(
      ['p-galv', 'p-gran', 'p-gulf', 'p-gulf-2'],
    )
    expect(notAddressed).toBe(2)
  })

  it('marks a generated address as skipped and a real one as pending', () => {
    const { members } = resolveRoster(ROSTER, family)
    const byId = new Map(members.map(m => [m.personId, m]))
    // The recorded grandmother: there is no mailbox, so nothing is queued for her. Filed as
    // `failed` she would sit forever in the column somebody works through.
    expect(byId.get('p-gran')?.reach).toBe('skipped')
    expect(byId.get('p-gulf')?.reach).toBe('pending')
  })

  it('treats a missing address the same as a generated one', () => {
    const addressless: CheckInCandidate = { ...denver, personId: 'p-none', email: null }
    const { members } = resolveRoster([addressless], family)
    expect(members[0].reach).toBe('skipped')
    expect(members[0].email).toBeNull()
  })

  it('asks BOTH relatives who share a mailbox — this is not a distribution', () => {
    // The one place this module deliberately diverges from `resolveRecipients`. Suppressing the
    // second ask would leave somebody in the unanswered column having never been asked.
    const { members } = resolveRoster([gulf, gulf2], family)
    expect(members).toHaveLength(2)
    expect(members.every(m => m.reach === 'pending')).toBe(true)
    expect(new Set(members.map(m => m.email))).toEqual(new Set(['ada@example.test']))
  })

  it('snapshots the address rather than leaving it to be joined later', () => {
    const { members } = resolveRoster([gulf], family)
    expect(members[0].email).toBe('ada@example.test')
  })

  it('orders the roster totally, so two resolutions cannot disagree', () => {
    const forward = resolveRoster(ROSTER, family).members.map(m => m.personId)
    const reversed = resolveRoster([...ROSTER].reverse(), family).members.map(m => m.personId)
    expect(reversed).toEqual(forward)
  })

  it('falls back to a name rather than rendering a blank row', () => {
    const nameless: CheckInCandidate = {
      ...gulf, personId: 'p-blank', firstName: '', lastName: '',
    }
    expect(resolveRoster([nameless], family).members[0].name).toBe('ada@example.test')
    const nothing: CheckInCandidate = { ...nameless, email: null }
    expect(resolveRoster([nothing], family).members[0].name).toBe('Unnamed relative')
  })
})

// ── tally ────────────────────────────────────────────────────────────────────────────

const row = (over: Partial<RosterRow>): RosterRow => ({
  personId: 'x', name: 'X', state: 'awaiting', reach: 'sent',
  note: null, respondedAt: null, ...over,
})

describe('tally', () => {
  it('keeps an unreachable relative OUT of the awaiting column', () => {
    // THE CASE THIS WHOLE FILE IS FOR. Mutation 4 — widening the `awaiting` branch to a bare
    // `else` — leaves every figure still summing to `addressed` and makes the one number this
    // feature exists to drive to zero unable to reach zero.
    const t = tally([
      row({ state: 'safe' }),
      row({ state: 'awaiting' }),
      row({ state: 'awaiting', reach: 'skipped' }),
    ])
    expect(t.addressed).toBe(3)
    expect(t.safe).toBe(1)
    expect(t.awaiting).toBe(1)
    expect(t.unreachable).toBe(1)
  })

  it('counts a failed delivery as undelivered but still awaiting an answer', () => {
    // A real address that bounced is ACTIONABLE — somebody should fix it — and the person is
    // still owed an answer. So it is in both columns, which is why `undelivered` overlaps
    // rather than partitioning.
    const t = tally([row({ reach: 'failed' })])
    expect(t.awaiting).toBe(1)
    expect(t.undelivered).toBe(1)
    expect(t.unreachable).toBe(0)
  })

  it('counts both kinds of unreached message in undelivered', () => {
    const t = tally([row({ reach: 'failed' }), row({ reach: 'skipped' })])
    expect(t.undelivered).toBe(2)
    expect(t.unreachable).toBe(1)
  })

  it('counts rows still queued for a first attempt', () => {
    const t = tally([row({ reach: 'pending' }), row({ reach: 'sent' })])
    expect(t.queued).toBe(1)
  })

  it('partitions the four response columns exactly', () => {
    const t = tally([
      row({ state: 'safe' }), row({ state: 'safe' }),
      row({ state: 'needs_help' }),
      row({ state: 'awaiting' }),
      row({ state: 'awaiting', reach: 'skipped' }),
    ])
    expect(t.safe + t.needsHelp + t.awaiting + t.unreachable).toBe(t.addressed)
  })

  it('answers zero for an empty roster rather than throwing', () => {
    expect(tally([])).toEqual({
      addressed: 0, safe: 0, needsHelp: 0, awaiting: 0,
      unreachable: 0, undelivered: 0, queued: 0,
    })
  })
})

// ── checkInProgress ──────────────────────────────────────────────────────────────────

describe('checkInProgress', () => {
  it('reports somebody needing help above everything else', () => {
    // PRECEDENCE IS THE ASSERTION. Ninety relatives still to contact and one who has said they
    // need help: the screen must lead with the person, not with the queue.
    const t = tally([
      row({ state: 'needs_help' }),
      ...Array.from({ length: 90 }, () => row({ reach: 'pending' })),
    ])
    const p = checkInProgress(t, 'open')
    expect(p.tone).toBe('urgent')
    expect(p.label).toBe('1 relative needs help')
    // ...and it still reports that mail is going, because the client loops on this.
    expect(p.sending).toBe(true)
  })

  it('reports progress while messages are still going out', () => {
    const t = tally([row({ reach: 'sent' }), row({ reach: 'pending' })])
    const p = checkInProgress(t, 'open')
    expect(p.tone).toBe('withheld')
    expect(p.sending).toBe(true)
    expect(p.label).toBe('Asking — 1 of 2 contacted')
  })

  it('reports the number still to answer once the asking is done', () => {
    const t = tally([row({ state: 'safe' }), row({ state: 'awaiting' })])
    const p = checkInProgress(t, 'open')
    expect(p.tone).toBe('withheld')
    expect(p.sending).toBe(false)
    expect(p.label).toBe('1 relative has not answered yet')
  })

  it('never says everybody is safe while somebody could not be contacted', () => {
    // THE MOST DANGEROUS SENTENCE THIS FEATURE COULD PRINT, and mutation 6 prints it.
    const t = tally([row({ state: 'safe' }), row({ state: 'awaiting', reach: 'skipped' })])
    const p = checkInProgress(t, 'open')
    expect(p.tone).toBe('withheld')
    expect(p.label).toBe('Everyone reached is safe — 1 relative could not be contacted')
  })

  it('affirms only when every addressed relative answered safe', () => {
    const t = tally([row({ state: 'safe' }), row({ state: 'safe' })])
    expect(checkInProgress(t, 'open')).toEqual({
      label: 'Everybody is safe', tone: 'affirm', sending: false,
    })
    expect(checkInProgress(t, 'closed').label).toBe('Closed — everybody was safe')
  })

  it('says nobody was addressed rather than claiming everybody is safe', () => {
    const p = checkInProgress(tally([]), 'open')
    expect(p.tone).toBe('plain')
    expect(p.label).toBe('Nobody was addressed')
  })

  it('pluralises both counted labels', () => {
    expect(checkInProgress(tally([row({ state: 'needs_help' }), row({ state: 'needs_help' })]),
      'open').label).toBe('2 relatives need help')
    expect(checkInProgress(tally([row({}), row({})]), 'open').label)
      .toBe('2 relatives have not answered yet')
  })
})

// ── openedAgo ────────────────────────────────────────────────────────────────────────

describe('openedAgo', () => {
  const now = new Date('2026-08-23T18:00:00.000Z')

  it('says "just now" rather than "0 minutes ago"', () => {
    expect(openedAgo('2026-08-23T17:59:30.000Z', now)).toBe('just now')
  })

  it('counts minutes, hours and days, and pluralises each', () => {
    expect(openedAgo('2026-08-23T17:59:00.000Z', now)).toBe('1 minute ago')
    expect(openedAgo('2026-08-23T17:20:00.000Z', now)).toBe('40 minutes ago')
    expect(openedAgo('2026-08-23T17:00:00.000Z', now)).toBe('1 hour ago')
    expect(openedAgo('2026-08-23T09:00:00.000Z', now)).toBe('9 hours ago')
    expect(openedAgo('2026-08-22T18:00:00.000Z', now)).toBe('1 day ago')
    expect(openedAgo('2026-08-20T18:00:00.000Z', now)).toBe('3 days ago')
  })

  it('degrades to "just now" for an unparseable timestamp rather than NaN', () => {
    expect(openedAgo('not a date', now)).toBe('just now')
  })
})
