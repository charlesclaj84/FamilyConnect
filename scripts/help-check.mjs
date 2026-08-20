/**
 * The how-to manual, checked mechanically.
 *
 *     npm run help:check
 *
 * WHY THIS EXISTS
 *   AGENTS.md says a change to a screen owes an edit to the chapter that documents it, and
 *   until this file that rule had exactly the enforcement `db:check` had before it existed:
 *   none. Two of the things it asks for are mechanical, and a checkable rule and an
 *   uncheckable one decay at very different rates.
 *
 * WHAT IT CANNOT ASSERT, said first so a green run is never read as more than it is:
 *   THAT THE PROSE STILL DESCRIBES THE SCREEN. Nothing can. The value of this check is that
 *   it takes the mechanical half off a reviewer's desk so the unmechanical half gets their
 *   attention — not that passing means the manual is true.
 *
 * WHAT IT DOES ASSERT
 *   1. every internal `[label](/target)` resolves — a `/help/<slug>` to a real chapter, a
 *      `#anchor` to a real section id IN THAT CHAPTER, anything else to a route
 *      `getFeature()` knows;
 *   2. every chapter's `route` is registered in FEATURES, by exact href, and no two
 *      chapters claim the same route;
 *   3. no two chapters share a slug, no two parts share an id, and no two sections share an
 *      id within one chapter;
 *   4. no unrendered markup in the five fields the pages interpolate raw;
 *   5. every LIVE feature has a chapter, or an allow entry here saying why it does not;
 *   6. every `<HelpLink slug="…" section="…">` PLACED IN THE APP resolves to a real chapter
 *      and, where a section is given, to a real section id in that chapter.
 *
 * ── WHAT CHECK 6 IS FOR, AND WHY IT IS THE ONLY THING THAT COULD DO IT ──────────────
 * `components/help/HelpLink.tsx` deliberately does not import `lib/help/content.ts`: most of
 * its call sites are `'use client'` components, and importing the manual to validate a prop
 * would bundle all ~79KB of prose into every one of them. So its two props are plain
 * strings, and **nothing at build time or run time can tell you that a `section=` still
 * names a real anchor.** A renamed section id leaves a link that loads the right chapter and
 * silently does not scroll, which reads to a member as the manual having lost the paragraph
 * they were sent to. This check is the whole of the enforcement.
 *
 * The top bar's `ContextHelpLink` needs none of it — it resolves through
 * `HELP_ROUTE_INDEX`, which is DERIVED from the chapters, so it cannot name one that is not
 * there.
 *
 * ── WHAT IT DELIBERATELY DOES NOT ASSERT ───────────────────────────────────────────
 * That every chaptered screen RENDERS a help affordance. Two reasons, and the second is the
 * one that decides it:
 *
 *   * The top-bar icon already covers every chaptered route by construction — it resolves
 *     the current path against `HELP_ROUTE_INDEX` on every screen — so the coverage the
 *     assertion would be protecting is a property of one component, not of 19 pages.
 *   * It could only be a check on JSX PLACEMENT: "this file contains this element". Any
 *     legitimate refactor — extracting a header component, moving a pane into its own file,
 *     splitting a client component — turns it red while the product is unchanged, and a
 *     gate that goes red for correct work is a gate people learn to route around. The
 *     placed links are a deliberate, sparing set (see HelpLink's header); "is there one
 *     here?" is a judgement, and this file only ever checks the mechanical half.
 *
 * ── WHY A SCRIPT AND NOT A vitest TEST ──────────────────────────────────────────────────
 * `lib/help/content.ts` genuinely is a pure `lib/` module, so AGENTS.md §7b's boundary would
 * admit it and `lib/help/inline.test.ts` already lives there. Three things decided it the
 * other way:
 *
 *   * OUTPUT. For 47 links, `expected [ … ] to equal []` is much worse than a named finding
 *     carrying the href, the label and the chapter it sits in. A checker's output exists to
 *     be read.
 *   * FAMILY. `db:check`, `email:check` and `art:check` are all `node scripts/*.mjs`, all
 *     exit 1 on a finding, and all are runnable mid-edit by somebody with no test-runner
 *     model in their head. TODO.md asked for exactly this shape.
 *   * §7b's own reasoning cuts both ways: vitest's `include` is a BOUNDARY around pure
 *     modules, not an invitation to move every assertion in the repo inside it.
 *
 * `npm test` was separately added to verify.yml in the same change, because 123 green tests
 * that CI had never run was a real gap either way — and it is the fact that would otherwise
 * have decided this argument by default rather than on its merits.
 *
 * ── HOW IT READS TYPESCRIPT WITHOUT A BUILD STEP ────────────────────────────────────────
 * Node 24 strips types natively, and `lib/help/content.ts` and `lib/help/inline.ts` have no
 * imports at all, so both load directly. `lib/features.ts` does not: it imports `@/lib/brand`
 * and `@/lib/tiers`, and node does not read `tsconfig.json`'s `paths` — a bare import fails
 * with ERR_MODULE_NOT_FOUND. Hence the twelve-line resolve hook below, which is the same one
 * `tests/rls/hooks.mjs` has carried since the RLS suite was written.
 *
 * It is registered from a `data:` URL so this stays ONE file. That matters on win32, where
 * `--import ./some/path.mjs` fails outright with ERR_UNSUPPORTED_ESM_URL_SCHEME on the
 * drive letter — which is also why the hook builds `file://` URLs with `pathToFileURL`
 * rather than handing bare paths back to the loader.
 *
 * NO NEW DEPENDENCY, deliberately: not `tsx`, not a markdown parser. Both sibling scripts are
 * dependency-free by explicit decision, and `art:check` is kept out of verify.yml precisely
 * because it needs `sharp` — a gate a legitimate `npm ci --omit=optional` turns red is a gate
 * people learn to ignore. This one needs nothing but node.
 *
 * AND NO SECOND LINK PARSER. `parseInline` from `lib/help/inline.ts` is imported rather than
 * re-implemented, so the checker and the page cannot disagree about what a link is. A regex
 * over the file text would also flag `content.ts`'s own doc-comment example `[a link](/route)`
 * on day one, which is the sharpest argument for walking the data instead of the source.
 *
 * ── CHECKED BY MUTATION, per AGENTS.md §7 ───────────────────────────────────────────────
 * A green run is not evidence until it has been seen to fail. Ten mutations, each of which
 * tripped its own check and only its own (2026-08-17):
 *
 *   1. a link to `/help/nonsense`                          -> links
 *   2. a link to `/help/plans#nope`                        -> links
 *   3. a link to `/not-a-route`                            -> links
 *   4. a chapter route of `/admin/nonexistent`             -> chapter routes (NOT the
 *                                                             `/admin` catch-all passing it)
 *   5. two sections in one chapter sharing an id           -> ids
 *   6. two chapters sharing a slug                         -> ids
 *   7. `**bold**` in a chapter summary                     -> raw fields
 *   8. the `/admin/event-types` allow entry deleted        -> undocumented screens
 *   9. two chapters claiming `/personal-info`              -> chapter routes
 *  10. a block kind the walker does not know               -> exit 2, by name
 *
 * The two false positives it is one line of code away from producing were confirmed absent in
 * the same pass: `content.ts`'s doc-comment `[a link](/route)` is not among the 47 links, and
 * the two `?section=` links resolve rather than failing `getFeature()`.
 *
 * Checks 6 and the route-uniqueness half of 2 were added later and checked the same way
 * (2026-08-17):
 *
 *  11. `slug="my-dues"` -> `slug="my-duez"` on the /dues placement   -> help links
 *  12. `section="next-payment"` -> `section="next-paymnt"`           -> help links
 *  13. `section="templates"` moved onto the wrong chapter
 *      (`slug="members-and-access" section="bloodline"`)             -> help links, naming
 *                                                                       the chapter it is
 *                                                                       not in
 *  14. a second chapter given `route: '/accounting/dues'`                       -> chapter routes
 *
 * Two false positives were confirmed absent while writing 6: `HelpLink.tsx`'s own doc
 * comment quotes `slug=` and `section=` in prose and is not counted (the scan requires an
 * opening `<HelpLink` tag), and `variant="inline"` sitting between the two props does not
 * break the extraction.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { register } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

// ---------------------------------------------------------------- the `@/` hook
//
// Inlined as source so it can be registered from a data: URL — see the header. Kept
// deliberately identical in behaviour to tests/rls/hooks.mjs, extension list included: a
// second, subtly different alias resolver is how two runners come to disagree about which
// file `@/lib/features` means.
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

// AFTER register(), which is load-bearing: a hook registered later cannot resolve an import
// that has already been evaluated.
const { HELP_PARTS, HELP_CHAPTERS } = await import(
  pathToFileURL(join(ROOT, 'lib', 'help', 'content.ts')).href
)
const { parseInline } = await import(
  pathToFileURL(join(ROOT, 'lib', 'help', 'inline.ts')).href
)
const { FEATURES, getFeature } = await import(
  pathToFileURL(join(ROOT, 'lib', 'features.ts')).href
)

// ---------------------------------------------------------------- findings

const findings = []
const notes = []

function fail(check, message, detail) {
  findings.push({ check, message, detail })
}

// ---------------------------------------------------------------- the walker
//
// EVERY string the manual holds, with a human-readable location and the chapter it belongs
// to (needed to resolve a bare `#anchor`). The switch over block kinds is exhaustive on
// purpose: a kind added later that this silently skipped would be a set of links nobody
// checks, which is the failure mode the whole file exists to prevent. `default` therefore
// raises rather than shrugging.
function* strings() {
  for (const part of HELP_PARTS) {
    yield { where: `part ${part.id} · title`, text: part.title, chapter: null, raw: true }
    yield { where: `part ${part.id} · blurb`, text: part.blurb, chapter: null, raw: true }
  }

  for (const chapter of HELP_CHAPTERS) {
    const at = `chapter ${chapter.slug}`
    yield { where: `${at} · title`, text: chapter.title, chapter, raw: true }
    yield { where: `${at} · summary`, text: chapter.summary, chapter, raw: true }

    for (const section of chapter.sections) {
      const sec = `${at}#${section.id}`
      yield { where: `${sec} · heading`, text: section.heading, chapter, raw: true }

      for (const [i, block] of section.blocks.entries()) {
        const b = `${sec} · block ${i + 1} (${block.kind})`
        switch (block.kind) {
          case 'text':
          case 'note':
            yield { where: b, text: block.text, chapter, raw: false }
            break
          case 'steps':
          case 'bullets':
            for (const [j, item] of block.items.entries()) {
              yield { where: `${b} item ${j + 1}`, text: item, chapter, raw: false }
            }
            break
          case 'defs':
            for (const [j, item] of block.items.entries()) {
              yield { where: `${b} item ${j + 1} term`, text: item.term, chapter, raw: false }
              yield { where: `${b} item ${j + 1} text`, text: item.text, chapter, raw: false }
            }
            break
          default:
            throw new Error(
              `help-check does not know how to walk block kind '${block.kind}' at ${sec}. ` +
              'Add it to the switch in strings() — a kind this walker skips is a set of ' +
              'links and markup nobody is checking.',
            )
        }
      }
    }
  }
}

const SECTION_IDS = new Map(
  HELP_CHAPTERS.map(c => [c.slug, new Set(c.sections.map(s => s.id))]),
)
/** Matches components/help/HelpProse.tsx exactly. Anything else goes through next/link. */
const EXTERNAL = /^https?:\/\//

