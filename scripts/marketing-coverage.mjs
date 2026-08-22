/**
 * The marketing catalogue, checked against the registry.
 *
 *     npm run marketing:check
 *
 * WHY THIS EXISTS
 *   A buyer should be able to see everything they are getting. `lib/features.ts` is the list
 *   of what a member can reach; `/features` is the list a visitor reads. Nothing kept the two
 *   in step, and the gap only ever opens in one direction — a feature ships, the registry
 *   gains a row, and the catalogue does not, so the product quietly undersells itself with
 *   nothing anywhere reporting it.
 *
 *   It has already happened twice at scale. The `ALSO` grid was checked by hand against a
 *   34-entry registry on 2026-08-21 and four cards were added; the registry reached 42 two
 *   days later and eleven live screens were named nowhere at all — the whole Library, four of
 *   the five reports, the calendar, the manual, and multi-family membership. That grid's own
 *   header called this check "one script away from being mechanical and is not written". This
 *   is the script.
 *
 * WHAT IT CANNOT ASSERT, said first so a green run is never read as more than it is:
 *
 *   * THAT THE PROSE IS TRUE, or that a card describes the screen it names. Nothing can.
 *   * THAT `PLANS[]` ON `/pricing` SELLS EVERYTHING. A pricing bullet is prose about a
 *     BENEFIT: one bullet spans several routes and several routes are sold in no bullet at
 *     all, which is exactly why `lib/plans.ts` refuses to derive itself from `PLANS[]` and
 *     why neither may be derived from this registry. The pricing cards are a judgement and
 *     stay one; FutureFeature.md is where their gaps live.
 *   * THAT A PILLAR'S BULLETS SIT AT THE PILLAR'S TIER. The tier tag and the Coming Soon
 *     pill are both per CARD, and the Gatherings pillar is `tier: 'free'` while five of its
 *     six bullets describe Standard capabilities. That is disclosed in the paragraph under
 *     the pillars rather than by a badge, and no per-card check can see it.
 *
 * WHAT IT DOES ASSERT
 *   1. every LIVE feature is named on the catalogue — a `route:` in `PILLARS` or in `ALSO` —
 *      or has an entry in `SOLD_ELSEWHERE` below giving the surface that sells it;
 *   2. every `route:` on the catalogue is a live registry href, EXACTLY. `getFeature()`
 *      longest-prefix-matches, so a renamed or deleted route does not fail — it resolves to
 *      the nearest registered parent and prints that parent's tier tag and status. That is
 *      how `/admin/reports` came to sit on this grid printing "Free" over a Plus screen;
 *   3. no two cards claim the same route, so the catalogue cannot say one thing twice;
 *   4. no stale allowance — every `SOLD_ELSEWHERE` key is a live route, and none of them is
 *      also on the catalogue. Both directions, for `audit_global_lookups.sql`'s reason: a
 *      one-way assertion cannot see the half where the list itself has gone out of date.
 *
 * ── HOW IT READS THE TWO MARKETING FILES ────────────────────────────────────────────────
 * By TEXT, not by import, and that is a limitation accepted deliberately. `pillars.ts` pulls
 * in `lucide-react` and three `.png` static imports and `app/(marketing)/features/page.tsx`
 * is a React page; neither loads under node's type stripping without a bundler. So comments
 * are stripped and `route: '<href>'` is matched out of what is left. What that buys is a
 * dependency-free checker in the family of `db:check`, `help:check` and `email:check`; what
 * it costs is that a route assembled by interpolation would be invisible — there are none,
 * and a `route` on either surface is required to be a literal for exactly this reason.
 *
 * `lib/features.ts` IS imported, through the same `@/` resolve hook `help-check.mjs` and
 * `tests/rls/hooks.mjs` carry. One registry, read one way.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7 ───────────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Six mutations, each tripping
 * its own check and only its own (2026-08-22):
 *
 *   1. the Officer Notes card deleted                       -> uncovered live features
 *   2. `/library/bylaws` -> `/library/bylawz` on its card    -> unknown catalogue routes AND
 *      uncovered live features — BOTH, which is the right answer and worth stating: a typo
 *      leaves a real screen unsold and a card pointing at nothing, and it is reported as two
 *      findings because it is two problems. It does NOT pass via the `/library` prefix, which
 *      is exactly what `getFeature()` would have done with it on the page itself.
 *   3. a second card added for `/community/gallery`          -> duplicate cards
 *   4. a `SOLD_ELSEWHERE` entry for `/community/gallery`,
 *      which is on the grid                                 -> stale allowances
 *   5. `/dashboard`'s allowance deleted                     -> uncovered live features
 *   6. a `SOLD_ELSEWHERE` key of `/direct-lineage`          -> stale allowances, by name
 */
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

