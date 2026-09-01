#!/usr/bin/env node
/**
 * PHYSICAL DIRECTION IN A LAYOUT — a class that will not mirror when the reader does.
 *
 * ── WHY THIS IS A GATE AND NOT A ONE-OFF SWEEP ──────────────────────────────────────
 * TODO.md put it plainly before any of this was built: *"THE FIRST RTL LANGUAGE IS NOT A
 * CATALOGUE, IT IS A LAYOUT PASS … nothing about it is hard and none of it is free. Do not let
 * Arabic be the language somebody adds on a Friday."*
 *
 * The pass was done on 2026-09-01 — 430 physical utilities became logical ones across 119
 * files. What makes that worth anything a year from now is that the 431st cannot arrive
 * unnoticed, and it would: `ml-2` renders perfectly for every reader this product has today, so
 * nothing anybody looks at goes wrong until the first right-to-left catalogue lands and a
 * hundred screens are subtly inside out. That is the same invisibility class as a bare
 * permission key going stale (AGENTS.md: *"a bare key that goes stale fails OPEN, so the
 * absence of a failure proves nothing"*), and it wants the same answer — a step in
 * `verify.yml` with a ceiling of zero.
 *
 * ── WHAT IT LOOKS FOR ───────────────────────────────────────────────────────────────
 * Tailwind utilities that name a SIDE rather than an EDGE, in `app/` and `components/`:
 *
 *     ml- mr-            ->  ms- me-              text-left text-right  ->  text-start text-end
 *     pl- pr-            ->  ps- pe-              border-l border-r     ->  border-s border-e
 *     left- right-       ->  start- end-          rounded-l rounded-r   ->  rounded-s rounded-e
 *     float/clear-left   ->  -start / -end        rounded-tl tr bl br   ->  ss se es ee
 *     scroll-ml/mr/pl/pr ->  scroll-ms/me/ps/pe
 *
 * `dir="rtl"` on `<html>` mirrors every one of the logical forms for free, which is the whole
 * design: no component asks which direction it is in, and there is no `isRtl()` branch anywhere
 * in `app/` or `components/`.
 *
 * ── AND WHAT IT CANNOT ──────────────────────────────────────────────────────────────
 * Named here rather than left to be discovered, the way `audit:family-scope` names its three:
 *
 *   * **A class assembled at runtime.** `` `m${side}-2` `` is invisible to a text sweep, and so
 *     is a physical property in a `style={{ }}` object.
 *   * **An SVG that points somewhere.** A chevron is not mirrored by `dir` — the glyph is drawn,
 *     not laid out — which is why 36 of them carry `rtl:-scale-x-100` by hand. This checks that
 *     every directional Lucide icon has it, which is a text check and therefore beatable by an
 *     alias or a wrapper component.
 *   * **Whether the result actually reads correctly.** Only a person, or
 *     `npm run i18n:onscreen -- --force-rtl`, can say that. A page can be perfectly logical and
 *     still put the wrong thing first.
 *
 * ── THE EXCEPTIONS ARE LINES, NOT FILES, AND EACH NEEDS A REASON ───────────────────
 * A decorative blob at `-end-16` mirrors harmlessly and was swept with everything else. What is
 * listed below is the residue that must NOT mirror, and there are three of them.
 *
 * Exit 1 on any finding, so it reads as a test.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app', 'components']

/** phys -> logical, longest first so `rounded-tl` never falls through to `rounded-l`. */
const PAIRS = [
  ['rounded-tl', 'rounded-ss'], ['rounded-tr', 'rounded-se'],
  ['rounded-bl', 'rounded-es'], ['rounded-br', 'rounded-ee'],
  ['rounded-l', 'rounded-s'], ['rounded-r', 'rounded-e'],
  ['border-l', 'border-s'], ['border-r', 'border-e'],
  ['scroll-ml', 'scroll-ms'], ['scroll-mr', 'scroll-me'],
  ['scroll-pl', 'scroll-ps'], ['scroll-pr', 'scroll-pe'],
  ['text-left', 'text-start'], ['text-right', 'text-end'],
  ['float-left', 'float-start'], ['float-right', 'float-end'],
  ['clear-left', 'clear-start'], ['clear-right', 'clear-end'],
  ['ml', 'ms'], ['mr', 'me'], ['pl', 'ps'], ['pr', 'pe'],
  ['left', 'start'], ['right', 'end'],
]

const NO_SUFFIX = new Set(['text-left', 'text-right', 'float-left', 'float-right',
  'clear-left', 'clear-right'])
const OPTIONAL_SUFFIX = new Set(['border-l', 'border-r', 'rounded-l', 'rounded-r',
  'rounded-tl', 'rounded-tr', 'rounded-bl', 'rounded-br'])

/**
 * Lines whose physical direction is DELIBERATE. Substring-matched against the line, so each one
 * is as narrow as the thing it excuses.
 */
