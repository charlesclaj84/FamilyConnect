import { describe, expect, it } from 'vitest'
import {
  IDLE_LIMIT_MINUTES,
  IDLE_LIMIT_MS,
  WARN_BEFORE_MS,
  idlePhase,
  inheritedActivity,
  sessionStartMs,
  TIMEOUT_NOTICE,
} from './idle-timeout'

/**
 * The idle sign-out's arithmetic.
 *
 * ── WHY THESE TESTS EXIST NOW AND NOT BEFORE ────────────────────────────────────────
 * `idlePhase` has been a two-boundary comparison since it was written and nobody got it
 * wrong. `inheritedActivity` is different: it decides, on every page load of the signed-in
 * app, whether a marker left in `localStorage` should END the session — and it has now been
 * wrong in BOTH directions in production.
 *
 *   * Adopting an expired marker unconditionally made the sign-out unrecoverable: the
 *     timeout left its own hour-old marker behind and the first page after signing back in
 *     mounted already expired, bouncing every sign-in straight to /login forever.
 *   * Ignoring an expired marker — the fix for that — meant the feature never fired on a
 *     phone at all, because a mobile tab is EVICTED rather than left running, so the only
 *     thing that can notice an hour of absence is the next mount reading that very marker.
 *
 * Both are one-line changes to the same function and neither is visible by reading it. The
 * third answer (`expired`) and the `sessionStartedAt` discriminator are what separate the
 * two cases, and the whole point of the cases below is that the separation is exercised
 * rather than asserted in a comment.
 *
 * Pure, per AGENTS.md §7b: `now` and `sessionStartedAt` are parameters, nothing here reads
 * a clock, and there is no `localStorage` in sight — the component owns the store and this
 * owns the rule.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7b ──────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Seven mutations of
 * `lib/idle-timeout.ts`, each run with `npx vitest run lib/idle-timeout.test.ts`; observed
 * results, not expected:
 *
 *   the `expired` branch returned as `{ kind: 'fresh' }` — i.e. the pre-2026-08-22 code
 *      3 failed — "expires a marker this session left to go stale", "expires one that is
 *      exactly the limit old" and the mobile-eviction narrative case. This is the mobile
 *      bug, reproduced.
 *   the `at < sessionStartedAt` guard deleted
 *      3 failed — "ignores one written before this session began", "does not expire a member
 *      who has just signed in on a browser holding old residue" and "checks the session
 *      boundary BEFORE the limit". This is the unrecoverable-bounce bug, reproduced.
 *   that guard's comparison flipped to `at > sessionStartedAt`
 *      4 failed — every adopt case as well, since a live marker is by definition newer than
 *      the sign-in.
 *   `sessionStartedAt === null` falling through to `expired` instead of `fresh`
 *      1 failed — "with no sign-in time it keeps the old conservative answer". The one that
 *      matters: it would sign out anybody whose GoTrue user carries no `last_sign_in_at`.
 *   `at >= now` (future marker) relaxed to `at > now`
 *      1 failed — "treats a marker stamped exactly now as unusable". Only reachable from a
 *      clock that moved, and the assertion is what keeps the answer from depending on it.
 *   `now - at >= IDLE_LIMIT_MS` relaxed to `>`
 *      1 failed — "expires one that is exactly the limit old". The boundary `idlePhase`
 *      already draws inclusively, kept in step by hand and now by a test.
 *   `WARN_BEFORE_MS` subtracted from `IDLE_LIMIT_MS` the other way round in `idlePhase`
 *      3 failed — the warn boundary, the last-second case and "the warning comes out of the
 *      limit, not on top of it".
 */

/** An arbitrary fixed "now", so every case reads as an offset from something. */
const NOW = 1_800_000_000_000
const MINUTE = 60 * 1000