// ---------------------------------------------------------------- 1. links

function checkLinks() {
  let internal = 0
  let external = 0
  const broken = []
  const future = []

  for (const { where, text, chapter } of strings()) {
    for (const token of parseInline(text)) {
      if (token.kind !== 'link') continue
      const { href, text: label } = token

      if (EXTERNAL.test(href)) {
        external += 1
        continue
      }
      internal += 1

      // HASH FIRST, THEN QUERY, and both before anything resolves. `getFeature()` is a
      // literal equality-or-prefix test, so it answers undefined for
      // `/personal-info?section=security` — a link the manual really carries, twice. Without
      // this split those are two false findings.
      const [beforeHash, hash = ''] = splitOnce(href, '#')
      const [path] = splitOnce(beforeHash, '?')
      const at = `${where}: [${label}](${href})`

      if (path === '' && hash) {
        // A bare `#anchor` resolves against the chapter it is written in.
        if (!chapter) {
          broken.push(`${at} — a bare #anchor outside a chapter has nothing to resolve against`)
        } else if (!SECTION_IDS.get(chapter.slug)?.has(hash)) {
          broken.push(`${at} — no section '${hash}' in chapter '${chapter.slug}'`)
        }
        continue
      }

      if (!path.startsWith('/')) {
        // next/link would resolve this against /help/<slug>, which is never what was meant.
        broken.push(`${at} — relative hrefs are resolved against /help/<slug>; write an absolute path`)
        continue
      }

      // THE /help BRANCH MUST COME BEFORE getFeature(), and this is the trap that makes the
      // whole assertion worth having: getFeature() longest-prefix-matches, so
      // `/help/anything-at-all` resolves to the live `/help` entry and a bare fallthrough
      // would pass a chapter that does not exist.
      if (path === '/help') continue
      if (path.startsWith('/help/')) {
        const slug = path.slice('/help/'.length).replace(/\/$/, '')
        const ids = SECTION_IDS.get(slug)
        if (!ids) {
          broken.push(`${at} — no chapter with slug '${slug}'`)
        } else if (hash && !ids.has(hash)) {
          broken.push(`${at} — chapter '${slug}' has no section '${hash}'`)
        }
        continue
      }

      const feature = getFeature(path)
      if (!feature) {
        broken.push(`${at} — '${path}' is not a route lib/features.ts knows`)
        continue
      }
      // NOT a finding. proxy.ts sends an unshipped route to a real Coming Soon screen, so
      // the link works — but unlike a chapter, whose availability badge names the wall in
      // the way, the reader arrives with no explanation. Reported so it stays visible.
      if (feature.status === 'future') {
        future.push(`${at} — resolves to '${feature.href}', which has not shipped`)
      }
    }
  }

  notes.push(`${internal} internal link(s) resolved · ${external} external link(s) not checked`)
  for (const f of future) notes.push(`link to an unshipped route — ${f}`)

  if (!broken.length) return true
  fail('links', `${broken.length} internal link(s) point at nothing`, broken)
  return false
}

