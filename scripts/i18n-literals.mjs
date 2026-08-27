/**
 * COPY THAT WAS NEVER KEYED — the half `npm run i18n:check` structurally cannot see.
 *
 *     npm run i18n:literals
 *
 * Exits 1 above the ceiling, so it reads as a test. No database and no network.
 *
 * ── WHY THIS EXISTS BESIDE `i18n:check` RATHER THAN INSIDE IT ───────────────────────
 * That script proves every KEY is defined, used, fingerprinted and still a translation of
 * what it says it is. Every one of its seven findings is about a key. It is therefore
 * completely blind to a string nobody keyed — which is not a corner case, it is the whole
 * of the work: an English literal in a component renders English to every reader, in
 * silence, and passes every gate in the repo including the type checker.
 *
 * How that was found is worth recording, because it is the argument for a ratchet rather
 * than a review. On 2026-08-27 the public site was believed finished — four bundles, 3,900
 * keys, `i18n:check` clean. A probe rendered all nine public pages in three languages and
 * diffed the visible text: **224 lines came back identical in all three.** The sign-in
 * page, the sign-up page, the quote carousel's chrome, the three pillar drawings and every
 * page title on the auth flow. Nothing in the tree could say so.
 *
 * That probe cannot be a gate — it needs a built server and three HTTP requests per page,
 * and it cannot see a screen behind a login at all. This is the static half: it counts what
 * a reader would see in English, and the count is the thing that ratchets.
 *
 * ── WHAT IT LOOKS AT, AND WHAT IT DELIBERATELY DOES NOT ────────────────────────────
 * FOUR SHAPES, chosen because each is a string a reader reads and none of them can be
 * anything else:
 *
 *   1. A JSX TEXT NODE that reads as prose — `<p>Sign in to your account</p>`.
 *   2. The four USER-FACING ATTRIBUTES — `placeholder`, `aria-label`, `title`, `alt`.
 *   3. `message:` in a server action's return value, which is what a form shows on refusal.
 *   4. `label:`/`heading:`/`lede:`/`blurb:` in a registry object, which is how this codebase
 *      writes a screen's captions.
 *
 * NOT looked at, each for a reason:
 *
 *   * `lib/` — the catalogues live there, so their English IS the source. `lib/help/content.ts`
 *     is 79KB of English prose whose translation is DERIVED, and `lib/testimonials.ts` must
 *     never be translated at all (rule 4, and the FTC's rule on fake testimonials).
 *   * `className`, `href`, `src`, `id`, `key`, `type`, `role`, `name`, `value` — technical.
 *   * COMMENTS. This codebase argues at length in prose and the arguments are not copy.
 *   * A single word with no lower-case letter after it — `{APP_NAME}`, `USD`, an initial.
 *   * Anything in `PROPER_NOUNS` below.
 *
 * ── IT IS A RATCHET, NOT A PASS/FAIL ──────────────────────────────────────────────
 * `CEILING` is the number of literals in the tree on the day it was written. Lower it
 * freely; raising it is a deliberate act needing a sentence, exactly as
 * `BACKLOG_CEILING` in `scripts/rls-coverage.mjs` is. Without a ceiling a new screen could
 * ship un-keyed in the same commit that adds it, which is the rule broken with the audit's
 * blessing.
 *
 * ── WHAT IT CANNOT DO ─────────────────────────────────────────────────────────────
 * It cannot tell prose from a technical string in every case, and it does not try to be
 * exact — a heuristic with a stable count is a working ratchet, and a heuristic that
 * insists on being right is a rewrite every time somebody formats a file differently. So
 * treat the NUMBER as the signal and the per-file list as a work queue, and if a false
 * positive is genuinely not copy, add it to `NOT_COPY` with a reason rather than widening a
 * regex.
 *
 * It also cannot tell whether a string a reader never reaches matters. A `message:` on an
 * action nobody can call is still counted, because deciding otherwise means reading 33
 * files to build a list that goes stale.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()

/**
 * The count as of 2026-08-27. LOWER IT FREELY. See the header before raising it.
 *
 * It was 1,027 when this script was written, three hours earlier. What came out of it was
 * the whole of `app/actions/**` — 702 call sites over 397 distinct sentences, every refusal
 * a form can show — plus the public site's own residue.
 *
 * WHAT IS NOT IN THE REMAINING 325, so nobody re-does it: Home, `/features`, `/pricing`,
 * `/how-it-works`, `/why-us`, `/about`, `/login`, `/register`, `/forgot-password` and every
 * server-action message. The first nine were measured against a real server in all three
 * languages; the last was swept and type-checked.
 *
 * WHAT IS: the Dashboard's own components — panels, dialogs, tables and empty states. That
 * is the work queue, and the per-file list this script prints is ranked by size so the next
 * batch is the top of it.
 */
