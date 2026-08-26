/**
 * EVERY TRANSLATION KEY IS DEFINED, USED, AND STILL A TRANSLATION OF WHAT IT SAYS IT IS.
 *
 *     npm run i18n:check
 *     npm run i18n:accept <locale>     # after re-checking wording, record the new source hash
 *
 * Exits 1 on a finding, so it reads as a test. No database and no network — it imports the
 * catalogues and sweeps `app/` and `components/` for `t('…')` call sites.
 *
 * ── THE FIVE THINGS IT CHECKS, AND WHY EACH IS INVISIBLE OTHERWISE ──────────────────
 *
 *   USED-NOT-DEFINED    `t('nav.section.nonsence')`. At runtime `translate` returns the KEY, so
 *                       the rail renders "nav.section.nonsence" — visible in development and
 *                       exactly the kind of thing that reaches production in a rarely-opened
 *                       pane. A typo, always.
 *
 *   DEFINED-NOT-USED    a key nobody reads. Harmless on screen and expensive in a translator's
 *                       queue: it is a string somebody is asked to translate into two languages
 *                       for no reason. Reported so the catalogue stays the size of the product.
 *
 *   ORPHAN              a key in a translation that is not in English. It can never render —
 *                       `translate` looks the key up in the chosen catalogue only after the
 *                       call site names it, and no call site names this one. Usually the residue
 *                       of a renamed key.
 *
 *   BAD-PLACEHOLDER     a `{name}` in a translation that is not in the English. It cannot be
 *                       substituted, so it renders LITERALLY as `{name}` — a translator has
 *                       invented a variable, or carried one over from a string that had it.
 *
 *   STALE               the English changed after the translation was made. **The one this
 *                       script exists for.** Nothing else can see it: the Spanish string is
 *                       still fluent, still grammatical, and no longer says what the English
 *                       says. `lib/i18n/translated-from.json` is the record it is compared
 *                       against.
 *
 *   DUPLICATE-KEY       one key defined by two BUNDLES. Which string renders would then depend
 *                       on which bundle the call site happened to reach for, and both would be
 *                       fingerprinted separately — so a stale translation could hide behind its
 *                       twin. Structurally impossible to notice by reading either file.
 *
 *   CLIENT-BUNDLE       a `'use client'` file importing `lib/email/strings`. The email bundle is
 *                       the prose of six messages nobody reads in a browser, and an import
 *                       from a client component ships all of it — silently, because the import
 *                       works and the strings render. `import 'server-only'` in that module is
 *                       the real gate and turns this into a build failure; this is the second
 *                       opinion, and it names the file.
 *
 *   PINNED-FORMATTER    a date or money formatter called WITHOUT a locale. It renders English,
 *                       silently and correctly, which is exactly why it needs counting: a
 *                       half-localized product has no symptom. `lib/date-utils.ts` defaults
 *                       every locale parameter so that ~250 call sites kept working when the
 *                       formatters moved to `Intl`, and the price of that default is a backlog
 *                       nobody can see. This is the ratchet over it — the same device
 *                       `audit:rls-cases`' `BACKLOG_CEILING` is: lower it freely, raise it only
 *                       deliberately.
 *
 * ── ALL FIVE HAVE BEEN CHECKED AGAINST A REAL DEFECT ────────────────────────────────
 * A gate is worth what its own failure test is worth — `time-display.mjs` shipped a pattern
 * that was INERT and reported Clean over a codebase with the bug deliberately put back, and it
 * was found only by expecting a finding. So each of these was verified by building a throwaway
 * `es.ts`, breaking it one way at a time, and watching this exit 1:
 *
 *   USED-NOT-DEFINED    a `t('…')` example inside `Sidebar.tsx`' own doc comment. That is what
 *                       made `stripComments` non-optional; see `scripts/strip-code.mjs`.
 *   DEFINED-NOT-USED    every key in `en.ts` before its component was wired — 17 of them.
 *   UNRECORDED          the throwaway `es.ts`, before `i18n:accept es`.
 *   STALE               `i18n:accept es`, then one English string edited and the Spanish left
 *                       alone. Reported by name. **This is the one the whole file exists for.**
 *   ORPHAN, BAD-        an `es` key with no English counterpart, and `{next}` renamed to
 *   PLACEHOLDER         `{siguiente}` in a Spanish string.
 *
 * The throwaway catalogue was then removed. Phase 4's `es` is the first real one.
 *
 *   DUPLICATE-KEY       `email.approved.subject` copied into `lib/i18n/en.ts` as well.
 *   CLIENT-BUNDLE       an `import { emailT } from '@/lib/email/strings'` added to
 *                       `components/layout/ThemeToggle.tsx`, which is `'use client'`.
 *
 * ── TWO BUNDLES, ONE MECHANISM ──────────────────────────────────────────────────────
 * The shell's catalogue is a STATIC import reachable from client components, and the email
 * bundle is `server-only`. They are separate modules for that reason alone — one `Catalogue`
 * type, one `translate`, one fingerprint file, one gate. `BUNDLES` below is what makes that
 * true of the gate as well as of the app: adding Phase 5's manual bundle is one entry in that
 * array, and every check above then applies to it with no further edit.
 *
 * The keys are globally unique ACROSS bundles, which DUPLICATE-KEY enforces, so the fingerprint
 * file stays a flat map per language rather than growing a bundle level nobody would read.
 *
 * ── WHAT IT CANNOT SEE, NAMED RATHER THAN LEFT TO BE DISCOVERED ─────────────────────
 *   * **Whether the words are any good.** No script can. The fingerprint answers "was this
 *     translated from the current English", never "is it a good translation of it".
 *   * **A key built at runtime.** `t(`nav.item.${href}`)` is a template literal, and the sweep
 *     matches literal arguments only. The rail does exactly this, which is why `KNOWN_DYNAMIC`
 *     below exists and why it names its prefixes rather than switching the check off.
 *   * **A user-facing string that never went through `t` at all.** Nothing here can find those:
 *     a bare `>Save<` in JSX is indistinguishable from a `className` or a test fixture without
 *     understanding the file. That gap is the reason the catalogue is grown SURFACE BY SURFACE
 *     with a stated scope — the shell in Phase 3 — rather than by sweeping for literals and
 *     hoping the sweep was complete.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { register } from 'node:module'
import { dirname, join, relative, sep as SEP } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { stripComments } from './strip-code.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

// ── THE `@/` HOOK ──────────────────────────────────────────────────────────────────
// The catalogue modules import each other as `@/lib/i18n/…`, which is a tsconfig path the app
// resolves and bare Node does not. `scripts/help-check.mjs` faces exactly this and solved it
// this way; the hook below is copied from it deliberately, extension list included, for the
// reason its own comment gives: *"a second, subtly different alias resolver is how two runners
// come to disagree about which file `@/lib/features` means."*
//
// The alternative was making `lib/i18n/*` use relative imports so bare Node could load them.
// Rejected: it would make one directory in `lib/` spell its imports differently from every
// other, to serve a script — and the next module added there would follow the convention it
// sees and break this gate silently.
const HOOK = `
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = ${JSON.stringify(ROOT)}
const EXTENSIONS = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']

export async function resolve(specifier, context, next) {
  // ── server-only IS A THROWING MODULE OUTSIDE REACT ───────────────────────────────
  // The package resolves to an empty module under the react-server condition and to one that
  // throws on purpose everywhere else, which is exactly what makes it a useful gate -- and what
  // stops bare Node importing lib/email/strings. Stubbed here rather than by passing
  // --conditions=react-server on the command line: the flag would change resolution for every
  // module this script loads, to fix one import, and it lives in package.json where a reader of
  // this file would never see it.
  //
  // NO BACKTICKS IN THIS COMMENT. The whole hook is a template literal in the file below, so a
  // backtick here ends it and the script fails to parse -- which is how this comment came to be
  // written twice.
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,', format: 'module', shortCircuit: true }
  }
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
const load = name => import(pathToFileURL(join(ROOT, 'lib', 'i18n', name)).href)
const { CATALOGUES } = await load('catalogues.ts')
const { placeholdersIn } = await load('t.ts')
const { BASE_LOCALE } = await load('locales.ts')
const { EMAIL_BUNDLE } = await import(
  pathToFileURL(join(ROOT, 'lib', 'email', 'strings', 'index.ts')).href)

/**
 * Every translation bundle in the product, and where its call sites live.
 *
 * `where` is DOCUMENTATION, not a filter — the sweep for `t('…')` covers `SCAN` as a whole and
 * does not care which bundle a key belongs to, because a key can only belong to one
 * (DUPLICATE-KEY). It is here so a finding names something a reader can go and look at.
 *
 * Phase 5's manual is the third entry and needs nothing else.
 */