function splitOnce(value, separator) {
  const at = value.indexOf(separator)
  return at < 0 ? [value, undefined] : [value.slice(0, at), value.slice(at + 1)]
}

// ---------------------------------------------------------------- 2. chapter routes

/**
 * EXACT href membership, not `getFeature()`.
 *
 * `getFeature('/admin/nonexistent')` resolves to the `/admin` catch-all entry, so a prefix
 * test would pass a route that does not exist — which is the one mistake this check is for.
 * TODO.md's wording is "registered in FEATURES", and that is the literal test.
 *
 * `status` is deliberately not required to be 'live': a chapter documenting an unshipped
 * screen is legal, and `lib/help/availability.ts` exists to label it Coming Soon.
 */
function checkChapterRoutes() {
  const hrefs = new Set(FEATURES.map(f => f.href))
  const bad = []
  const seen = new Map()

  for (const chapter of HELP_CHAPTERS) {
    if (!chapter.route) continue
    if (!hrefs.has(chapter.route)) {
      bad.push(`chapter '${chapter.slug}' names route '${chapter.route}', which is not a FEATURES href`)
    }
    // Two chapters on one route silently lose one of them from `HELP_ROUTE_INDEX`
    // (lib/help/routes.ts), which the top bar's help icon resolves the current path
    // against — it would point at whichever chapter happened to be declared first, on a
    // screen the other one documents. Nothing else in the app reads a route twice, so this
    // is the only place that mistake is visible.
    if (seen.has(chapter.route)) {
      bad.push(`route '${chapter.route}' is claimed by both '${seen.get(chapter.route)}' and '${chapter.slug}'`)
    } else {
      seen.set(chapter.route, chapter.slug)
    }
  }

  if (!bad.length) return true
  fail('chapter routes', `${bad.length} chapter route problem(s)`, bad)
  return false
}

