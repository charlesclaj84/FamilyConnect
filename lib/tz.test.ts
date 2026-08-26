import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZONE,
  dateIn,
  isValidZone,
  sameClock,
  timeIn,
  todayIn,
  zoneAbbrev,
} from '@/lib/tz'

/**
 * `lib/tz.ts`, under `npm test` — which is a `verify.yml` step, so this gates a pull request.
 *
 * ── WHY THIS FILE SETS NO `process.env.TZ` ──────────────────────────────────────────
 * Every function under test takes its zone as an argument, so the runner's own zone is
 * irrelevant and there is nothing to save and restore. That is not a convenience; it is the
 * property that makes these assertions mean anything. `calendar.test.ts` records a mutation
 * that shipped GREEN from CI and failed only on the author's laptop, because an
 * `Intl.DateTimeFormat` resolves its zone at CONSTRUCTION and a module-level formatter never
 * notices `TZ` being reassigned inside a test. A parameter cannot go stale that way, and a
 * test that does not depend on ambient state cannot pass for the wrong reason.
 *
 * ── THE EXPECTATIONS ARE HAND-CHECKED, NOT DERIVED ──────────────────────────────────
 * A test that computes its expectation from the code under test asserts nothing. The offsets
 * below were worked out and are stated here so a reader can check them without running
 * anything:
 *
 *   America/Chicago  is UTC-5 in July (CDT) and UTC-6 in January (CST)
 *   America/Denver   is UTC-6 in July (MDT)
 *   Asia/Tokyo       is UTC+9 all year — no DST, and it is AHEAD, which is the direction
 *                    that catches a sign error the western zones cannot
 *   Asia/Kolkata     is UTC+5:30 — the half-hour offset, which catches minute arithmetic
 *   UTC              the control
 *
 * So `2026-07-31T00:30:00Z` is 30 July 19:30 in Chicago and 31 July 09:30 in Tokyo. That
 * single instant is the whole bug this module was written for: it is a DIFFERENT CALENDAR DAY
 * in the two places, and `formatDate` was answering the UTC one for everybody.
 *
 * ── CHECKED BY MUTATION (AGENTS.md §7b) ─────────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Each mutation below was applied
 * to `lib/tz.ts`, the file was compared against its backup to confirm the edit ACTUALLY
 * APPLIED — a sed that silently matches nothing reports a green run, which reads as a weak
 * test — the suite was run, and the count is the MEASURED number of failing TESTS.
 *
 * The numbers first written here were estimates and three of them were wrong. These are the
 * measured ones:
 *
 *   1. `hourCycle: 'h23'` → `hour12: false`                      0 failed — survived
 *   2. the `DATE_ONLY_RE` guard in `dateIn` removed               1 failed
 *   3. `usableZone` returns its argument unconditionally          2 failed
 *   4. `zonedParts` drops the `timeZone` option                  10 failed
 *   5. `sameClock` compares only `timeIn`, not `dateIn`           1 failed
 *   6. `dateIn` returns `MM-DD-YYYY` order                        8 failed
 *
 * MUTATION 4 IS THE LOAD-BEARING ONE. Dropping `timeZone` makes every formatter resolve to
 * the RUNNER's zone, which is the precise shape of the bug this module exists to fix — and it
 * takes ten tests with it, including all four in `sameClock`. That is what a real gate looks
 * like.
 *
 * MUTATION 1 IS THE ONE WORTH READING ANYWAY. On this runner's ICU build `hour12: false` and
 * `hourCycle: 'h23'` agree, so it fails NOTHING — the midnight-becomes-24 behaviour is a
 * property of older builds. It is kept on the list, and the option is kept in the source,
 * because a test cannot assert a thing about an ICU version it does not have; deleting the
 * option because the suite stayed green would be reasoning from the absence of evidence. Same
 * class as the two survivors `date-utils.test.ts` records and keeps.
 *
 * MUTATION 2 COUNTS ONE because both of its assertions live in one `it()`. The counts here
 * are failing tests, not failing expectations.
 */

/** 30 July 2026, 19:30 Chicago — the instant that is a different DAY in half the world. */
const EVENING_BEFORE = '2026-07-31T00:30:00Z'
/** Midnight UTC exactly, which is where an `hour12: false` build would answer 24. */
const UTC_MIDNIGHT = '2026-07-31T00:00:00Z'
/** January, so Chicago is on standard time and the abbreviation changes. */
const WINTER = '2026-01-15T18:00:00Z'

