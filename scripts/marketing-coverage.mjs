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
 *
 *     CHECK 5 IS NOT AN EXCEPTION TO THAT. It compares the two hand-written lists to EACH
 *     OTHER and to nothing else — never to the registry, and never a word of copy. Whether a
 *     bullet should exist at all remains the judgement this paragraph is about.
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
 *   3. no two cards on the SAME SURFACE claim one route. It was no two cards anywhere until
 *      2026-08-22, which forbade the arrangement the catalogue now deliberately has: a pillar
 *      NARRATES a capability and a card INDEXES it under its plan, and those are different
 *      claims — the pillars carry no tier, so the card is the only place on the page that says
 *      which plan a thing is on. Removing the family-tree card under the old rule took the
 *      tree out of the tier bands entirely, which is the failure that widened this one. Two
 *      cards in ALSO is still the drift it was written for;
 *   4. no stale allowance — every `SOLD_ELSEWHERE` key is a live route, and none of them is
 *      also on the catalogue. Both directions, for `audit_global_lookups.sql`'s reason: a
 *      one-way assertion cannot see the half where the list itself has gone out of date.
 *   5. THE TWO PLAN LISTS SELL THE SAME THINGS — `PLANS[]` on `/pricing` and `PLAN_ADD_CLAIMS` in
 *      `lib/plans.ts`, compared per tier by the `claim` id each bullet carries, never by its
 *      words. See the block above the check; it is the one mechanical question inside the
 *      pricing cards, and it was worth adding a field to make askable.
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
 *   3. a second ALSO card added for `/community/directory`   -> duplicate cards, naming the
 *      surface. Re-run after the rule was narrowed on 2026-08-22, together with its other
 *      half: `/community/family-tree`, which is now on PILLARS *and* on ALSO, is GREEN. Both
 *      directions, because a rule that stopped refusing something has to be shown still
 *      refusing what it was written for.
 *   4. a `SOLD_ELSEWHERE` entry for `/community/gallery`,
 *      which is on the grid                                 -> stale allowances
 *   5. `/dashboard`'s allowance deleted                     -> uncovered live features
 *   6. a `SOLD_ELSEWHERE` key of `/direct-lineage`          -> stale allowances, by name
 *
 * AND FOUR MORE FOR CHECK 5, added with it on 2026-08-22. Each reports every problem it
 * genuinely is rather than collapsing to one line, which is the same answer mutation 2 gives:
 *
 *   7. `premium/custom-domain` renamed in `PLAN_ADD_CLAIMS` only  -> plan claims, TWICE — sold on
 *      /pricing and unmentioned in-product, AND in PLAN_ADD_CLAIMS and on no card. Two findings for
 *      one edit, because from the two lists' point of view that is two disagreements
 *   8. `standard/ledger` -> `plus/ledger` on its pricing
 *      card, i.e. a bullet re-priced in one file only       -> plan claims, THREE times: the
 *      prefix does not match the card it sits on, and both set comparisons then miss
 *   9. a second `free/chat` bullet, replacing `free/manual`  -> plan claims — the duplicate,
 *      named, plus the claim it displaced
 *  10. `standard/ledger` -> `plus/ledger` in `PLAN_ADD_CLAIMS`,
 *      i.e. mutation 8 from the other side                  -> plan claims, three times again.
 *      Both sides of the prefix rule are checked because only one of them is protected by a
 *      type: `PLAN_ADD_CLAIMS` is keyed by tier and the pricing table is a flat array, and neither
 *      key nor position makes the prefix inside the bullet agree with either
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
// `PLAN_ADD_CLAIMS` and the tier vocabulary, for check 5. `lib/plans.ts` is pure by design — data,
// no React, no database, no `server-only` — which is exactly what makes it importable here;
// the pricing page it is checked against is a React server component and has to be read as
// text, the same limitation this file already accepts for the two catalogue surfaces.
const { PLAN_ADD_CLAIMS } = await import(pathToFileURL(join(ROOT, 'lib', 'plans.ts')).href)
const { TIERS, TIER_LABEL } = await import(pathToFileURL(join(ROOT, 'lib', 'tiers.ts')).href)