// ---------------------------------------------------------------- 3. ids

/**
 * SECTION IDS ARE SCOPED TO THEIR CHAPTER, AND MUST NOT BE ASSERTED GLOBALLY UNIQUE.
 *
 * The anchor is `/help/<slug>#<id>`, so `what-it-is` appearing in four chapters is correct
 * rather than an oversight — as are `signed-out`, `reading`, `adding`, `deleting`,
 * `templates`, `approving` and `reversals`. A global rule fails eight times on the day it
 * ships, and worse, a global anchor SET would let `/help/summary#reversals` pass while that
 * anchor does not exist there.
 *
 * Chapter slug `events` equals part id `events`, which is also fine: the contents page
 * namespaces part anchors as `part-${part.id}`.
 */
function checkIds() {
  const bad = []

  bad.push(...duplicates(HELP_CHAPTERS.map(c => c.slug)).map(s => `two chapters share the slug '${s}'`))
  bad.push(...duplicates(HELP_PARTS.map(p => p.id)).map(s => `two parts share the id '${s}'`))

  for (const chapter of HELP_CHAPTERS) {
    for (const id of duplicates(chapter.sections.map(s => s.id))) {
      bad.push(`chapter '${chapter.slug}' has two sections with the id '${id}'`)
    }
  }

  if (!bad.length) return true
  fail('ids', `${bad.length} duplicate identifier(s)`, bad)
  return false
}

