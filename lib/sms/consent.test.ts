import { describe, expect, it } from 'vitest'
import {
  consentStatus,
  keywordFor,
  lastFour,
  mayTextPerson,
  smsBlockReason,
  toE164,
  type ConsentRecord,
  type SmsTarget,
} from '@/lib/sms/consent'

/**
 * The SMS consent rules, under `npm test` — a `verify.yml` step, so these gate a pull request.
 *
 * ── WHY THIS FILE MATTERS MORE THAN MOST ───────────────────────────────────────────
 * Every other pure module in `lib/` is wrong in money or in dates. This one is wrong in
 * **$500–$1,500 per message** (FutureFeature.md §5 on US TCPA damages), across a hundred and
 * forty relatives, with no way to take a sent text back. And every one of the mistakes below
 * produces working code:
 *
 *   a `granted` row folded over a STOP        texts somebody who told the carrier to stop
 *   consent honoured without a verified number texts a stranger whose number was mistyped
 *   `keywordFor` matching as a substring       silently unsubscribes somebody asking a question
 *   `toE164` passing through what it cannot
 *     parse, the way `normalizePhone` does     sends to whatever was typed
 *
 * ── CHECKED BY MUTATION, per §7b — AND ONE OF THE CASES WAS VACUOUS ────────────────
 * Measured 2026-08-23, and recorded as MEASURED: the first draft of this comment predicted
 * "3 fail" for four of the five and every one of those predictions was wrong. A targeted case
 * tripping exactly once is the RIGHT shape; a prediction of three was a guess.
 *
 *   1. `consentStatus`'s `if (status !== 'stopped')` guard on `granted` removed   1 fails
 *   2. `start_received` allowed to move from any state, not only `stopped`        1 fails
 *   3. the `id` tie-break dropped from the sort                                   1 fails
 *   4. `smsBlockReason`'s `phoneVerifiedAt` check removed                         1 fails
 *   5. `toE164` returning the raw input instead of `null` on a parse failure      2 fail
 *
 * Mutation 1 is the one to keep in mind: it is a three-word change, every other case stays
 * green, and it is the single most expensive defect available in this module.
 *
 * **AND MUTATION 3 CAUGHT A VACUOUS TEST IN THIS FILE RATHER THAN A DEFECT IN THE MODULE.**
 * The tie-break case originally paired `granted` with `stop_received`, and dropping the
 * tie-break tripped NOTHING — because `Array.prototype.sort` is stable in V8, so both input
 * orders resolve to something the STOP guard then decides identically. The case was asserting
 * the guard a second time under a name about ordering. It is `granted`/`withdrawn` now, which
 * has no guard between the two, and it trips. That is AGENTS.md §7's "a green suite is not
 * evidence until you have seen it fail" catching a test rather than the code — which is the
 * only reason to run these at all.
 */

let seq = 0
/** A log row. Ids ascend with creation order so the tie-break is exercisable. */
const ev = (event: ConsentRecord['event'], occurredAt: string): ConsentRecord =>
  ({ event, occurredAt, id: `e${String(++seq).padStart(4, '0')}` })

const target = (over: Partial<SmsTarget> = {}): SmsTarget => ({
  status: 'granted',
  phoneE164: '+15125550134',
  phoneVerifiedAt: '2026-08-01T00:00:00.000Z',
  ...over,
})

// ── consentStatus ────────────────────────────────────────────────────────────────────