const BUNDLES = [
  {
    id: 'shell',
    catalogues: CATALOGUES,
    where: 'app/ and components/ — the rail, the top bar, the switchers',
  },
  {
    id: 'email',
    catalogues: EMAIL_BUNDLE,
    where: 'lib/email/templates.ts — server-only, never in a browser bundle',
  },
]

/** The English side of one bundle. The source every translation of it is measured against. */
const sourceOf = bundle => bundle.catalogues[BASE_LOCALE] ?? {}
/**
 * Where a `t('key')` call site may live.
 *
 * `lib/` JOINED THE LIST IN PHASE 4, and the reason is worth stating because the two halves of
 * this script disagree about it. `formatTimeAgo` in `lib/i18n/catalogues.ts` maps `timeAgo`'s
 * structured answer through `t` — a legitimate call site in `lib/`, and without it here the
 * `time.*` keys were reported as defined-and-unused.
 *
 * The PINNED-FORMATTER check below still skips `lib/` deliberately: that is where the formatters
 * are DEFINED, and a definition is not a call site. Same directory, opposite treatment, because
 * the two checks are looking for different things.
 */
const SCAN = ['app', 'components', 'lib']
const FINGERPRINTS = join(ROOT, 'lib', 'i18n', 'translated-from.json')

/**
 * Key PREFIXES a call site builds at runtime, with the reason.
 *
 * The rail maps over its own registry and calls `t(`nav.item.${item.href}`)`, which is right —
 * the alternative is thirty-one hand-written call sites that can fall out of step with the
 * registry beside them. So the sweep cannot see those keys, and this is where that is recorded.
 *
 * A prefix here means "keys under this are exempt from DEFINED-NOT-USED". It does NOT exempt
 * them from anything else: a `nav.item.*` key still has to be a translation of current English,
 * still cannot invent a placeholder, and still cannot be an orphan.
 */