function duplicates(values) {
  const seen = new Set()
  const dupes = new Set()
  for (const v of values) {
    if (seen.has(v)) dupes.add(v)
    seen.add(v)
  }
  return [...dupes]
}

// ---------------------------------------------------------------- 4. raw fields

/**
 * Five fields are interpolated RAW by the pages — part title and blurb, chapter title and
 * summary, section heading — while `generateMetadata` runs them through `stripInline`. So
 * `**bold**` or `[a](/b)` in any of them renders as the literal characters on screen and
 * disappears from the meta description, which is the one way this file can be silently
 * wrong rather than loudly broken.
 */
function checkRawFields() {
  const bad = []
  for (const { where, text, raw } of strings()) {
    if (!raw) continue
    if (parseInline(text).some(t => t.kind !== 'text')) {
      bad.push(`${where} carries inline markup, and this field is rendered raw: ${JSON.stringify(text)}`)
    }
  }
  if (!bad.length) return true
  fail('raw fields', `${bad.length} field(s) carry markup that will not render`, bad)
  return false
}

// ---------------------------------------------------------------- 5. undocumented screens

/**
 * The check that catches the actual regression the help rule is about — a screen shipping
 * with no chapter.
 *
 * `future` entries are exempt by construction: a chapter about an unshipped screen is
 * allowed but not owed. The live exemptions below each have a reason, stated here in
 * the `positive: 'not-applicable'` + `why` shape AGENTS.md §7 endorses, and REPORTED as a
 * note rather than skipped silently — a gap has to stay visible or it blends into the green.
 *
 * Adding a route here is a decision, not a formality. The question to answer first is
 * whether the screen is genuinely documented somewhere a reader would find it.
 *
 * THERE ARE NOW TWO KINDS OF ENTRY ON THIS LIST, and the second arrived on 2026-08-20. The
 * original kind is a route documented in ANOTHER chapter — a redirect, or a registry row that
 * is not a route at all — where the manual is complete and a chapter of its own would claim a
 * screen that does not exist. The second kind is a route that is documented NOWHERE, and it
 * is a real gap held open on purpose: six screens came off `status: 'future'` in
 * lib/features.ts that day, into the rail's Review section, precisely because nobody had been
 * through them. Writing six chapters first would have the manual describe screens no person
 * has walked, which is worse than a gap that says so on every run.
 *
 * THE SECOND KIND IS TEMPORARY AND OWES A CHAPTER. Each of the six is removed from this list
 * by the commit that reviews its screen and writes it up — which is the same commit that
 * moves its row out of Review in components/layout/Sidebar.tsx. Do not let one of them settle
 * here: an allowance that stops being read as a debt is how a live screen goes undocumented
 * for good, which is the one regression this whole check exists to catch.
 */
