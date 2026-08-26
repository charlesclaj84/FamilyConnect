/**
 * EVERY TIME RENDERED IN THE APP IS EITHER A LABEL OR AN INSTANT, AND SAYS WHICH.
 *
 *     npm run audit:time
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────
 * There are two kinds of time in this product (see `lib/tz.ts`), and the whole class of bug
 * this script is aimed at is one being handled as the other:
 *
 *   AN INSTANT      `timestamptz`. Has no calendar date of its own — the date it "was"
 *                   depends on the zone you ask from. Must be resolved through `lib/tz.ts`.
 *   A LABEL         `DATE` / `TIME`. What a paper invitation says. Never converted.
 *
 * `formatDate` takes `value.slice(0, 10)`, so handing it an ISO timestamp prints the **UTC**
 * calendar date. Ten call sites did exactly that — Payment History, Transactions, Documents,
 * Officer Notes — and every row entered after 7pm Central was filed a day late. Nothing
 * reported it: the date rendered, it was plausible, and it was wrong.
 *
 * That is the shape this catches. It is the same argument `audit:people` and
 * `audit:family-scope` make about their own rules: the mistake is greppable, nobody makes it
 * deliberately, and it is invisible once shipped.
 *
 * ── THREE PATTERNS, AND WHAT EACH ONE MEANS ─────────────────────────────────────────
 *
 *   LABEL-FORMATTER-ON-AN-INSTANT
 *       `formatDate(row.created_at)` and friends. A `date-utils` formatter — which is for
 *       labels and does string surgery — applied to something whose name ends `_at`.
 *       The fix is `formatInstantDate(row.created_at, zone)`.
 *
 *   RUNTIME-ZONE
 *       `.toLocaleDateString()`, `.toLocaleTimeString()`, `.toLocaleString()`. These read
 *       whichever zone the RUNTIME is in — the browser's in a client component, UTC on the
 *       server — so the same row renders differently depending on which side drew it. They
 *       also pin a locale at the call site, which Phase 3 has to undo.
 *
 *   SERVER-TODAY
 *       `todayLocal()` in a module that runs on the SERVER. It reads whatever zone the process
 *       is in — the member's in a browser, and **UTC on the server**, which rolls over at 7pm
 *       Central. So for the last five hours of every day a server-side comparison judged the
 *       family's records against tomorrow: a gathering read "Past" while the family was at it,
 *       and a task due today read "Overdue" five hours early.
 *
 *       The fix is `todayIn(await resolveFamilyZone(familyCode))` for a judgement about the
 *       family's records, or `todayIn(await resolveZone(userId))` for one about the reader.
 *       `lib/auth/zone.ts` states which is which. `todayLocal()` stays CORRECT in a client
 *       component, where it reads the member's own browser, and that is what the form
 *       date-prefills use — so this pattern fires only on a file with no `'use client'`.
 *
 *   UNPINNED-FORMATTER
 *       `new Intl.DateTimeFormat(...)` with no `timeZone` option anywhere in its arguments.
 *       Same defect as the above with more ceremony. `lib/calendar.ts` records the sharpest
 *       version of it: a formatter resolves its zone when it is CONSTRUCTED, so a
 *       module-level one never notices `process.env.TZ` changing — which made a mutation
 *       ship green from CI and fail only on a laptop.
 *
 * ── EVERY PATTERN HERE HAS BEEN MUTATION-CHECKED, AND ONE OF THEM SHIPPED INERT ─────
 * A gate is only worth what its own failure test is worth, and `SERVER-TODAY` proved that on
 * the day it was written: the regex was authored through a script that turned `` into a
 * literal BACKSPACE character (0x08), so the pattern demanded a backspace before `todayLocal`
 * and could never match anything. The audit reported **Clean** over a codebase with the bug
 * deliberately reintroduced.
 *
 * Nothing about the output distinguished that from a genuinely clean tree. It was found only by
 * putting the bug back and expecting a finding — which is AGENTS.md §7's "a green suite is not
 * evidence until you have seen it fail", arriving in a script whose whole job is to be that
 * evidence for somebody else.
 *
 * **So: adding a pattern here means reintroducing the defect it is for and watching this exit
 * 1.** All four have been checked that way.
 *
 * ── WHAT IT CANNOT SEE, NAMED RATHER THAN LEFT TO BE DISCOVERED ─────────────────────
 *   * **A column that holds an instant and is not named `*_at`.** The instant-detection is
 *     the column NAME, so `responded` or `stamp` would sail past. Every timestamp column in
 *     the schema is `*_at` today and that is worth keeping.
 *   * **A label passed to a zoned formatter.** The opposite direction. `dateIn` throws for a
 *     bare `YYYY-MM-DD` at runtime, which is the layer that can actually tell.
 *   * **An instant formatted by hand** — `iso.slice(0, 10)`, `new Date(iso).getFullYear()`.
 *     Greppable in principle and not worth the false-positive rate; `getFullYear` on a Date
 *     is legitimate in a dozen places.
 *   * **Whether a verdict is TRUE.** Like its two sibling audits, this checks that a verdict
 *     EXISTS. The judgement stays a person's, and the verdicts are where it is written down.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN = ['app', 'lib', 'components']

/** `date-utils` formatters. Every one of them is for a LABEL and does string surgery. */
const LABEL_FORMATTERS = [
  'formatDate', 'formatTime', 'formatDateRange', 'formatMonthDay', 'formatDateNumeric',
]