const KNOWN_DYNAMIC = [
  ['nav.item.', 'The rail maps its own registry: t(`nav.item.${item.href}`) in Sidebar.tsx.'],
  ['nav.section.', 'Likewise for section headings, keyed on the section id.'],
  ['theme.', 'ThemeToggle maps its three modes: t(`theme.${mode}`).'],
  ['switcher.badge.', 'FamilySwitcher picks a badge by membership state.'],
]

const isDynamic = key => KNOWN_DYNAMIC.some(([prefix]) => key.startsWith(prefix))

/**
 * Formatters whose locale is optional, and the ceiling on how many call sites may still default.
 *
 * ── WHY A COUNT RATHER THAN A FINDING PER SITE ──────────────────────────────────────
 * Every one of these is CORRECT today: it renders English, which is what the product rendered
 * before. Reporting 250 findings would be reporting the current state of the world as 250
 * defects, and a gate that is red for a year is a gate people learn to pass with `--force`.
 *
 * A ceiling is the honest shape. It cannot grow — a new un-threaded call site fails the build —
 * and it comes down surface by surface as Phase 4 translates each one. Same device as
 * `audit:rls-cases`' `BACKLOG_CEILING`, and the same rule: lowering it is routine, raising it
 * needs a sentence.
 *
 * ── WHAT COUNTS AS THREADED ─────────────────────────────────────────────────────────
 * A second argument, of any shape. The sweep cannot tell `formatDate(d, locale)` from
 * `formatDate(d, 'en-US')` and does not try: pinning a literal at a call site is a thing
 * somebody did on purpose, and this gate's job is to find the ones nobody has thought about.
 */