const UNDOCUMENTED_OK = {
  '/help': 'the manual itself — there is no chapter about the chapters',
  '/admin/members/approvals':
    'the path is a redirect into Members & Access\'s Pending Approval tab, which is ' +
    'documented at members-and-access#approving',
  // NOT A ROUTE AT ALL, and the only entry on this list of that kind. The `lib/features.ts`
  // row for `/reporting/transactions/fund-transfers` exists solely to carry `tier: 'plus'` for the
  // sub-key — `tierAllows()` resolves a key through `getFeature()`'s longest-prefix match,
  // so without a row of its own the ledger would inherit `/reporting/transactions` and be Free. The
  // ledger itself is a pane on `/reporting/transactions?ledger=transfers` and is documented with the
  // other four, in the chapter for the page it is actually on.
  '/reporting/transactions/fund-transfers':
    'not a route — a registry row carrying the Plus tier for the Fund Transfers ledger, ' +
    'which is documented with the other four at transactions#ledgers',
  // TWO MORE OF THE SAME KIND, added 2026-08-19 with the Standard plan. Both are
  // `lib/features.ts` rows whose only job is to carry a tier for a sub-key that has no route
  // of its own — the device the entry above describes — and both surfaces ARE documented, in
  // the chapter for the screen they are actually part of. An allowance rather than a chapter,
  // because a chapter for a non-route would appear in the contents as a screen a member can
  // open, which is the one thing the manual must not claim.
  '/admin/members/templates':
    'not a route — a registry row carrying the Standard tier for the Permission Templates ' +
    'pane of Members & Access, which is documented at members-and-access#templates',
  '/gatherings/budget':
    'not a route — a registry row carrying the Standard tier for the money band on a ' +
    'gathering, which is documented at gatherings#budget',

  // ── THE ROUTES IN THE RAIL'S REVIEW SECTION, 2026-08-20 ────────────────────────────
  // Each of these is a real screen with a real chapter owed. See the note above for why the
  // chapter is not being written in advance of the review, and remove the entry in the same
  // commit that writes it.
  //
  // SIX WENT ON THIS LIST AND TWO CAME STRAIGHT BACK OFF, which is the mechanism working:
  // `/reporting/pl-summary` was reviewed, renamed P&L Summary and given the `p-and-l-summary`
  // chapter, and `/admin/reports` was reviewed and deleted, so it is no longer a FEATURES
  // href at all — the mirror check below would have failed the run if the allowance had been
  // left behind, which is exactly what that check is for.
  '/review/photos':
    'live but unreviewed — in the Review section of the rail since 2026-08-20; a chapter is ' +
    'owed and is written by the commit that reviews the screen',
  '/review/documents':
    'live but unreviewed — in the Review section of the rail since 2026-08-20; a chapter is ' +
    'owed and is written by the commit that reviews the screen',
  '/review/elections':
    'live but unreviewed — in the Review section of the rail since 2026-08-20; a chapter is ' +
    'owed and is written by the commit that reviews the screen',
  '/review/election-management':
    'live but unreviewed — in the Review section of the rail since 2026-08-20; a chapter is ' +
    'owed and is written by the commit that reviews the screen',
}