// ---------------------------------------------------------------- the surfaces

const CATALOGUE = [
  { label: 'PILLARS', file: join('components', 'marketing', 'pillars.ts') },
  { label: 'ALSO', file: join('app', '(marketing)', 'features', 'page.tsx') },
]

/**
 * A live route the catalogue carries no card for, and the reason. Printed on every run so the
 * list stays readable rather than becoming somewhere to file an inconvenience.
 *
 * ── IT WAS THIRTEEN ENTRIES AND IS NOW TWO, 2026-08-22 ───────────────────────────────
 * The bar used to be "a buyer can find out that they get this", satisfied by a pillar bullet
 * or a pricing card. That was sound while `/features`' grid was a flat complement to the
 * pillars. It stopped being sound when the grid became one band per PLAN: a pillar carries no
 * tier, so a capability sold only by a pillar appears in no band, and the page's own lede
 * tells a reader to read one band and stop. Eleven allowances were quietly holding the family
 * tree, the whole ledger and the planning half of Gatherings out of the tier bands — the
 * Standard band was three cards while seven more Standard screens existed.
 *
 * THE BAR NOW IS "is this a capability at all". Both survivors fail it rather than being
 * excused: one is where capabilities render and the other is the family's own name. Anything a
 * buyer could want gets a card, even if a pillar already narrates it — check 3 above allows
 * exactly that pairing, and the narrative and the index are different claims.
 */