const OPTIONAL_LOCALE = ['formatDate', 'formatDateRange', 'formatMonthDay', 'formatDateNumeric',
  'formatTime', 'formatCurrency']

/**
 * MEASURED 2026-08-26, immediately after the formatters moved to `Intl` — 211 call sites in
 * `app/` and `components/` render English because nobody has given them a locale yet.
 *
 * Set to the measured figure exactly, so it is a real ratchet rather than headroom. Lower it as
 * surfaces are threaded in Phase 4; raising it is a deliberate act that owes a reason on this
 * line.
 */
const PINNED_CEILING = 211

// ── SCANNING ────────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** The balanced-paren argument text starting at the `(` at `open`. Shared with time-display. */
function argsAt(src, open) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      depth--
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  return src.slice(open + 1)
}

/** Every `t('key')` / `t("key")` literal in the tree, with where it was found. */
function usedKeys() {
  const used = new Map()
  for (const dir of SCAN) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file).split('\\').join('/')
      // COMMENTS BLANKED, string contents KEPT — the keys ARE string contents. Not optional:
      // this gate's first run reported `nav.section.<id>` as a key used but not defined, which
      // is a `t('…')` example inside `Sidebar.tsx`' own doc comment explaining the key scheme.
      // `scripts/strip-code.mjs` carries the argument for why there is one stripper.
      const src = stripComments(readFileSync(file, 'utf8'))
      for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) {
        if (!used.has(m[1])) used.set(m[1], rel)
      }
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) {
        if (!used.has(m[1])) used.set(m[1], rel)
      }
    }
  }
  return used
}

/** A short, stable hash of one English string. */
const fingerprint = value => createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12)

function readFingerprints() {
  try {
    const raw = JSON.parse(readFileSync(FINGERPRINTS, 'utf8'))
    // `_README` is documentation living in the data file, which is the only place a reader of
    // this mechanism will look. Not a locale.
    delete raw._README
    return raw
  } catch {
    return {}
  }
}

// ── `i18n:accept <locale>` ──────────────────────────────────────────────────────────
// Records the CURRENT English as what each of that locale's translations was made from. Run it
// after re-checking the wording — never as a way past a red build, which is the one thing that
// would make the whole mechanism decorative.

if (process.argv[2] === 'accept') {
  const locale = process.argv[3]
  // A LOCALE IS ACCEPTABLE IF ANY BUNDLE HAS IT, and every bundle that has it is recorded in
  // one pass. Accepting per bundle was the alternative and is a worse shape: somebody would
  // accept the shell, believe they were done, and leave the email prose reported as STALE —
  // which reads as the gate being broken rather than as half a job.
  const present = BUNDLES.filter(b => b.catalogues[locale])
  if (!locale || present.length === 0 || locale === BASE_LOCALE) {
    const offered = new Set()
    for (const b of BUNDLES) {
      for (const code of Object.keys(b.catalogues)) if (code !== BASE_LOCALE) offered.add(code)
    }
    console.error(`\n  usage: npm run i18n:accept <locale>   (one of: ${
      [...offered].join(', ') || 'none yet'})\n`)
    process.exit(1)
  }
  const existing = JSON.parse(readFileSync(FINGERPRINTS, 'utf8'))
  const next = {}
  for (const bundle of present) {
    const en = sourceOf(bundle)
    for (const key of Object.keys(bundle.catalogues[locale])) {
      if (en[key] !== undefined) next[key] = fingerprint(en[key])
    }
  }
  existing[locale] = next
  writeFileSync(FINGERPRINTS, `${JSON.stringify(existing, null, 2)}\n`, 'utf8')
  console.log(`\n  recorded ${Object.keys(next).length} source hash(es) for ${locale}\n`)
  process.exit(0)
}

// ── CHECK ───────────────────────────────────────────────────────────────────────────