const CEILING = 323

/** Directories swept. `lib/` is deliberately absent — see the header. */
const ROOTS = ['app', 'components']

/** Skipped wholesale. */
const SKIP_DIRS = new Set(['node_modules', '.next', 'design', '__snapshots__'])

/**
 * Attributes whose value a person reads. `title` is on the list because it is a tooltip;
 * `name`, `id`, `type` and `role` are not, because they are contracts with the platform.
 */
const READABLE_ATTRS = ['placeholder', 'aria-label', 'aria-description', 'title', 'alt']

/** Object keys this codebase writes a screen's captions under. */
const CAPTION_KEYS = ['message', 'label', 'heading', 'lede', 'blurb', 'summary', 'description']

/**
 * Strings that look like prose and are not translated ANYWHERE, so counting them would be
 * asking for a translation that must not happen. Each needs a reason.
 */
const PROPER_NOUNS = new Set([
  'GENORRA',          // lib/brand.ts is the one place the product name lives
  'ClearPath Digital', // the company that built it
  'Stripe', 'Supabase', 'Resend', 'Vercel', 'PostgREST', 'Google',
  'Facebook', 'Instagram', 'X',
  'Free', 'Standard', 'Plus', 'Premium', // plan names — proper nouns, see lib/tiers.ts
  'Español', 'Français', 'English',      // endonyms, identical in every language by design
])

/**
 * Individual literals that are not copy and cannot be told apart by shape. A reason each.
 * Prefer this over widening a regex — a regex change is invisible and this is a list.
 */
const NOT_COPY = new Map([
  // A COMPARATOR AND A REDUCER, both caught because a JSX-text scan cannot tell a `>` that
  // closes a tag from one that is a greater-than sign in an arrow function's body. Both
  // start with a capital and contain a lower-case word, which is the whole test. Listed
  // here rather than answered with a wider regex, per the header: a list is diffable and a
  // regex change is invisible.
  ["ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.email.localeCompare(b.email, 'en') || (a.userId",
    'app/actions/staff/access.ts — a sort comparator, inside a `=>` body'],
  ['Math.max(m, bar.lane + 1), most), 0, ) return (',
    'components/calendar/MonthCalendar.tsx — the lane reducer, same shape'],
])