describe('consentStatus', () => {
  it('defaults to none for an empty log — the only correct default', () => {
    expect(consentStatus([])).toBe('none')
  })

  it('takes the last event for the ordinary grant/withdraw cycle', () => {
    expect(consentStatus([
      ev('granted', '2026-08-01T10:00:00Z'),
    ])).toBe('granted')
    expect(consentStatus([
      ev('granted', '2026-08-01T10:00:00Z'),
      ev('withdrawn', '2026-08-02T10:00:00Z'),
    ])).toBe('withdrawn')
    expect(consentStatus([
      ev('granted', '2026-08-01T10:00:00Z'),
      ev('withdrawn', '2026-08-02T10:00:00Z'),
      ev('granted', '2026-08-03T10:00:00Z'),
    ])).toBe('granted')
  })

  it('does not care what order the rows arrive in', () => {
    const a = ev('granted', '2026-08-01T10:00:00Z')
    const b = ev('withdrawn', '2026-08-02T10:00:00Z')
    expect(consentStatus([b, a])).toBe('withdrawn')
    expect(consentStatus([a, b])).toBe('withdrawn')
  })

  it('IGNORES a grant that arrives after a STOP', () => {
    // THE CASE THIS MODULE EXISTS FOR. A carrier-level opt-out is revoked by the handset, never
    // by a checkbox on a website — so a `granted` row written over a STOP by a future admin
    // tool, import or migration must not move the answer.
    expect(consentStatus([
      ev('granted', '2026-08-01T10:00:00Z'),
      ev('stop_received', '2026-08-02T10:00:00Z'),
      ev('granted', '2026-08-03T10:00:00Z'),
    ])).toBe('stopped')
  })

  it('ignores a withdrawal after a STOP too — it is already stronger than one', () => {
    expect(consentStatus([
      ev('stop_received', '2026-08-02T10:00:00Z'),
      ev('withdrawn', '2026-08-03T10:00:00Z'),
    ])).toBe('stopped')
  })

  it('lets START undo a STOP, and back to none rather than to granted', () => {
    // START says "you may talk to me again", not "I opt in". The opt-in is a separate act, and
    // treating the keyword as consent would be inventing one.
    expect(consentStatus([
      ev('granted', '2026-08-01T10:00:00Z'),
      ev('stop_received', '2026-08-02T10:00:00Z'),
      ev('start_received', '2026-08-03T10:00:00Z'),
    ])).toBe('none')
  })

  it('ignores START from any state that is not stopped', () => {
    expect(consentStatus([ev('start_received', '2026-08-01T10:00:00Z')])).toBe('none')
    expect(consentStatus([
      ev('withdrawn', '2026-08-01T10:00:00Z'),
      ev('start_received', '2026-08-02T10:00:00Z'),
    ])).toBe('withdrawn')
  })

  it('re-grants normally after a START', () => {
    expect(consentStatus([
      ev('stop_received', '2026-08-01T10:00:00Z'),
      ev('start_received', '2026-08-02T10:00:00Z'),
      ev('granted', '2026-08-03T10:00:00Z'),
    ])).toBe('granted')
  })

  it('breaks a timestamp tie on the id, so two reads cannot disagree', () => {
    // Same instant, opposite meanings. Without the tie-break the answer depends on the row
    // order the database happened to return — and on this module that is the difference
    // between texting somebody and not.
    //
    // ── THE PAIR HAS TO BE granted/withdrawn, AND THE FIRST DRAFT GOT THIS WRONG ──────
    // It used `granted` and `stop_received`, and that test was VACUOUS: `Array.prototype.sort`
    // is stable in V8, so with the tie-break deleted the two input orders resolve to
    // grant-then-stop and stop-then-grant — and the STOP guard makes BOTH answer 'stopped'.
    // The case passed while testing the guard a second time. Measured by mutation: dropping the
    // tie-break tripped nothing.
    //
    // `granted` versus `withdrawn` has no guard between them, so the last one folded genuinely
    // decides — which is what makes the two input orders disagree without a total order, and
    // agree with one.
    const same = '2026-08-02T10:00:00.000Z'
    const grant = ev('granted', same)
    const withdraw = ev('withdrawn', same)
    // `withdraw` was created second, so its id sorts second and it wins — whichever order the
    // rows arrive in.
    expect(consentStatus([grant, withdraw])).toBe('withdrawn')
    expect(consentStatus([withdraw, grant])).toBe('withdrawn')
  })
})

// ── smsBlockReason / mayTextPerson ───────────────────────────────────────────────────