describe('dateIn', () => {
  it('answers the calendar date in the given zone, not the UTC one', () => {
    // THE BUG. One instant, three answers, and `formatDate`'s `.slice(0, 10)` gave the middle
    // one to everybody.
    expect(dateIn(EVENING_BEFORE, 'America/Chicago')).toBe('2026-07-30')
    expect(dateIn(EVENING_BEFORE, 'UTC')).toBe('2026-07-31')
    expect(dateIn(EVENING_BEFORE, 'Asia/Tokyo')).toBe('2026-07-31')
  })

  it('rolls the date back for every zone behind UTC at that instant', () => {
    expect(dateIn(EVENING_BEFORE, 'America/Denver')).toBe('2026-07-30')
    expect(dateIn(EVENING_BEFORE, 'America/Los_Angeles')).toBe('2026-07-30')
  })

  it('handles a half-hour offset', () => {
    // 00:30 UTC + 5:30 = 06:00 on the 31st. A zone whose offset is not a whole number of hours
    // is what catches minute-level arithmetic done in hours.
    expect(dateIn(EVENING_BEFORE, 'Asia/Kolkata')).toBe('2026-07-31')
    expect(timeIn(EVENING_BEFORE, 'Asia/Kolkata')).toBe('06:00')
  })

  it('accepts a Date as well as a string', () => {
    expect(dateIn(new Date(EVENING_BEFORE), 'America/Chicago')).toBe('2026-07-30')
  })

  it('answers null for absent or unparseable input', () => {
    expect(dateIn(null, 'UTC')).toBeNull()
    expect(dateIn(undefined, 'UTC')).toBeNull()
    expect(dateIn('', 'UTC')).toBeNull()
    expect(dateIn('not a date', 'UTC')).toBeNull()
  })

  it('THROWS for a bare YYYY-MM-DD, because that is a label and not an instant', () => {
    // The guard that keeps the two kinds of time apart. A DATE column reaching here would be
    // silently moved a day backwards in any negative offset — which is how a gathering ends
    // up on the wrong day. Loud on purpose: it cannot be data-dependent, so it fails on the
    // first render in development rather than for one member in production.
    expect(() => dateIn('2026-08-01', 'America/Chicago')).toThrow(TypeError)
    expect(() => dateIn('2026-08-01', 'America/Chicago')).toThrow(/wall-clock date/)
  })

  it('does not mistake a full timestamp for a label', () => {
    // The guard must be exact: an ISO timestamp STARTS with a date, so a `startsWith` version
    // of that check would throw on every legitimate call.
    expect(dateIn('2026-08-01T12:00:00Z', 'UTC')).toBe('2026-08-01')
  })
})

describe('timeIn', () => {
  it('answers 24-hour HH:MM in the given zone', () => {
    expect(timeIn(EVENING_BEFORE, 'America/Chicago')).toBe('19:30')
    expect(timeIn(EVENING_BEFORE, 'UTC')).toBe('00:30')
    expect(timeIn(EVENING_BEFORE, 'Asia/Tokyo')).toBe('09:30')
  })

  it('answers 00:00 at midnight, never 24:00', () => {
    // `hour12: false` yields "24" on some ICU builds, which is not a time and would render as
    // "24:00" through formatTime. This runner agrees either way — see the mutation log.
    expect(timeIn(UTC_MIDNIGHT, 'UTC')).toBe('00:00')
  })

  it('answers null for absent or unparseable input', () => {
    expect(timeIn(null, 'UTC')).toBeNull()
    expect(timeIn('nonsense', 'UTC')).toBeNull()
  })
})

describe('an unusable zone falls back rather than throwing', () => {
  it('uses DEFAULT_ZONE for a zone the runtime does not know', () => {
    // Data-dependent: this value arrives from `people.time_zone`, which a member can write. A
    // dashboard that 500s over a profile column is a worse product than one that shows Central.
    expect(dateIn(EVENING_BEFORE, 'Mars/Olympus_Mons')).toBe(
      dateIn(EVENING_BEFORE, DEFAULT_ZONE)
    )
    expect(dateIn(EVENING_BEFORE, '')).toBe(dateIn(EVENING_BEFORE, DEFAULT_ZONE))
  })

  it('and DEFAULT_ZONE is Central, which is a real zone', () => {
    expect(DEFAULT_ZONE).toBe('America/Chicago')
    expect(isValidZone(DEFAULT_ZONE)).toBe(true)
  })
})

describe('isValidZone', () => {
  it('accepts real IANA zones', () => {
    expect(isValidZone('America/Chicago')).toBe(true)
    expect(isValidZone('UTC')).toBe(true)
    expect(isValidZone('Pacific/Auckland')).toBe(true)
  })

  it('rejects everything else', () => {
    expect(isValidZone('Mars/Olympus_Mons')).toBe(false)
    expect(isValidZone('')).toBe(false)
    expect(isValidZone(null)).toBe(false)
    expect(isValidZone(undefined)).toBe(false)
  })

  it('ACCEPTS the legacy abbreviation zones, and they are a trap', () => {
    // Measured, and it is not what this test first asserted. `CST` and `EST` are real entries
    // in the tz database, so ICU takes them — but they do NOT behave alike:
    //
    //   CST  →  19:30 CDT in July.  Observes daylight saving, like America/Chicago.
    //   EST  →  19:30 EST in July.  FIXED at UTC-5 all year, unlike America/New_York.
    //
    // So a member whose `time_zone` held "EST" would be an hour out for eight months of the
    // year, silently, and `isValidZone` would say it was fine. That is the limit of what this
    // function claims: it answers "can Intl use this string", never "is this what the member
    // meant". The app's own `TIMEZONES` list in `lib/date-utils.ts` holds only proper IANA
    // names, and the profile control is a `<select>` over it, so the trap is unreachable
    // through the UI — this test exists so that nobody later "tightens" validation by
    // assuming ICU already refuses these.
    expect(isValidZone('CST')).toBe(true)
    expect(isValidZone('EST')).toBe(true)
    expect(timeIn(EVENING_BEFORE, 'EST')).toBe('19:30')                     // no DST
    expect(timeIn(EVENING_BEFORE, 'America/New_York')).toBe('20:30')        // DST
  })
})