// ---------------------------------------------------------------- the `@/` hook
//
// Inlined as source and registered from a data: URL so this stays ONE file — the same
// arrangement, and the same win32 reason, as `help-check.mjs`.
const HOOK = `
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = ${JSON.stringify(ROOT)}
const EXTENSIONS = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = join(ROOT, specifier.slice(2))
    for (const ext of EXTENSIONS) {
      const candidate = base + ext
      if (existsSync(candidate) && !statSync(candidate).isDirectory()) {
        return next(pathToFileURL(candidate).href, context)
      }
    }
  }
  return next(specifier, context)
}
`

register(`data:text/javascript,${encodeURIComponent(HOOK)}`)

const { FEATURES } = await import(pathToFileURL(join(ROOT, 'lib', 'features.ts')).href)

// ---------------------------------------------------------------- the surfaces

const CATALOGUE = [
  { label: 'PILLARS', file: join('components', 'marketing', 'pillars.ts') },
  { label: 'ALSO', file: join('app', '(marketing)', 'features', 'page.tsx') },
]

/**
 * A live route the catalogue carries no card for, and the surface that sells it instead. The
 * value is the reason, printed on every run so the list stays readable rather than becoming
 * somewhere to file an inconvenience.
 *
 * THE BAR IS "a buyer can find out that they get this", not "a card exists somewhere". A
 * screen whose whole content is another screen's bullet does not need its own card; a screen
 * a buyer would search this page for does. Where the two readings disagree, add the card — an
 * over-full catalogue costs a reader a few seconds and an under-full one costs the sale.
 */
const SOLD_ELSEWHERE = {
  '/dashboard':
    'Not a capability. It is where the other capabilities are rendered, and every card on it is sold as the feature behind it.',
  '/personal-info':
    'The family-record pillar sells it: "Profiles the family maintains: contact details, birthdays, t-shirt sizes."',
  '/community/directory':
    'The family-record pillar\'s last bullet and the Free card\'s second bullet, "Everybody in one place, and reachable". That pillar is the directory as much as the tree.',
  '/accounting/summary':
    'The treasury pillar sells the ledger as one thing. This is a member\'s own standing in it, and the payment-history card is the half a buyer searches for.',
  '/accounting/dues-and-donations':
    'The treasury pillar\'s dues and drives bullets, and the Standard card\'s "A real ledger for the money you collect".',
  '/accounting/transactions':
    'The treasury pillar: "Contributions and disbursements on one full ledger." The one ledger sold separately is fund transfers, which has its own card because it is a separate grant at a higher tier.',
  '/admin/accounting':
    'The treasury pillar sells what it configures — dues cadence, installments, routing and funds — in four of its six bullets. A setup screen behind a sold capability is not a second claim.',
  '/gatherings/my-tasks':
    'The gatherings pillar, "Every step assigned to a named relative, with a due date", and the Standard card\'s "Everybody knows their duties".',
  '/gatherings/budget':
    'The gatherings pillar, "A budget drawn on a real fund, with each task claiming its own line", and the Standard card\'s "Plan what the gathering costs".',
  '/admin/gatherings':
    'The gatherings pillar IS the organizer\'s screen: scheduling, handing out the steps and ruling on the answers are three of its six bullets.',
  '/admin/gatherings/templates':
    'The gatherings pillar\'s first bullet, which is the template library said out loud: "the checklist your family runs every year, written once".',
  '/admin/settings':
    'How it works, step one — "Share one family code" — which is the screen that code lives on. A card here would sell renaming a family as a feature.',
  '/admin/members/approvals':
    'The privacy card: "New members reviewed before they see anything." It belongs there rather than in the grid because it is a guarantee about who gets in, not a screen a buyer shops for.',
}