describe('smsBlockReason', () => {
  it('permits only a granted consent on a confirmed number', () => {
    expect(smsBlockReason(target())).toBeNull()
    expect(mayTextPerson(target())).toBe(true)
  })

  it('refuses a verified number with no consent — the TCPA case', () => {
    expect(smsBlockReason(target({ status: 'none' }))).toBe('no_consent')
    expect(mayTextPerson(target({ status: 'none' }))).toBe(false)
  })

  it('refuses a granted consent on an UNCONFIRMED number — the stranger case', () => {
    // The half a boolean would collapse. Permission belongs to the relative; an unverified
    // number might belong to somebody else entirely.
    expect(smsBlockReason(target({ phoneVerifiedAt: null }))).toBe('unverified')
    expect(mayTextPerson(target({ phoneVerifiedAt: null }))).toBe(false)
  })

  it('refuses with no number at all, and reports the first fixable step', () => {
    expect(smsBlockReason(target({ phoneE164: null, phoneVerifiedAt: null, status: 'none' })))
      .toBe('no_number')
  })

  it('distinguishes withdrawn from stopped, because only one of them is recoverable here',
    () => {
      expect(smsBlockReason(target({ status: 'withdrawn' }))).toBe('withdrawn')
      expect(smsBlockReason(target({ status: 'stopped' }))).toBe('stopped')
    })

  it('reports stopped even with no number on file', () => {
    // `stopped` outranks everything: it is the one state the product may not talk its way out
    // of, and reporting "no mobile number" would invite somebody to add one and send.
    expect(smsBlockReason({ status: 'stopped', phoneE164: null, phoneVerifiedAt: null }))
      .toBe('stopped')
  })
})

// ── toE164 ───────────────────────────────────────────────────────────────────────────

describe('toE164', () => {
  it('maps a 10-digit NANP number, however it was punctuated', () => {
    for (const input of ['5125550134', '512-555-0134', '(512) 555 0134', ' 512.555.0134 ']) {
      expect(toE164(input)).toBe('+15125550134')
    }
  })

  it('accepts a leading 1', () => {
    expect(toE164('1 512 555 0134')).toBe('+15125550134')
    expect(toE164('+1 (512) 555-0134')).toBe('+15125550134')
  })

  it('passes through an international number already in + form', () => {
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958')
  })

  it('REFUSES what it cannot parse, unlike normalizePhone', () => {
    // The one place in the codebase where refusing beats passing through: a sending number that
    // is not quite a number is a text message to somebody else.
    for (const input of ['', '   ', '555-0134', '12345', 'not a phone', '+1', '+123456789012345678']) {
      expect(toE164(input)).toBeNull()
    }
  })
})

describe('lastFour', () => {
  it('shows enough for somebody to recognise their own number', () => {
    expect(lastFour('+15125550134')).toBe('0134')
  })
  it('answers null rather than a masked blank', () => {
    expect(lastFour(null)).toBeNull()
    expect(lastFour('+12')).toBeNull()
  })
})

// ── keywordFor ───────────────────────────────────────────────────────────────────────

describe('keywordFor', () => {
  it('recognises every carrier-mandated opt-out word', () => {
    for (const word of ['STOP', 'stop', ' Stop ', 'STOPALL', 'unsubscribe', 'CANCEL', 'end',
      'quit', 'revoke', 'optout', 'OPT OUT']) {
      expect(keywordFor(word)).toBe('stop_received')
    }
  })

  it('recognises the opt-in words', () => {
    for (const word of ['START', 'unstop', 'YES', 'opt in']) {
      expect(keywordFor(word)).toBe('start_received')
    }
  })

  it('recognises HELP separately, because it changes no consent', () => {
    expect(keywordFor('HELP')).toBe('help')
    expect(keywordFor('info')).toBe('help')
  })

  it('does NOT match a keyword inside a sentence', () => {
    // A relative genuinely might send either of these. Treating them as opt-outs would
    // unsubscribe somebody who was asking a question, which is why carriers specify exact
    // match too.
    expect(keywordFor('Please stop texting my mother about the reunion')).toBeNull()
    expect(keywordFor('I am safe, you can end the check-in')).toBeNull()
  })

  it('answers null for an ordinary reply and for nothing at all', () => {
    expect(keywordFor('SAFE')).toBeNull()
    expect(keywordFor('we are all fine, thank you')).toBeNull()
    expect(keywordFor('')).toBeNull()
    expect(keywordFor('   ')).toBeNull()
  })
})