const SOLD_ELSEWHERE = {
  '/dashboard':
    'Not a capability. It is where the other capabilities are rendered, and every card on it is sold as the feature behind it.',
  '/admin/settings':
    'How it works, step one — "Share one family code" — which is the screen that code lives on. A card here would sell renaming a family as a feature.',
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

// 3 — one card per route PER SURFACE. A pillar and a card may both name a route: one is the
// narrative and the other is the index entry under its plan. Two on one surface is the
// duplication this was written for, and the message names the surface so the finding is
// actionable rather than a puzzle.
for (const [route, entries] of carded) {
  const bySurface = new Map()
  for (const e of entries) bySurface.set(e.surface, (bySurface.get(e.surface) ?? 0) + 1)
  for (const [surface, count] of bySurface) {
    if (count < 2) continue
    fail(
      'duplicate cards',
      `${route} has ${count} cards on ${surface}. That surface says one thing twice, and both ` +
        `copies drift.`,
    )
  }
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

// ---------------------------------------------------------------- 5 — the two plan lists
//
// ── WHAT THIS DOES AND DOES NOT CLAIM ───────────────────────────────────────────────────
// It does NOT derive either list from the other, and it does not compare a single word of
// copy. `PLANS[]` on `/pricing` is what a BUYER reads and the in-product list in `lib/plans.ts` is
// what a MEMBER reads on `/admin/settings` and `/upgrade`; the two say the same things in
// different words on purpose, and both files argue at length why generating either from the
// other would mean inventing a correspondence that does not exist. That argument is sound and
// nothing here touches it.
//
// What it asserts is narrower and is the thing that actually went wrong twice: the two lists
// must agree about WHICH THINGS ARE SOLD. A `claim` id per bullet — `<tier>/<slug>`, never
// rendered — is what makes that a set comparison instead of a judgement about prose.
//
// THE HEADER OF THIS FILE SAYS THE PRICING CARDS CANNOT BE CHECKED, and that is still true of
// everything else about them: whether a bullet is true, whether it is in the right tier,
// whether the tier has enough in it to be worth the money. This is the one mechanical
// question inside them, and it was worth a field to make askable.
//
// THE PRICING PAGE IS READ AS TEXT, per this file's header — it is a React server component
// and does not load under node's type stripping. The claim ids are tier-prefixed partly for
// that reason: the prefix is what lets a flat scan know which card a bullet is on, and check
// 5c is what verifies the prefix against the card it is actually sitting in, so the prefix
// cannot become a lie.
//
// ── WHAT THE TABLE LOOKS LIKE NOW, AND WHY THE SCAN GOT SIMPLER ────────────────────────
// The bullets used to be `{ claim: 'x', label: '…', detail: '…' }` and the card was identified by
// `name: 'Plus'`. Since the public site learned Spanish and French the words live in
// `lib/marketing/strings` and each card states its `tier`, so a bullet is a bare string in an
// `adds: [ … ]` block under a `tier: 'plus',` line.
//
// THAT MAKES CHECK 5c STRONGER RATHER THAN WEAKER. It used to compare a claim's prefix against a
// card's LABEL — a join on rendered copy, which the pricing page has two other notes about — and
// it now compares against the card's own `tier`. Same question, no string comparison.
//
// AND THE FAILURE MODE WAS MEASURED. When the table changed shape and this function still looked
// for the old one, `open` did not match, the guard below fired, and every claim reported as
// missing from `/pricing` — loudly, which is the right way round. A scan that had silently found
// zero would have passed.
// POSIX, deliberately: this string is printed in findings as well as used to open the file, and
// `join()` on win32 would put backslashes into a path a reader is meant to paste.
const PRICING_FILE = 'app/(marketing)/pricing/page.tsx'

function pricingClaims() {
  const src = readFileSync(join(ROOT, PRICING_FILE), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const open = src.indexOf('const PLAN_SHAPES: readonly {')
  if (open === -1) {
    fail('plan claims', `${PRICING_FILE} no longer declares \`const PLAN_SHAPES: readonly {\`. `
      + `This check reads that table as text and has just stopped reading anything — which `
      + `would otherwise be a silent pass, so it is a finding.`)
    return new Map()
  }
  const end = src.indexOf('\n]\n', open)
  const seg = src.slice(open, end === -1 ? undefined : end)

  // ONE PASS, tracking the card. `tier: '<tier>'` is the first field of every entry in this
  // table, so the most recent one is the card a claim sits in.
  //
  // A claim is matched as a quoted string CONTAINING A SLASH, which is what distinguishes a
  // bullet from the other bare strings in the block — `inheritsFrom: 'Plus'`, `icon: 'crown'`,
  // `accent: 'legacy'`. Narrow enough to be exact and wide enough that a new field cannot be
  // mistaken for a bullet unless somebody puts a slash in it.
  const byTier = new Map()
  let tier = null
  for (const m of seg.matchAll(/tier: '([a-z]+)'|'([a-z-]+\/[a-z0-9-]+)'/g)) {
    if (m[1] !== undefined) { tier = m[1]; continue }
    if (!byTier.has(tier)) byTier.set(tier, [])
    byTier.get(tier).push(m[2])
  }
  return byTier
}

const cardClaims = pricingClaims()

// 5c — a claim's prefix names the card it is on. Checked FIRST, because 5a compares by prefix
// and a mis-filed bullet would otherwise be reported as two unrelated set differences.
//
// THE CARD IS IDENTIFIED BY ITS `tier` NOW, not by its label. See `pricingClaims()`: the join on
// `TIER_LABEL` was a comparison against rendered copy, and the table states the tier itself.
for (const [tier, claims] of cardClaims) {
  if (!TIERS.includes(tier)) {
    fail('plan claims',
      `${PRICING_FILE} has a card whose tier is '${tier}', carrying ${claims.length} claim(s), `
        + `and that is not one of the four (${TIERS.join(', ')}). \`FamilyTier\` in lib/tiers.ts `
        + `is the whole vocabulary.`)
    continue
  }
  for (const claim of claims) {
    if (claim.startsWith(`${tier}/`)) continue
    fail('plan claims',
      `${PRICING_FILE}: the ${TIER_LABEL[tier]} card carries the claim '${claim}', whose prefix names `
        + `a different tier. A bullet moved between cards has to take its id with it, or the `
        + `two lists agree while selling the same thing at two prices.`)
  }
}

// 5a and 5b — the sets match, per tier, and neither list says one thing twice.
const dupes = list => list.filter((c, i) => list.indexOf(c) !== i)
for (const tier of TIERS) {
  const sold = cardClaims.get(tier) ?? []
  const told = [...(PLAN_ADD_CLAIMS[tier] ?? [])]

  for (const [where, list] of [[`${PRICING_FILE} PLANS[]`, sold], ['lib/plans.ts PLAN_ADD_CLAIMS', told]]) {
    for (const claim of new Set(dupes(list))) {
      fail('plan claims', `${where} lists the claim '${claim}' twice under ${tier}. That card `
        + `says one thing twice, and both copies drift.`)
    }
  }

  // 5c, the other side. `PLAN_ADD_CLAIMS` is a Record keyed by tier, so its filing is enforced by
  // the type — but the PREFIX is a string and nothing makes it agree with the key it sits
  // under. Left unchecked, a bullet moved between tiers in this file with its old prefix
  // intact would report as two clean set differences and read as two unrelated edits.
  for (const claim of told) {
    if (claim.startsWith(`${tier}/`)) continue
    fail('plan claims',
      `lib/plans.ts PLAN_ADD_CLAIMS.${tier} carries the claim '${claim}', whose prefix names a `
        + `different tier. The prefix is what makes a re-pricing visible; keep it with the key.`)
  }

  const missingInProduct = sold.filter(c => !told.includes(c))
  const missingOnPricing = told.filter(c => !sold.includes(c))

  // THE EXPENSIVE DIRECTION FIRST, and it is expensive rather than untidy: a benefit sold on
  // /pricing and absent from PLAN_ADDS is a family paying for something the product never
  // tells them they have. That is one of the two drifts this was built for — a Premium bullet
  // went missing in-product and nobody found it from inside the product.
  for (const claim of missingInProduct) {
    fail('plan claims',
      `'${claim}' is sold on /pricing and is in no PLAN_ADDS.${tier} bullet. A family on `
        + `${TIER_LABEL[tier]} is paying for it and is never told inside the product that they `
        + `have it. Add the member-facing wording to lib/plans.ts — the words, not the same `
        + `words.`)
  }
  for (const claim of missingOnPricing) {
    fail('plan claims',
      `'${claim}' is in PLAN_ADDS.${tier} and is on no /pricing bullet. Either the card is `
        + `underselling the tier, or the claim outlived the copy that made it — both are `
        + `edits, and doing neither leaves two lists disagreeing about the offer.`)
  }
}

// ---------------------------------------------------------------- report

const byTier = t => live.filter(f => f.tier === t).length
const claimCount = [...cardClaims.values()].reduce((n, c) => n + c.length, 0)
console.log(
  `Walked ${live.length} live features ` +
    `(free ${byTier('free')}, standard ${byTier('standard')}, plus ${byTier('plus')}, ` +
    `premium ${byTier('premium')}), ${cards.length} catalogue cards, ` +
    `${Object.keys(SOLD_ELSEWHERE).length} stated allowances, ` +
    `${claimCount} pricing claims against ${TIERS.reduce((n, t) => n + PLAN_ADD_CLAIMS[t].length, 0)} ` +
    `in-product ones.`,
)

// The allowances are PRINTED, not merely counted. `help:check` does the same with its three,
// for the same reason: a skip that scrolls past as a number is a skip nobody re-reads, and
// this list is the whole of the judgement this check declines to make.
for (const [route, why] of Object.entries(SOLD_ELSEWHERE).sort()) {
  console.log(`  sold elsewhere  ${route.padEnd(32)} ${why.replace(/\s+/g, ' ')}`)
}

if (findings.length === 0) {
  console.log('\nEvery live feature is on a marketing surface, and the two plan lists sell '
    + 'the same things.')
  process.exit(0)
}

console.error(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}:\n`)
for (const f of findings) console.error(`  [${f.check}] ${f.message}`)
process.exit(1)