describe('idlePhase', () => {
  it('is active from zero up to the warning boundary', () => {
    expect(idlePhase(0)).toEqual({ phase: 'active' })
    expect(idlePhase(IDLE_LIMIT_MS - WARN_BEFORE_MS - 1)).toEqual({ phase: 'active' })
  })

  it('warns for the last minute, and never reports zero seconds', () => {
    // A countdown showing "0 seconds" for a whole tick before anything happens reads as
    // broken, so the last second displays as 1 and the following tick expires.
    expect(idlePhase(IDLE_LIMIT_MS - WARN_BEFORE_MS)).toEqual({ phase: 'warn', secondsLeft: 60 })
    expect(idlePhase(IDLE_LIMIT_MS - 1)).toEqual({ phase: 'warn', secondsLeft: 1 })
  })

  it('expires exactly at the limit, not a tick after it', () => {
    expect(idlePhase(IDLE_LIMIT_MS)).toEqual({ phase: 'expired' })
    expect(idlePhase(IDLE_LIMIT_MS + 10 * MINUTE)).toEqual({ phase: 'expired' })
  })

  it('takes the warning out of the limit, not on top of it', () => {
    // The member is signed out at IDLE_LIMIT_MINUTES either way; the warning is the last
    // minute OF it. Adding it instead would make the real limit 61 minutes and quietly
    // falsify the sentence on /login.
    expect(idlePhase(IDLE_LIMIT_MINUTES * MINUTE)).toEqual({ phase: 'expired' })
    expect(idlePhase((IDLE_LIMIT_MINUTES - 1) * MINUTE).phase).toBe('warn')
  })

  it('states the same number the notice tells the member', () => {
    // The one place these two could drift is a hand-typed figure in the sentence.
    expect(TIMEOUT_NOTICE).toContain(String(IDLE_LIMIT_MINUTES))
    expect(IDLE_LIMIT_MS).toBe(IDLE_LIMIT_MINUTES * MINUTE)
  })
})

describe('sessionStartMs', () => {
  it('parses the ISO instant GoTrue sends', () => {
    expect(sessionStartMs('2026-08-22T14:30:00.000Z')).toBe(Date.UTC(2026, 7, 22, 14, 30))
  })

  it('honours an explicit offset rather than guessing a zone', () => {
    // This is the one date in the feature that is a real instant rather than a calendar
    // day, so the offset is part of the value and must not be dropped.
    expect(sessionStartMs('2026-08-22T09:30:00-05:00'))
      .toBe(sessionStartMs('2026-08-22T14:30:00Z'))
  })

  it('answers null for anything it cannot read', () => {
    expect(sessionStartMs(null)).toBe(null)
    expect(sessionStartMs(undefined)).toBe(null)
    expect(sessionStartMs('')).toBe(null)
    expect(sessionStartMs('never')).toBe(null)
  })
})