function checkUndocumented() {
  const documented = new Set(HELP_CHAPTERS.map(c => c.route).filter(Boolean))
  const bad = []
  let allowed = 0
  const stale = []

  for (const feature of FEATURES) {
    if (feature.status !== 'live') continue
    if (documented.has(feature.href)) continue
    if (feature.href in UNDOCUMENTED_OK) {
      allowed += 1
      continue
    }
    bad.push(
      `'${feature.href}' (${feature.label}) is live and no chapter documents it — write one, ` +
      'or add it to UNDOCUMENTED_OK in this script with a reason',
    )
  }

  // The mirror failure: an allow entry for a route that now HAS a chapter, or no longer
  // exists. Left alone it would quietly excuse a future gap on the same href.
  for (const href of Object.keys(UNDOCUMENTED_OK)) {
    if (documented.has(href)) stale.push(`${href} — now has a chapter; remove the allow entry`)
    else if (!FEATURES.some(f => f.href === href)) stale.push(`${href} — no longer a FEATURES href`)
  }

  notes.push(`${allowed} live route(s) with no chapter of their own, by explicit allowance:`)
  for (const [href, why] of Object.entries(UNDOCUMENTED_OK)) {
    notes.push(`  ${href} — ${why}`)
  }

  if (stale.length) bad.push(...stale)
  if (!bad.length) return true
  fail('undocumented screens', `${bad.length} problem(s)`, bad)
  return false
}

// ---------------------------------------------------------------- 6. placed help links

/**
 * `<HelpLink slug="…" section="…">` sites in the app, resolved against the real chapters.
 *
 * ── THE MATCHING RULE, STATED BECAUSE A FALSE FINDING HERE IS WORSE THAN A MISS ─────
 * This reads JSX as TEXT. There is no parser and there will not be one: adding a TypeScript
 * or Babel dependency to this file to read two string props would cost the property the
 * header opens with, which is that it needs nothing but node.
 *
 * So the rule is deliberately narrow, and everything it cannot read with certainty is
 * REPORTED AS A NOTE rather than as a finding:
 *
 *   * A site is an opening `<HelpLink` tag. The identifier alone is not enough — the
 *     component's own doc comment discusses `slug=` and `section=` in prose, and the import
 *     line names it too.
 *   * The tag is the text from `<HelpLink` up to the first `/>` after it, capped at
 *     `TAG_WINDOW` characters. `HelpLink` takes no children and every call site is
 *     self-closing; a site with no `/>` in range is a note, not a finding, because it means
 *     this rule failed to read the code rather than that the code is wrong.
 *   * Within that window, `slug` and `section` are read only as plain double-quoted
 *     literals. A computed value (`slug={x}`) is a note — the check cannot resolve it and
 *     must not claim it is broken. There are none today and this is what would say so.
 *
 * The consequence to be honest about: a call site written in a way this cannot read is not
 * checked, and the note is the only thing that says so. That is the correct direction — a
 * checker that cries wolf on legal code stops being run at all.
 */
const SCAN_DIRS = ['app', 'components']
const SCAN_EXTENSIONS = ['.ts', '.tsx']
/** Generous enough for a formatted six-prop tag, tight enough to never span two elements. */
const TAG_WINDOW = 900

function* sourceFiles() {
  for (const dir of SCAN_DIRS) {
    yield* walk(join(ROOT, dir))
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      yield* walk(full)
    } else if (SCAN_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      yield full
    }
  }
}