const findings = []
const used = usedKeys()
const fingerprints = readFingerprints()

// ── THE UNION, AND WHO OWNS EACH KEY ───────────────────────────────────────────────
// One flat set of defined keys, because a call site names a key and not a bundle. `owner` is
// what turns a finding into something a reader can act on, and building it is what detects a
// key defined twice — see DUPLICATE-KEY in the header.
const enKeys = new Set()
const owner = new Map()
for (const bundle of BUNDLES) {
  for (const key of Object.keys(sourceOf(bundle))) {
    const first = owner.get(key)
    if (first !== undefined) {
      findings.push({
        kind: 'DUPLICATE-KEY', key,
        detail: `defined by both the ${first} and ${bundle.id} bundles — one of them must rename it`,
      })
      continue
    }
    owner.set(key, bundle.id)
    enKeys.add(key)
  }
}

// 1. Every key a call site names exists in English.
for (const [key, where] of used) {
  if (!enKeys.has(key)) {
    findings.push({ kind: 'USED-NOT-DEFINED', key, detail: `used in ${where}` })
  }
}

// 2. Every English key is read by something. Dynamic prefixes are exempt, with a reason.
for (const key of enKeys) {
  if (!used.has(key) && !isDynamic(key)) {
    findings.push({
      kind: 'DEFINED-NOT-USED', key,
      detail: 'nothing reads it — delete it, or add its prefix to KNOWN_DYNAMIC with a reason',
    })
  }
}

// 3-5. Per bundle, per translation: orphans, invented placeholders, and staleness.
for (const bundle of BUNDLES) {
 const en = sourceOf(bundle)
 for (const [code, catalogue] of Object.entries(bundle.catalogues)) {
  if (code === BASE_LOCALE) continue
  const recorded = fingerprints[code] ?? {}
  for (const [key, value] of Object.entries(catalogue)) {
    const source = en[key]
    if (source === undefined) {
      findings.push({ kind: 'ORPHAN', key, detail: `in ${code}, not in ${BASE_LOCALE}` })
      continue
    }

    const allowed = new Set(placeholdersIn(source))
    for (const name of placeholdersIn(value)) {
      if (!allowed.has(name)) {
        findings.push({
          kind: 'BAD-PLACEHOLDER', key,
          detail: `${code} uses {${name}}, which the English string does not — it will render literally`,
        })
      }
    }

    const now = fingerprint(source)
    if (recorded[key] === undefined) {
      findings.push({
        kind: 'UNRECORDED', key,
        detail: `${code} has a translation with no recorded source — run: npm run i18n:accept ${code}`,
      })
    } else if (recorded[key] !== now) {
      findings.push({
        kind: 'STALE', key,
        detail: `the English changed after ${code} was translated — re-check the wording, then: npm run i18n:accept ${code}`,
      })
    }
  }
 }
}

// 5b. The email bundle must not be reachable from a client component.
//
// `import 'server-only'` in that module is what actually stops it, and this is the second
// opinion — a grep that names the file, because a build error on a transitive import points at
// the module rather than at whoever imported it. It looks for the DIRECT import only: an
// indirect one through `templates.ts` is caught by the same `server-only` marker one level up,
// and chasing the graph here would be a module resolver written in a gate.
for (const dir of SCAN) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).split(SEP).join('/')
    const raw = readFileSync(file, 'utf8')
    // The directive, not a mention of it: `'use client'` inside a comment or a string is what
    // `stripComments` is for, and the directive itself is code.
    const code = stripComments(raw)
    if (!/^\s*(?:'use client'|"use client")/.test(code)) continue
    if (code.includes('@/lib/email/strings')) {
      findings.push({
        kind: 'CLIENT-BUNDLE', key: rel,
        detail: 'a client component imports the email bundle — that ships six messages\' prose '
          + 'to the browser. Compose the mail in a server action and pass the result down.',
      })
    }
  }
}