/**
 * Reviewed sites, keyed `file:kind`, with one verdict covering every occurrence of that pair
 * in that file.
 *
 * KEYED ON THE PAIR AND NOT THE LINE, for the reason `family-scope.mjs` states: a line number
 * is invalidated by the next edit above it, and an allow-list that goes stale every commit is
 * one people regenerate without reading. The cost is that a SECOND occurrence of the same kind
 * in the same file inherits the first one's verdict, so write the verdict about the file.
 */
const REVIEWED = {
  'lib/date-utils.ts:SERVER-TODAY':
    'THE DEFINITION, not a call. `export function todayLocal()` matches the pattern because the '
    + 'pattern is a call shape and a declaration looks like one. A verdict rather than skipping '
    + 'the file, so the exemption is one LINE of this module rather than all of it — a real '
    + '`todayLocal()` CALL added to date-utils.ts would inherit this verdict, which is the known '
    + 'cost of keying on file-and-kind and is stated in the REVIEWED header above.',

  'components/layout/ZoneHint.tsx:UNPINNED-FORMATTER':
    'READING THE BROWSER\'S ZONE, WHICH IS THE ONE LEGITIMATE USE OF AN UNPINNED FORMATTER. '
    + '`Intl.DateTimeFormat().resolvedOptions().timeZone` is the only way to ask a browser '
    + 'what zone it is in, and that answer is the whole purpose of this component. There is '
    + 'no date being formatted here.',
}

/** Whole files exempt, with the reason. */
const REVIEWED_FILES = {}

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

/**
 * Blank out comments and string literals, keeping the byte count so line numbers survive.
 *
 * NOT OPTIONAL, and it is the first thing that went wrong when this was written. This
 * codebase's doc comments discuss the very patterns being searched for — `lib/tz.ts`' own
 * header contains the words `formatDate(row.created_at)` as the example of what NOT to do —
 * so a raw text scan reports the documentation as the defect. String literals go too, because
 * `help/content.ts` and the migration prose quote these names.
 */
function strip(src) {
  const out = src.split('')
  let i = 0
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      blank(i, stop); i = stop; continue
    }
    if (two === '//') {
      let end = src.indexOf('\n', i)
      if (end === -1) end = src.length
      blank(i, end); i = end; continue
    }
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === ch) break
        j++
      }
      blank(i + 1, j); i = j + 1; continue
    }
    i++
  }
  return out.join('')
}

/** The balanced-paren argument text starting at the `(` at `open`. */
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

/**
 * Remove `dateIn(...)` and `timeIn(...)` sub-expressions from an argument list.
 *
 * THE FALSE POSITIVE THIS SCRIPT FOUND ON ITS OWN FIRST RUN, and it belongs in code rather
 * than in a verdict. `formatTime(timeIn(message.created_at, zone))` is the CORRECT shape --
 * the instant is resolved to a label, and the label formatter is handed that label -- but the
 * `_at` is still textually inside `formatTime`'s parentheses.
 *
 * A per-file verdict would have silenced it and then MASKED a genuinely wrong second call in
 * the same file, because verdicts are keyed on `file:kind`. Teaching the detector the one
 * legitimate composition is narrower and cannot rot that way.
 */