function checkHelpLinks() {
  const bad = []
  const unreadable = []
  let sites = 0

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8')
    const where = relative(ROOT, file).replace(/\\/g, '/')

    let from = 0
    for (;;) {
      const open = source.indexOf('<HelpLink', from)
      if (open < 0) break
      from = open + 1

      // Not a `<HelpLink…` tag but something longer that starts the same way — there is no
      // such component today, and a `<HelpLinkRow` added later must not be misread as one.
      const after = source[open + '<HelpLink'.length]
      if (after && /[A-Za-z0-9_]/.test(after)) continue

      sites += 1
      const window = source.slice(open, open + TAG_WINDOW)
      const end = window.indexOf('/>')
      if (end < 0) {
        unreadable.push(`${where}: a <HelpLink at offset ${open} has no '/>' within ${TAG_WINDOW} characters — not checked`)
        continue
      }
      const tag = window.slice(0, end)
      const line = source.slice(0, open).split('\n').length
      const at = `${where}:${line}`

      const slug = literalProp(tag, 'slug')
      const section = literalProp(tag, 'section')

      if (slug === null) {
        unreadable.push(`${at}: slug is not a plain string literal — not checked`)
        continue
      }
      const ids = SECTION_IDS.get(slug)
      if (!ids) {
        bad.push(`${at}: slug="${slug}" is not a chapter slug`)
        continue
      }
      // `section` absent is legal — the link lands at the top of the chapter. Present and
      // not a literal is not, for this check's purposes: it is a note.
      if (section === undefined) continue
      if (section === null) {
        unreadable.push(`${at}: section is not a plain string literal — not checked`)
        continue
      }
      if (!ids.has(section)) {
        // Named against THAT chapter, never globally: `what-it-is` exists in four chapters
        // and `templates` in two, so a global set would pass a real mispairing. See checkIds.
        bad.push(`${at}: chapter '${slug}' has no section '${section}'`)
      }
    }
  }

  notes.push(`${sites} placed <HelpLink> site(s) found in ${SCAN_DIRS.join('/ and ')}/`)
  for (const u of unreadable) notes.push(`unchecked help link — ${u}`)

  if (!bad.length) return true
  fail('help links', `${bad.length} placed help link(s) point at nothing`, bad)
  return false
}

/**
 * `undefined` when the prop is absent, `null` when it is present but not a plain
 * double-quoted literal, otherwise its value.
 *
 * The three answers are distinct on purpose: absent is legal, unreadable is a note, and a
 * value is the only thing that gets resolved. Collapsing the first two would either report
 * every omitted `section` or silently skip a computed one.
 */
function literalProp(tag, name) {
  const present = new RegExp(`(^|\\s)${name}\\s*=`).exec(tag)
  if (!present) return undefined
  const literal = new RegExp(`(^|\\s)${name}\\s*=\\s*"([^"]*)"`).exec(tag)
  return literal ? literal[2] : null
}

// ---------------------------------------------------------------- go

function main() {
  const quiet = process.argv.includes('--quiet')
  const line = (ok, label) => {
    if (!quiet) console.log(`  ${ok ? 'ok      ' : 'FAIL    '} ${label}`)
  }

  const sections = HELP_CHAPTERS.reduce((n, c) => n + c.sections.length, 0)
  console.log(`\n  manual   ${HELP_PARTS.length} part(s) · ${HELP_CHAPTERS.length} chapter(s) · ${sections} section(s)`)
  console.log(`  routes   ${HELP_CHAPTERS.filter(c => c.route).length} chapter(s) document one screen\n`)

  line(checkLinks(), 'every internal link resolves to a chapter, an anchor or a route')
  line(checkChapterRoutes(), 'every chapter route is in lib/features.ts, and is claimed by one chapter')
  line(checkIds(), 'no duplicate chapter slug, part id, or section id within a chapter')
  line(checkRawFields(), 'no unrendered markup in a field the pages interpolate raw')
  line(checkUndocumented(), 'every live screen has a chapter, or a stated reason not to')
  line(checkHelpLinks(), 'every placed <HelpLink> resolves to a real chapter and section')

  for (const note of notes) console.log(`\n  note     ${note}`.replace(/\n\s+note\s+ {2}/, '\n           '))

  if (!findings.length) {
    console.log('\n  Clean. NOTE: this says nothing about whether the prose still describes the screen.\n')
    return 0
  }

  console.log(`\n  ${findings.length} finding(s):\n`)
  for (const f of findings) {
    console.log(`  ── ${f.check}: ${f.message}`)
    for (const d of f.detail ?? []) console.log(d ? `       ${d}` : '')
    console.log('')
  }
  return 1
}

/**
 * `process.exitCode`, never `process.exit()` — the same reason scripts/migrations.mjs and
 * scripts/auth-templates.mjs both give: exiting while output is still draining loses it on
 * Windows, and a checker whose findings do not reach the log is worse than no checker.
 */
try {
  process.exitCode = main()
} catch (error) {
  console.error(`\n  ${error.message}\n`)
  process.exitCode = 2
}
