#!/usr/bin/env node
/**
 * Does `app/sitemap.ts`'s `lastModified` still describe the pages it stamps?
 *
 *     npm run sitemap:check
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────
 * The sitemap's ROUTE COVERAGE cannot drift: it maps `MARKETING_ROUTES`, the same list the
 * header and footer render, so a page added to the nav is in the sitemap by construction.
 * Its DATE is the opposite — a hand-typed literal, deliberately (a `new Date()` there would
 * stamp build time, and a `lastModified` that moves on every deploy is one crawlers learn to
 * ignore). A literal nobody is reminded to bump is a literal that rots, and this one did: it
 * read 2026-08-12 until 2026-08-21, by which point Events had been retired, the Standard tier
 * inserted, and four of the five marketing pages rewritten.
 *
 * So this is the reminder, as a test rather than a comment. It compares the stamp against the
 * newest commit touching anything the public pages render, and fails when the content is newer
 * than the claim.
 *
 * ── WHY IT COMPARES AGAINST GIT AND NOT FILE MTIMES ───────────────────────────────
 * A CI checkout writes every file at checkout time, so mtimes are all "now" and would report
 * everything as stale on every run. Git commit dates are the only record of when the CONTENT
 * changed that survives being copied onto a runner.
 *
 * ── IT DEGRADES TO A NOTICE, AND THAT IS DELIBERATE ───────────────────────────────
 * `actions/checkout` clones with `fetch-depth: 1` by default, which gives one commit and no
 * history — so `git log` over these paths finds nothing and the comparison is impossible. This
 * SKIPS with a visible notice in that case rather than failing, for the reason
 * `20260806000012` had to learn twice: a verify block that can skip must not be the only
 * check, and a skip must be VISIBLE rather than silent. Passing loudly-as-skipped is honest;
 * failing on a shallow clone would mean the fix is to weaken the guard.
 *
 * To make it actually run in CI, the workflow needs `fetch-depth: 0` on its checkout — which
 * verify.yml now sets. Locally it just works.
 *
 * ── WHAT IT CANNOT CHECK ──────────────────────────────────────────────────────────
 * Whether the change was to the COPY or to something invisible to a reader — a refactor, a
 * className, a comment. So a commit that only reformats `pricing/page.tsx` will ask for a bump
 * that SEO does not strictly need. That is the right way to be wrong: the cost is one edited
 * date, and the alternative is a checker that tries to judge whether prose changed meaningfully
 * and quietly gets it wrong in the other direction.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * What the public pages are built from. Not just `app/(marketing)` — the landing page lives at
 * `app/page.tsx`, every section of it is a component, and the plan copy and prices are
 * `lib/plans.ts`, which is what `/pricing` renders. A list that stopped at the route folder
 * would have missed the entire Standard-tier rewrite.
 */
const CONTENT_PATHS = [
  'app/page.tsx',
  'app/(marketing)',
  'components/marketing',
  'lib/plans.ts',
  'lib/marketing-nav.ts',
]

const SITEMAP = 'app/sitemap.ts'

function fail(msg) {
  console.error(`\n  \x1b[31mFAIL\x1b[0m  ${msg}\n`)
  process.exit(1)
}

// ── The stamp, read out of the source rather than by running it ────────────────
// Importing `app/sitemap.ts` would drag in `next` and the `@/` alias for one date.
const src = readFileSync(SITEMAP, 'utf8')
const stampMatch = src.match(/lastModified\s*=\s*new Date\('(\d{4}-\d{2}-\d{2})'\)/)
if (!stampMatch) {
  fail(
    `could not find a \`const lastModified = new Date('YYYY-MM-DD')\` in ${SITEMAP}.\n` +
    `        If the stamp has become derived rather than literal, delete this check — it is\n` +
    `        only worth having while the date is something a person has to remember.`
  )
}
const stamp = stampMatch[1]

// ── The newest commit behind the public pages ──────────────────────────────────
let newest = ''
try {
  newest = execFileSync(
    'git',
    ['log', '-1', '--date=short', '--format=%ad', '--', ...CONTENT_PATHS],
    { encoding: 'utf8' },
  ).trim()
} catch {
  // Not a git checkout at all. Same treatment as a shallow one.
}

console.log(`\n  sitemap   ${SITEMAP} stamps ${stamp}`)
console.log(`  content   ${CONTENT_PATHS.join(', ')}`)

if (!newest) {
  console.log(
    `\n  \x1b[33mSKIP\x1b[0m    no git history for those paths — a shallow clone, or not a\n` +
    `          repository. Set \`fetch-depth: 0\` on the checkout to enable this check.\n`
  )
  process.exit(0)
}

// Both are `YYYY-MM-DD`, which compares chronologically as a string — the same property
// `lib/date-utils.ts` relies on, and the reason neither side is parsed into a Date here.
if (newest > stamp) {
  fail(
    `the public pages changed on ${newest}, after the sitemap's ${stamp}.\n\n` +
    `        Bump \`lastModified\` in ${SITEMAP} to ${newest} (or later) if the change was\n` +
    `        to something a reader sees. What moved:\n\n` +
    execFileSync('git', [
      'log', `--since=${stamp}`, '--date=short', '--format=          %ad  %s', '--', ...CONTENT_PATHS,
    ], { encoding: 'utf8' }).trimEnd() + '\n'
  )
}

console.log(`  newest    ${newest}\n\n  Clean. NOTE: this cannot tell a copy change from a refactor.\n`)