// 6. Date and money formatters still rendering English because nobody has given them a locale.
let pinned = 0
for (const dir of SCAN) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).split(SEP).join('/')
    // The module that DEFINES them, and the tests, are not call sites.
    if (rel.startsWith('lib/')) continue
    const code = stripComments(readFileSync(file, 'utf8'))
    for (const fn of OPTIONAL_LOCALE) {
      // `indexOf` rather than a RegExp. Two reasons, and the second is the honest one: the
      // pattern only ever looks for a literal call, so a regex buys nothing — and every attempt
      // to author one through a script in this repo has produced a mangled escape (a `\b` that
      // became a backspace character in `time-display.mjs`, then a pair that vanished here).
      // A string search cannot be silently wrong in that way.
      const needle = fn + '('
      let from = 0
      for (;;) {
        const at = code.indexOf(needle, from)
        if (at === -1) break
        from = at + needle.length
        // A WORD BOUNDARY BY HAND: `formatDate(` must not match inside `formatInstantDate(`.
        const before = at === 0 ? '' : code[at - 1]
        if (before && /[A-Za-z0-9_$]/.test(before)) continue
        // One argument means no locale. Counting commas at DEPTH ZERO, because an argument can
        // itself be a call — `formatDate(dateIn(iso, zone))` is ONE argument, not two.
        const args = argsAt(code, at + needle.length - 1)
        let depth = 0
        let top = 0
        for (const ch of args) {
          if (ch === '(' || ch === '[' || ch === '{') depth++
          else if (ch === ')' || ch === ']' || ch === '}') depth--
          else if (ch === ',' && depth === 0) top++
        }
        if (top === 0) pinned++
      }
    }
  }
}

if (pinned > PINNED_CEILING) {
  findings.push({
    kind: 'PINNED-FORMATTER', key: `${pinned} call site(s)`,
    detail: `above the ceiling of ${PINNED_CEILING} — a new date or money formatter call needs `
      + 'the reader\'s locale, or the ceiling needs raising with a reason in the script',
  })
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────

for (const [prefix, why] of KNOWN_DYNAMIC) {
  console.log(`\n  note     ${prefix}*\n           ${why}`)
}

// PER BUNDLE, and always printed. A single total would hide the state this is most likely to
// be in — one bundle fully translated and the next one empty — which is exactly the half-job
// `i18n:accept`'s note above is about.
const languages = new Set()
for (const bundle of BUNDLES) {
  const en = sourceOf(bundle)
  const total = Object.keys(en).length
  const done = Object.entries(bundle.catalogues)
    .filter(([code]) => code !== BASE_LOCALE)
    .map(([code, catalogue]) => {
      languages.add(code)
      return `${code} ${Object.keys(catalogue).filter(k => en[k] !== undefined).length}/${total}`
    })
  console.log(
    `\n  bundle   ${bundle.id} — ${total} key(s)${done.length ? ` · ${done.join(' · ')}` : ''}`
    + `\n           ${bundle.where}`)
}

console.log(
  `\n  scanned  ${enKeys.size} key(s) across ${BUNDLES.length} bundle(s) · `
  + `${used.size} call site key(s) · ${languages.size} translation(s)`
  + `\n           ${pinned}/${PINNED_CEILING} date and money call site(s) still default to English`
)

// THE BACKLOG IS PRINTED EVEN WHEN THERE IS NOTHING TO SAY, which is deliberate: a product with
// one catalogue and two declared languages is a real state and it should be visible on every
// run rather than inferred from silence. Same reason `help:check` prints its allowances.
if (languages.size === 0) {
  console.log(
    `\n           No translations yet. ${Object.keys(CATALOGUES).length} catalogue(s) exist, so the\n`
    + '           language switcher does not render — see lib/i18n/catalogues.ts.'
  )
}

if (findings.length === 0) {
  console.log('\n  Clean. NOTE: this cannot judge whether a translation is any good.\n')
  process.exit(0)
}

console.log(`\n  ${findings.length} finding(s):\n`)
for (const f of findings) {
  console.log(`  ── ${f.kind}  ${f.key}`)
  console.log(`       ${f.detail}\n`)
}
process.exit(1)