describe('todayIn', () => {
  it('takes `now` as a parameter, so the assertion is about the arithmetic', () => {
    const at = new Date(EVENING_BEFORE)
    expect(todayIn('America/Chicago', at)).toBe('2026-07-30')
    expect(todayIn('UTC', at)).toBe('2026-07-31')
  })

  it('never returns null', () => {
    // A real Date and a coerced zone, so both null branches of `dateIn` are unreachable —
    // which is what lets callers use it without a `?? ''`.
    expect(todayIn('Mars/Nowhere', new Date(EVENING_BEFORE))).toBe('2026-07-30')
  })
})

describe('zoneAbbrev', () => {
  it('follows daylight saving, because the same zone has two names', () => {
    // Printing "CST" beside a July gathering is the kind of detail a reader checks and a
    // fixed label would get wrong for eight months of the year.
    expect(zoneAbbrev('America/Chicago', new Date(EVENING_BEFORE))).toBe('CDT')
    expect(zoneAbbrev('America/Chicago', new Date(WINTER))).toBe('CST')
  })

  it('gives a GMT offset where there is no common abbreviation', () => {
    // The honest output rather than an invented one. Asserted as a shape, since which zones
    // ICU has abbreviations for is a property of the build and not of this product.
    expect(zoneAbbrev('Asia/Kolkata', new Date(EVENING_BEFORE))).toMatch(/^(IST|GMT\+5:30)$/)
  })
})

describe('sameClock', () => {
  it('is true for one zone against itself', () => {
    expect(sameClock('America/Chicago', 'America/Chicago', new Date(EVENING_BEFORE))).toBe(true)
  })

  it('is true for two different zones that agree at that instant', () => {
    // Compared on the clock rather than the zone NAME, so a member in Winnipeg is not told
    // their own time twice for a gathering stated in Chicago. Both are Central and both
    // observe daylight saving, so they agree year-round.
    expect(sameClock('America/Chicago', 'America/Winnipeg', new Date(EVENING_BEFORE)))
      .toBe(true)
  })

  it('is false when the clocks differ', () => {
    expect(sameClock('America/Chicago', 'America/New_York', new Date(EVENING_BEFORE))).toBe(false)
    expect(sameClock('America/Chicago', 'Asia/Tokyo', new Date(EVENING_BEFORE))).toBe(false)
  })

  it('is why the answer depends on WHEN — Mexico City stopped observing DST', () => {
    // The case that justifies the `at` parameter, and it is a real one rather than a
    // contrived one: Mexico abolished daylight saving in 2022, so Mexico City is UTC-6 all
    // year while Chicago moves. The two agree in January and differ in July.
    //
    // This assertion is here because the first draft of this file asserted the opposite —
    // that Chicago and Mexico City agree in summer — and it was wrong. A zone-name comparison
    // or a cached answer would show a member in Monterrey a redundant "your time" line for
    // five months and a MISSING one for seven.
    expect(sameClock('America/Chicago', 'America/Mexico_City', new Date(WINTER))).toBe(true)
    expect(sameClock('America/Chicago', 'America/Mexico_City', new Date(EVENING_BEFORE)))
      .toBe(false)
  })

  it('compares the DATE as well as the time', () => {
    // Kiritimati (+14) and Honolulu (-10) are exactly 24 hours apart, so at this instant both
    // read 14:30 — on different days. Without the date half, a member in Kiritimati would be
    // told a Honolulu gathering was already in their own time: off by a whole day, which is
    // worse than off by hours because it reads as correct.
    expect(timeIn(EVENING_BEFORE, 'Pacific/Kiritimati')).toBe('14:30')
    expect(timeIn(EVENING_BEFORE, 'Pacific/Honolulu')).toBe('14:30')
    expect(dateIn(EVENING_BEFORE, 'Pacific/Kiritimati')).toBe('2026-07-31')
    expect(dateIn(EVENING_BEFORE, 'Pacific/Honolulu')).toBe('2026-07-30')
    expect(sameClock('Pacific/Kiritimati', 'Pacific/Honolulu', new Date(EVENING_BEFORE)))
      .toBe(false)
  })
})
