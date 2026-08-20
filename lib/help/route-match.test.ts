import { describe, expect, it } from 'vitest'
import { matchHelpRoute, type HelpRouteEntry } from './route-match'

/**
 * The four things `matchHelpRoute` has to get right, per AGENTS.md §7b.
 *
 * The function is eight lines and reads as obvious, which is exactly why it is tested: the
 * two rules in it — a prefix boundary and a longest-match tie-break — are both the kind
 * that look correct while being subtly wrong, and both fail SILENTLY. A wrong tie-break
 * sends a reader to the chapter about the section rather than the screen; a wrong boundary
 * sends them to a chapter about a different screen entirely. Neither throws, neither logs,
 * and neither is visible in a diff.
 *
 * A GREEN RUN IS NOT EVIDENCE UNTIL YOU HAVE SEEN IT FAIL. Four mutations, run 2026-08-17,
 * with what each of them actually tripped:
 *
 *   1. tie-break inverted — `entry.route.length > match.route.length` ->
 *      `entry.route.length < match.route.length`
 *          -> 3 red: 'matches a nested admin path', 'prefers the longest matching route',
 *             'prefers the longest match regardless of the order entries are listed in'
 *   2. tie-break dropped — `(!match || …)` -> `true`, i.e. last match wins
 *          -> 1 red: 'prefers the longest match regardless of the order entries are listed
 *             in', and ONLY that one. Which is exactly what it exists for: with the entries
 *             in the declared order a plain first-match-wins bug passes case 4's assertion,
 *             so one ordering is not a test of a tie-break.
 *   3. boundary loosened — `pathname.startsWith(route + '/')` ->
 *      `pathname.startsWith(route)`, so `/dues-projections` matches `/dues`
 *          -> 1 red: 'does not let one route match a longer route that merely starts with
 *             it'
 *   4. boundary dropped entirely — the `startsWith` disjunct removed, exact match only
 *          -> 3 red: 'matches a child path against its parent entry', 'matches a nested
 *             admin path', 'prefers the longest match regardless of the order entries are
 *             listed in'
 *
 * Worth noting from run 4: 'prefers the longest matching route' stayed GREEN, because
 * `/admin/gatherings` is an exact match on the entry it should resolve to. The tie-break and the
 * prefix rule are separate faults and neither case covers both — which is why there are
 * cases for each rather than one that looks like it covers the pair.
 *
 * ── THE FIXTURE NAMES REAL ROUTES, AND THAT IS DELIBERATE ──────────────────────────
 * `matchHelpRoute` is pure and would work as well over invented paths, but a reader checking a
 * fixture checks it against the product — so a fixture naming `/events`, a route that no longer
 * exists, costs a reader the time it takes to discover it is fiction. Every route below is one
 * `lib/features.ts` actually has. Keep it that way when a route is retired.
 */

const ENTRIES: readonly HelpRouteEntry[] = [
  { route: '/dues', slug: 'my-dues', title: 'Your dues' },
  { route: '/dues-projections', slug: 'dues-projections', title: 'Dues Projections' },
  { route: '/gatherings', slug: 'gatherings', title: 'Gatherings' },
  { route: '/admin', slug: 'admin-overview', title: 'Admin' },
  { route: '/admin/gatherings', slug: 'gathering-management', title: 'Gathering Management' },
]

describe('matchHelpRoute', () => {
  it('matches a route exactly', () => {
    expect(matchHelpRoute('/dues', ENTRIES)?.slug).toBe('my-dues')
  })

  it('matches a child path against its parent entry', () => {
    // `/gatherings/<id>` is the case this exists for: a detail page has no chapter of its own
    // and wants the one about the list it came from.
    expect(matchHelpRoute('/gatherings/8f2c-1234', ENTRIES)?.slug).toBe('gatherings')
  })

  it('matches a nested admin path', () => {
    expect(matchHelpRoute('/admin/gatherings/abc/tasks', ENTRIES)?.slug).toBe('gathering-management')
  })

  it('prefers the longest matching route', () => {
    // Both `/admin` and `/admin/gatherings` cover this. The chapter about the SCREEN wins over
    // the chapter about the section it sits in.
    expect(matchHelpRoute('/admin/gatherings', ENTRIES)?.slug).toBe('gathering-management')
  })

  it('prefers the longest match regardless of the order entries are listed in', () => {
    // The same assertion with the two candidates reversed, and it is not redundant: with
    // `/admin/gatherings` listed first, a first-match-wins implementation passes the case
    // above by accident. One ordering tests the tie-break; two test it in both directions.
    const reversed = [...ENTRIES].reverse()
    expect(matchHelpRoute('/admin/gatherings', reversed)?.slug).toBe('gathering-management')
    expect(matchHelpRoute('/admin/anything-else', reversed)?.slug).toBe('admin-overview')
  })

  it('does not let one route match a longer route that merely starts with it', () => {
    // The boundary case, and a real pair of routes in this app: `/dues-projections` is a
    // treasurer's screen and `/dues` is the member's own. A prefix test without the `/`
    // sends every visitor of the first to the chapter for the second.
    expect(matchHelpRoute('/dues-projections', ENTRIES)?.slug).toBe('dues-projections')
    expect(matchHelpRoute('/duesx', ENTRIES)).toBeNull()
  })

  it('returns null when nothing covers the path', () => {
    // `/coming-soon`, `/upgrade` and any screen shipped ahead of its chapter land here.
    // The affordance must degrade to nothing rather than to a broken link.
    expect(matchHelpRoute('/coming-soon', ENTRIES)).toBeNull()
  })

  it('returns null for an empty index', () => {
    expect(matchHelpRoute('/dues', [])).toBeNull()
  })

  it('does not treat a parent segment as a match on the way up', () => {
    // `/du` is a prefix of `/dues` in the other direction, and must not match it.
    expect(matchHelpRoute('/du', ENTRIES)).toBeNull()
  })
})