// ---------------------------------------------------------------- reading the surfaces
//
// Comments are stripped first, or a route quoted in a rationale would count as a card. Both
// files argue their own history in prose and name retired routes while doing it.
function routesIn(file) {
  const src = readFileSync(join(ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  return [...src.matchAll(/route: '([^']+)'/g)].map(m => m[1])
}

const cards = []
for (const { label, file } of CATALOGUE) {
  for (const route of routesIn(file)) cards.push({ route, surface: label, file })
}

// ---------------------------------------------------------------- findings

const findings = []
const fail = (check, message) => findings.push({ check, message })

const live = FEATURES.filter(f => f.status === 'live')
const liveHrefs = new Set(live.map(f => f.href))
const carded = new Map()
for (const c of cards) {
  if (!carded.has(c.route)) carded.set(c.route, [])
  carded.get(c.route).push(c)
}

// 1 — every live feature is sold somewhere
for (const f of live) {
  if (carded.has(f.href) || Object.hasOwn(SOLD_ELSEWHERE, f.href)) continue
  fail(
    'uncovered live features',
    `${f.href} (${f.label}, ${f.tier}) is live and named on no marketing surface. Add a card to ` +
      `ALSO in app/(marketing)/features/page.tsx, or an entry to SOLD_ELSEWHERE in this file ` +
      `saying which surface already sells it.`,
  )
}

// 2 — every card names a live route, exactly
for (const [route, entries] of carded) {
  if (liveHrefs.has(route)) continue
  const known = FEATURES.find(f => f.href === route)
  fail(
    'unknown catalogue routes',
    `${route} on ${entries.map(e => e.surface).join(' and ')} is ` +
      (known ? `registered but status '${known.status}'` : 'not a registry href') +
      `. getFeature() longest-prefix-matches, so this card renders the nearest parent's tier ` +
      `tag and Coming Soon pill instead of failing.`,
  )
}

// 3 — one card per route
for (const [route, entries] of carded) {
  if (entries.length < 2) continue
  fail(
    'duplicate cards',
    `${route} has ${entries.length} cards (${entries.map(e => e.surface).join(', ')}). The ` +
      `catalogue says one thing twice, and both copies drift.`,
  )
}

// 4 — no stale allowance, in both directions
for (const route of Object.keys(SOLD_ELSEWHERE)) {
  if (carded.has(route)) {
    fail(
      'stale allowances',
      `${route} has a SOLD_ELSEWHERE entry AND a card on ${carded.get(route)[0].surface}. Delete ` +
        `the allowance — an excuse standing beside the thing it excused is how the list stops ` +
        `being read.`,
    )
  } else if (!liveHrefs.has(route)) {
    const known = FEATURES.find(f => f.href === route)
    fail(
      'stale allowances',
      `${route} has a SOLD_ELSEWHERE entry and is ` +
        (known ? `status '${known.status}'` : 'not in the registry at all') +
        `. Delete it: an allowance for a route nobody can reach hides nothing and reads as ` +
        `coverage.`,
    )
  }
}

// ---------------------------------------------------------------- report

const byTier = t => live.filter(f => f.tier === t).length
console.log(
  `Walked ${live.length} live features ` +
    `(free ${byTier('free')}, standard ${byTier('standard')}, plus ${byTier('plus')}, ` +
    `premium ${byTier('premium')}), ${cards.length} catalogue cards, ` +
    `${Object.keys(SOLD_ELSEWHERE).length} stated allowances.`,
)

// The allowances are PRINTED, not merely counted. `help:check` does the same with its three,
// for the same reason: a skip that scrolls past as a number is a skip nobody re-reads, and
// this list is the whole of the judgement this check declines to make.
for (const [route, why] of Object.entries(SOLD_ELSEWHERE).sort()) {
  console.log(`  sold elsewhere  ${route.padEnd(32)} ${why.replace(/\s+/g, ' ')}`)
}

if (findings.length === 0) {
  console.log('\nEvery live feature is on a marketing surface.')
  process.exit(0)
}

console.error(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}:\n`)
for (const f of findings) console.error(`  [${f.check}] ${f.message}`)
process.exit(1)
