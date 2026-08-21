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
 *      `pathname.startsWith(route)`
 *          -> 1 red: 'does not let one route match a longer path that merely starts with it'
 *
 *      THIS ONE SILENTLY STOPPED BITING AND WAS REPAIRED ON 2026-08-20 — see the note on the
 *      fixture below. Re-measured after the repair: 1 red, the same case.
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
 * exists, costs a reader the time it takes to discover it is fiction. Every ENTRY below is a
 * route `lib/features.ts` actually has. Keep it that way when a route is retired.
 *
 * ── AND A RETIRED ROUTE ONCE TOOK A TEST'S TEETH WITH IT, WHICH IS THE REAL LESSON ──
 * The boundary case used to be `/dues` against `/dues-projections`: a genuine pair of product
 * routes where one was a string prefix of the other WITHOUT a `/` between them, which is
 * exactly the collision the `+ '/'` exists to refuse. `20260820000004` renamed 42 routes under
 * section prefixes — `/accounting/dues`, `/reporting/dues-projections` — and the sweep rewrote
 * the route literals in this fixture along with everything else.
 *
 * Nothing failed. The two renamed routes no longer share a prefix at all, so the assertion
 * became a tautology, and mutation 3 above turned NOTHING red: measured 2026-08-20, the entire
 * prefix-boundary rule could be deleted from `route-match.ts` and all 453 tests passed.
 *
 * **A SWEEP THAT REWRITES A FIXTURE CAN DEFANG AN ASSERTION WITHOUT BREAKING IT**, and no gate
 * in this repo would have said so — `help:check` validates the real registry, not this file,
 * and a green vitest run is the failure mode rather than the warning. The general defence is
 * AGENTS.md §7b's rule applied to test DATA as well as to code: after a rename, re-run the
 * mutations the file documents, because the thing that broke is the reason the test existed.
 *
 * ── WHY THE REPAIR NEEDS NO FICTIONAL ROUTE ────────────────────────────────────────
 * There is no non-boundary prefix pair left among the 35 live routes, and there should not be:
 * every route is now `/<section>/<screen>`, so a collision of that shape is structurally
 * impossible. Inventing a fake ENTRY to restore the pair would have broken the rule above.
 *
 * It is not needed. The rule is about a PATHNAME that starts with a route, and a pathname is an
 * INPUT rather than a route — `matchHelpRoute` is asked about arbitrary `usePathname()` values,
 * including ones no page serves. So the entry stays real and the probe path is the made-up one,
 * which is what `'/duesx'` was already doing in the second half of this same case.
 */

const ENTRIES: readonly HelpRouteEntry[] = [
  { route: '/accounting/dues-and-donations', slug: 'my-dues', title: 'Dues & Donations' },
  { route: '/reporting/dues-projections', slug: 'reporting/dues-projections', title: 'Dues Projections' },
  { route: '/gatherings', slug: 'gatherings', title: 'Gatherings' },
  { route: '/admin', slug: 'admin-overview', title: 'Admin' },
  { route: '/admin/gatherings', slug: 'gathering-management', title: 'Gathering Management' },
]

describe('matchHelpRoute', () => {
  it('matches a route exactly', () => {
    expect(matchHelpRoute('/accounting/dues-and-donations', ENTRIES)?.slug).toBe('my-dues')
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

  it('does not let one route match a longer path that merely starts with it', () => {
    // THE PROBE PATHS ARE MADE UP AND THE ENTRIES ARE REAL, which is the point — see the
    // fixture note. Each of these starts with a live route's full string and continues WITHOUT
    // a `/`, which is the one shape the `+ '/'` in `covers()` exists to refuse. Drop that `'/'`
    // and every line here resolves to a chapter about a different screen.
    //
    // Three routes rather than one, because the rule has to hold at every depth: a two-segment
    // route, a one-segment route, and the `/admin` catch-all that every unregistered admin path
    // legitimately falls back to.
    expect(matchHelpRoute('/accounting/dues-and-donations-archive', ENTRIES)).toBeNull()
    expect(matchHelpRoute('/gatheringsx', ENTRIES)).toBeNull()
    expect(matchHelpRoute('/administration', ENTRIES)).toBeNull()

    // And the sibling that motivated the rule in the first place still resolves to its own
    // chapter rather than being swallowed. It is no longer a prefix collision — 20260820000004
    // put the two under different sections — so this asserts the ordinary case rather than the
    // boundary, and is kept because it is the pair a reader will remember.
    expect(matchHelpRoute('/reporting/dues-projections', ENTRIES)?.slug).toBe('reporting/dues-projections')
  })

  it('returns null when nothing covers the path', () => {
    // `/coming-soon`, `/upgrade` and any screen shipped ahead of its chapter land here.
    // The affordance must degrade to nothing rather than to a broken link.
    expect(matchHelpRoute('/coming-soon', ENTRIES)).toBeNull()
  })

  it('returns null for an empty index', () => {
    expect(matchHelpRoute('/accounting/dues-and-donations', [])).toBeNull()
  })

  it('does not treat a parent segment as a match on the way up', () => {
    // `/accounting` is a prefix of `/accounting/dues-and-donations` in the OTHER direction — a
    // path shorter than any entry — and must not match it. `/accounting` is deliberately not a
    // route: sections are not screens, so a member landing on one has no chapter to be sent to.
    expect(matchHelpRoute('/accounting', ENTRIES)).toBeNull()
    expect(matchHelpRoute('/du', ENTRIES)).toBeNull()
  })
})