function tsxFiles(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let s
    try {
      s = statSync(full)
    } catch {
      continue
    }
    if (s.isDirectory()) tsxFiles(full, out)
    else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Comments out, so an argument written in prose is not counted as copy.
 *
 * Replaced by spaces of the same length rather than removed, so every offset and every line
 * number below still points at the real source. A `//` inside a string literal or a URL
 * would be mangled by a naive sweep, so string literals are walked first and skipped.
 */
function stripComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '//') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? src.length : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      out += src.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    if (two === '{/') {
      // A JSX comment — `{/* … */}`. The braces are part of it.
      const end = src.indexOf('*/}', i)
      if (end !== -1) {
        const stop = end + 3
        out += src.slice(i, stop).replace(/[^\n]/g, ' ')
        i = stop
        continue
      }
    }
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      // Copy the literal through untouched, so a `//` inside it survives.
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === ch) { j += 1; break }
        if (ch !== '`' && src[j] === '\n') break   // an unterminated quote; give up here
        j += 1
      }
      out += src.slice(i, j)
      i = j
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/** Does this run of words read as something a person was meant to read? */
function isProse(text) {
  // WHITESPACE NORMALIZED BEFORE THE TWO LOOKUPS, because a JSX text node is wrapped across
  // lines by whatever the formatter did and the lists below are written as one line. Without
  // this, an entry in `NOT_COPY` silently matches nothing — measured, and it is the sort of
  // no-op that reads as the list being ignored.
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 4) return false
  if (PROPER_NOUNS.has(trimmed)) return false
  if (NOT_COPY.has(trimmed)) return false
  // Must open with a capital or an opening punctuation mark a sentence can open with.
  if (!/^[A-Z¿¡“"']/.test(trimmed)) return false
  // Must contain a lower-case word: `USD`, `PGRST201` and `AND` are not copy.
  if (!/[a-z]{2}/.test(trimmed)) return false
  // A single capitalised word is a label at most and usually an identifier. Two or more
  // words, or one word ending in punctuation, is prose.
  if (!/\s/.test(trimmed) && !/[.!?…:]$/.test(trimmed)) return false
  // Reject what is obviously code that happens to start with a capital.
  if (/^[A-Z][A-Za-z]*\(/.test(trimmed)) return false
  if (/^[A-Z][A-Za-z0-9_]*$/.test(trimmed)) return false
  if (/[{}<>$]/.test(trimmed)) return false
  if (/^https?:/.test(trimmed)) return false
  return true
}

const findings = []

function scan(file) {
  const rel = relative(ROOT, file).split(sep).join('/')
  const raw = readFileSync(file, 'utf8')
  const src = stripComments(raw)
  const lineOf = offset => src.slice(0, offset).split('\n').length

  const seen = new Set()
  const add = (offset, text, shape) => {
    const line = lineOf(offset)
    const dedupe = `${line}:${text}`
    if (seen.has(dedupe)) return
    seen.add(dedupe)
    findings.push({ file: rel, line, text: text.trim().replace(/\s+/g, ' '), shape })
  }

  // 1 — a JSX text node. Between a `>` that closes a tag and the `<` that opens the next.
  //     Requiring the run to be free of `{`, `}` and `<` is what keeps an interpolated
  //     expression out; a mixed node like `Sign in to your {APP_NAME} account` is caught by
  //     its longest literal run instead, which is the right answer for counting.
  for (const m of src.matchAll(/>([^<>{}]{4,})</g)) {
    for (const run of m[1].split(/\s{2,}\n\s*/)) {
      if (isProse(run)) add(m.index + 1, run, 'jsx')
    }
  }

  // 2 — the readable attributes.
  for (const attr of READABLE_ATTRS) {
    const re = new RegExp(`\\b${attr}\\s*=\\s*(["'])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`, 'g')
    for (const m of src.matchAll(re)) {
      if (isProse(m[2])) add(m.index, m[2], attr)
    }
  }

  // 3 and 4 — a caption or a refusal message in an object literal. Single-quoted only,
  //     because a template literal is almost always interpolating an id or a count and the
  //     false-positive rate on those is not worth the handful it would add.
  for (const key of CAPTION_KEYS) {
    const re = new RegExp(`\\b${key}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'g')
    for (const m of src.matchAll(re)) {
      if (isProse(m[1])) add(m.index, m[1], key)
    }
  }
}

for (const root of ROOTS) tsxFiles(join(ROOT, root)).forEach(scan)

// ── THE REPORT ──────────────────────────────────────────────────────────────────────
const byFile = new Map()
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, [])
  byFile.get(f.file).push(f)
}
const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)

// `--list` prints every finding as `file:line  shape  text`, one per line, for piping into
// a work queue. The default report is ranked and truncated, which is right for a gate and
// useless for actually working through the backlog.
if (process.argv.includes('--list')) {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}	${f.shape}	${f.text}`)
  }
  process.exit(0)
}

console.log()
console.log('  UNKEYED COPY — strings a reader reads that no catalogue holds.')
console.log()
for (const [file, list] of ranked.slice(0, 25)) {
  console.log(`  ${String(list.length).padStart(4)}  ${file}`)
  for (const f of list.slice(0, 3)) {
    console.log(`        ${f.line}: ${f.text.slice(0, 88)}`)
  }
  if (list.length > 3) console.log(`        … and ${list.length - 3} more`)
}
if (ranked.length > 25) {
  const rest = ranked.slice(25)
  const n = rest.reduce((sum, [, list]) => sum + list.length, 0)
  console.log()
  console.log(`  … and ${n} in ${rest.length} further file(s), not listed.`)
}

console.log()
console.log(`  ${findings.length} unkeyed literal(s) in ${byFile.size} file(s). Ceiling ${CEILING}.`)
console.log()

if (findings.length > CEILING) {
  console.log(`  OVER THE CEILING by ${findings.length - CEILING}.`)
  console.log('  A new screen shipped with English literals, or the ceiling was not lowered')
  console.log('  after a batch was keyed. See this file\'s header — the ceiling is a ratchet.')
  console.log()
  process.exit(1)
}

console.log('  Under the ceiling. NOTE: this cannot see a string it does not recognise as')
console.log('  prose, and it says nothing about whether a translation is any good.')
console.log()