function withoutConversions(args) {
  let out = args
  for (const fn of ['dateIn', 'timeIn']) {
    for (;;) {
      // `indexOf` rather than a RegExp: the pattern would need escaping and this only
      // ever looks for a literal call, so there is nothing a regex would buy.
      const at = out.indexOf(fn + '(')
      if (at === -1) break
      const open = out.indexOf('(', at)
      const inner = argsAt(out, open)
      out = out.slice(0, at) + out.slice(open + 1 + inner.length + 1)
    }
  }
  return out
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length

const findings = []
/** Verdict keys a real site matched — see the stale check at the bottom. */
const matched = new Set()
let scanned = 0
let sites = 0

for (const dir of SCAN) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).split('\\').join('/')
    if (REVIEWED_FILES[rel]) continue
    scanned++
    const raw = readFileSync(file, 'utf8')
    // Read from the RAW source, before comments are blanked: the directive is a string
    // literal at the top of the file, and `strip` blanks string CONTENTS.
    const isClient = /^\s*['"]use client['"]/m.test(raw)
    const code = strip(raw)

    const hits = []

    // 1. A label formatter applied to something whose name ends `_at`.
    for (const fn of LABEL_FORMATTERS) {
      const re = new RegExp(`\\b${fn}\\s*\\(`, 'g')
      let m
      while ((m = re.exec(code))) {
        const args = withoutConversions(argsAt(code, m.index + m[0].length - 1))
        if (/\b[A-Za-z_$][\w$]*_at\b/.test(args)) {
          hits.push({ kind: 'LABEL-FORMATTER-ON-AN-INSTANT', line: lineOf(code, m.index) })
        }
      }
    }

    // 2. A `toLocale*` call — the runtime's zone, whatever that happens to be.
    {
      const re = /\.toLocale(?:Date|Time)?String\s*\(/g
      let m
      while ((m = re.exec(code))) {
        hits.push({ kind: 'RUNTIME-ZONE', line: lineOf(code, m.index) })
      }
    }

    // 3. `todayLocal()` in a SERVER module. Correct in a client component — it reads the
    //    member's own browser there — so the `'use client'` check is the whole discriminator.
    if (!isClient) {
      const re = /\btodayLocal\s*\(/g
      let m
      while ((m = re.exec(code))) {
        hits.push({ kind: 'SERVER-TODAY', line: lineOf(code, m.index) })
      }
    }

    // 4. An `Intl.DateTimeFormat` with no `timeZone` anywhere in its arguments.
    {
      const re = /Intl\.DateTimeFormat\s*\(/g
      let m
      while ((m = re.exec(code))) {
        const args = argsAt(code, m.index + m[0].length - 1)
        if (!/\btimeZone\b/.test(args)) {
          hits.push({ kind: 'UNPINNED-FORMATTER', line: lineOf(code, m.index) })
        }
      }
    }

    sites += hits.length
    const seen = new Set()
    for (const hit of hits) {
      const key = `${rel}:${hit.kind}`
      if (seen.has(key)) continue
      seen.add(key)
      if (REVIEWED[key]) matched.add(key)
      else findings.push({ key, ...hit, rel })
    }
  }
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────

for (const [key, why] of Object.entries(REVIEWED)) {
  console.log(`\n  note     ${key}\n           ${why}`)
}
for (const [file, why] of Object.entries(REVIEWED_FILES)) {
  console.log(`\n  note     ${file} (whole file)\n           ${why}`)
}

console.log(
  `\n  scanned  ${scanned} file(s) in ${SCAN.join(', ')} · ${sites} time-rendering site(s)`
)

/**
 * A VERDICT THAT MATCHES NOTHING IS ITSELF A FINDING.
 *
 * `family-scope.mjs`'s header warns that an allow-list which goes stale is one people
 * regenerate without reading. The same applies in the other direction: an entry left behind
 * after its call site was fixed is a claim about code that no longer exists, and the next
 * person to add a matching site silently inherits a verdict written about something else.
 * This script's own first run produced one, so the check pays for itself immediately.
 */
for (const key of Object.keys(REVIEWED)) {
  if (!matched.has(key)) {
    findings.push({ key, rel: key.split(':')[0], line: 0, kind: 'STALE-VERDICT' })
  }
}

if (findings.length === 0) {
  console.log('\n  Clean. NOTE: this checks that a verdict EXISTS, never that it is true.\n')
  process.exit(0)
}

console.log(`\n  ${findings.length} finding(s):\n`)
for (const f of findings) {
  console.log(`  ── ${f.rel}:${f.line}: ${f.kind}`)
  if (f.kind === 'LABEL-FORMATTER-ON-AN-INSTANT') {
    console.log('       a date-utils formatter on a `*_at` value prints the UTC calendar day.')
    console.log('       use formatInstantDate(value, zone) from lib/tz.ts, or add a verdict:')
  } else if (f.kind === 'RUNTIME-ZONE') {
    console.log('       toLocale* reads the runtime\'s zone — the browser\'s or UTC, unpredictably.')
    console.log('       use formatInstant(value, zone) from lib/tz.ts, or add a verdict:')
  } else if (f.kind === 'SERVER-TODAY') {
    console.log('       todayLocal() on the server reads UTC, which rolls over at 7pm Central.')
    console.log('       use todayIn(await resolveFamilyZone(code)) for a family-wide judgement,')
    console.log('       or todayIn(await resolveZone(userId)) for one about the reader:')
  } else if (f.kind === 'STALE-VERDICT') {
    console.log('       a REVIEWED entry no site matches. The call site was fixed or moved;')
    console.log('       delete the entry rather than keep a verdict about absent code.')
    console.log('')
    continue
  } else {
    console.log('       an Intl.DateTimeFormat with no timeZone resolves to the runtime\'s zone.')
    console.log('       pass `timeZone`, or add a verdict:')
  }
  console.log(`       add '${f.key}' to REVIEWED in scripts/time-display.mjs\n`)
}
process.exit(1)