const KEEP = [
  {
    match: '-translate-x-1/2',
    why: 'CENTRING, WHICH IS SYMMETRIC. `-translate-x-1/2` beside `left-1/2` is the standard '
      + 'centre-an-absolute-element idiom, and mirroring half of it would move the element by '
      + 'a whole width in the wrong direction. `Testimonials` positions its two arrows off a '
      + 'custom property with this; the anchors around it ARE logical.',
  },
  {
    match: 'gn-sheen',
    why: 'A KEYFRAME ANIMATES `translateX` ONE WAY. `app/globals.css` sweeps the highlight '
      + 'across the Premium card from a fixed side, so the element\'s anchor has to agree with '
      + 'the animation rather than with the reader. Mirroring it would start the sheen off the '
      + 'wrong edge and travel away from the card. Decorative; a right-to-left reader sees the '
      + 'same sweep, not a broken one.',
  },
  {
    match: 'bg-gradient-to-r',
    why: 'A DECORATIVE WASH WITH NO EDGE TO ANCHOR TO. `bg-linear-to-r` has no logical form in '
      + 'Tailwind and the gradient reads as a wash rather than as a direction — nothing is '
      + 'positioned by it and nothing points along it.',
  },
]

/** Lucide icons that POINT somewhere. `dir` does not mirror an SVG; `rtl:-scale-x-100` does. */
const DIRECTIONAL_ICONS = ['ChevronLeft', 'ChevronRight', 'ChevronsLeft', 'ChevronsRight',
  'ArrowLeft', 'ArrowRight', 'MoveLeft', 'MoveRight', 'CornerDownLeft']
const MIRROR_CLASS = 'rtl:-scale-x-100'

/**
 * ZERO, AND IT IS A FLOOR RATHER THAN A BACKLOG. 430 was the figure the day the pass ran and
 * every one of them was converted, so a new physical utility fails the build.
 *
 * Raising it is a deliberate act that owes a reason on this line — and the better answer to a
 * false positive is a `KEEP` entry, which is diffable and carries its reason, rather than a
 * number that quietly admits an unknown quantity of un-mirrorable layout.
 */
const CEILING = 0

// ── SCANNING ────────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry)) out.push(full.split('\\').join('/'))
  }
  return out
}

/** A comment line. The prose in this codebase names these classes constantly. */
function isComment(line) {
  const t = line.trimStart()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')
}

function physicalIn(line) {
  const hits = []
  for (const [phys, logical] of PAIRS) {
    const tail = NO_SUFFIX.has(phys) ? '(?![-\\w])'
      : OPTIONAL_SUFFIX.has(phys) ? '(?=[\\s"\'`}\\-])'
        : '(?=-)'
    const re = new RegExp('(?<=[\\s"\'`{(:])-?' + phys + tail, 'g')
    if (re.test(line)) hits.push(`${phys}- -> ${logical}-`)
  }
  return hits
}

const findings = []
const excused = []

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (isComment(line)) return

      const keep = KEEP.find(k => line.includes(k.match))
      const hits = physicalIn(line)
      if (hits.length > 0) {
        if (keep) excused.push({ file, line: i + 1, why: keep.match })
        else findings.push({ kind: 'PHYSICAL', file, line: i + 1, detail: hits.join(', ') })
      }

      // A directional icon with no mirror. Matched on the OPENING tag only; a multi-line
      // element's className may be several lines down, so the whole element is re-read.
      for (const icon of DIRECTIONAL_ICONS) {
        const open = new RegExp('<' + icon + '\\b')
        if (!open.test(line)) continue
        // FROM THE ICON'S OWN TAG, NOT FROM THE START OF THE LINE. A ternary puts two icons on
        // one line — `isOpen ? <ChevronDown …/> : <ChevronRight …/>` — and slicing to the FIRST
        // `/>` read the wrong element's classes and reported the second as unmirrored. Found by
        // this gate's own first run, which is the shape a false positive ought to have.
        const window = lines.slice(i, i + 8).join('\n')
        const rest = window.slice(window.search(open))
        const end = rest.indexOf('/>')
        const element = end >= 0 ? rest.slice(0, end) : rest
        if (!element.includes(MIRROR_CLASS)) {
          findings.push({
            kind: 'UNMIRRORED-ICON', file, line: i + 1,
            detail: `<${icon}> has no \`${MIRROR_CLASS}\` — \`dir\` mirrors layout, never a glyph`,
          })
        }
      }
    })
  }
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────

console.log('')
console.log('  PHYSICAL DIRECTION — layout that will not mirror when the reader does.')
console.log('')

for (const f of findings) {
  console.log(`  ${f.kind.padEnd(17)} ${f.file}:${f.line}`)
  console.log(`  ${''.padEnd(17)} ${f.detail}`)
  console.log('')
}

if (excused.length > 0) {
  console.log(`  ${excused.length} line(s) excused by a KEEP rule, each for a stated reason:`)
  for (const k of KEEP) {
    const n = excused.filter(e => e.why === k.match).length
    if (n === 0) continue
    console.log(`    ${k.match}  (${n})`)
    console.log(`      ${k.why}`)
  }
  console.log('')
}

console.log(`  ${findings.length} finding(s). Ceiling ${CEILING}.`)
console.log('')

if (findings.length > CEILING) {
  console.log('  ABOVE THE CEILING. Use the logical utility, or add a KEEP entry with a reason.')
  console.log('')
  process.exit(1)
}

console.log('  Under the ceiling. NOTE: this cannot see a class built at runtime, and it')
console.log('  says nothing about whether a mirrored page reads correctly — for that,')
console.log('  npm run i18n:onscreen -- --force-rtl.')
console.log('')