describe('inheritedActivity', () => {
  /** A sign-in two hours ago: old enough that every marker below can sit either side of it. */
  const SIGNED_IN = NOW - 120 * MINUTE

  describe('nothing usable', () => {
    it('starts fresh with no marker at all', () => {
      expect(inheritedActivity(null, NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
      expect(inheritedActivity('', NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
      expect(inheritedActivity('not a number', NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
      expect(inheritedActivity('0', NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
      expect(inheritedActivity('-1', NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
    })

    it('treats a marker stamped exactly now, or later, as unusable', () => {
      // A clock that moved, not activity. Adopting it sets a timer that never fires and
      // expiring on it would be worse, so neither answer is given.
      expect(inheritedActivity(String(NOW), NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
      expect(inheritedActivity(String(NOW + MINUTE), NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
    })
  })

  describe('a marker from this session', () => {
    it('adopts one inside the window, so a second tab inherits the clock', () => {
      const at = NOW - 9 * MINUTE
      expect(inheritedActivity(String(at), NOW, SIGNED_IN)).toEqual({ kind: 'adopt', at })
    })

    it('adopts one a second short of the limit', () => {
      const at = NOW - IDLE_LIMIT_MS + 1000
      expect(inheritedActivity(String(at), NOW, SIGNED_IN)).toEqual({ kind: 'adopt', at })
    })

    it('expires a marker this session left to go stale', () => {
      // THE MOBILE CASE. Nothing ran for those ninety minutes because the tab was evicted,
      // so this mount is the first thing able to notice — and `fresh` here is exactly the
      // bug that was reported as "mobile doesn't automatically log you out".
      const at = NOW - 90 * MINUTE
      expect(inheritedActivity(String(at), NOW, SIGNED_IN)).toEqual({ kind: 'expired', at })
    })

    it('expires one that is exactly the limit old', () => {
      // Same boundary `idlePhase` draws, and drawn the same way: at the limit, not after it.
      const at = NOW - IDLE_LIMIT_MS
      expect(inheritedActivity(String(at), NOW, SIGNED_IN)).toEqual({ kind: 'expired', at })
    })
  })

  describe('a marker from an earlier session', () => {
    it('ignores one written before this session began', () => {
      // Residue. Nothing about a previous session may end this one — and this is the guard
      // whose absence made every sign-in bounce back to /login.
      const at = SIGNED_IN - 5 * MINUTE
      expect(inheritedActivity(String(at), NOW, SIGNED_IN)).toEqual({ kind: 'fresh' })
    })

    it('does not expire a member who has just signed in on a browser holding old residue', () => {
      // The unrecoverable bounce, stated as the sequence it actually was: a timeout at
      // 10:00 leaves an hour-old marker, the member signs in at 10:05, and the first page
      // they reach must not read that marker as their own idleness.
      const signedInJustNow = NOW - 30 * 1000
      const residue = NOW - 65 * MINUTE
      expect(inheritedActivity(String(residue), NOW, signedInJustNow)).toEqual({ kind: 'fresh' })
    })

    it('checks the session boundary BEFORE the limit', () => {
      // A marker that is both stale AND pre-session has to read as residue rather than as
      // an expiry, or the case above resolves the wrong way. Ordering, asserted.
      const at = SIGNED_IN - IDLE_LIMIT_MS
      expect(inheritedActivity(String(at), NOW, SIGNED_IN).kind).toBe('fresh')
    })
  })

  describe('with no sign-in time', () => {
    it('keeps the old conservative answer for a stale marker', () => {
      // `last_sign_in_at` is optional on the GoTrue user, and the two mistakes are not
      // symmetrical: expiring wrongly locks somebody out of a session they just created,
      // adopting wrongly changes nothing that was not already the case. So `null` never
      // expires anybody.
      expect(inheritedActivity(String(NOW - 90 * MINUTE), NOW, null)).toEqual({ kind: 'fresh' })
      expect(inheritedActivity(String(NOW - IDLE_LIMIT_MS), NOW, null)).toEqual({ kind: 'fresh' })
    })

    it('still adopts a live marker, so cross-tab inheritance is unaffected', () => {
      const at = NOW - 9 * MINUTE
      expect(inheritedActivity(String(at), NOW, null)).toEqual({ kind: 'adopt', at })
    })
  })

  it('walks the mobile sequence end to end', () => {
    // Signed in at 09:00, last touched the screen at 09:20, phone locked, tab evicted,
    // browser reopened at 11:00. One page load, one decision, and it is the sign-out.
    const signedIn = NOW - 120 * MINUTE
    const lastTouch = NOW - 100 * MINUTE
    expect(inheritedActivity(String(lastTouch), NOW, signedIn))
      .toEqual({ kind: 'expired', at: lastTouch })

    // The same sequence with the member coming back inside the hour instead: the clock is
    // inherited rather than restarted, so the remaining time is what they actually had left
    // and reopening a tab is not a way to buy another hour.
    const recent = NOW - 40 * MINUTE
    expect(inheritedActivity(String(recent), NOW, signedIn)).toEqual({ kind: 'adopt', at: recent })
    expect(idlePhase(NOW - recent).phase).toBe('active')
  })
})
