#!/usr/bin/env node
/**
 * A HOOK IN A MODULE WITH NO `'use client'` IS A PRODUCTION-ONLY CRASH. Count them.
 *
 * ── WHAT THIS CATCHES, AND WHY NOTHING ELSE COULD ──────────────────────────────────
 * `useT()` is exported from `components/layout/LocaleProvider.tsx`, which is `'use client'`.
 * A Server Component that imports it gets a client REFERENCE rather than the function, and
 * calling it throws:
 *
 *     Attempted to call useT() from the server but useT is on the client.
 *
 * That reaches the member as the error boundary over a whole page. It went to production on
 * ten components at once, and **every gate in this repo was green**:
 *
 *   `npm run typecheck`   a client reference has the same TYPE as the function
 *   `npm run lint`        `react-hooks` sees a hook called from a component, which is legal
 *   `npm run build`       the boundary is resolved at RENDER, not at build
 *   `npm test`            none of these components is a pure module
 *   `npm run test:rls`    it calls server ACTIONS; it never renders a component
 *   `npm run i18n:check`  every key exists and is translated. That is all it asks
 *
 * It is invisible in development too, wherever the crashing line sits behind a condition —
 * `DuesBalanceKpi` throws only for a member who HAS a dues summary, so a fixture with none
 * renders it perfectly. Four of the ten were found by a member hitting them in production.
 *
 * ── WHY THE ANSWER IS NOT "ADD `'use client'`" ─────────────────────────────────────
 * Every one of the ten is a component with no state and no handlers, rendered from BOTH sides
 * of the boundary — and several say so at length in their own headers, which is the sharpest
 * version of the failure: the i18n pass added a hook to a component whose doc comment explains
 * why it must not have one. `'use client'` would fix the crash by pushing the module, and
 * everything it imports, into the browser bundle for every reader.
 *
 * The fix is `t` as a PROP. A function crosses a server-to-server boundary by reference and
 * lives happily inside one client bundle; what it cannot do is cross from a Server Component
 * into a Client one. A component with no directive is compiled into whichever side imports it,
 * so a `t` prop is correct for both callers and a missing one is a TYPE error.
 *
 * ── WHAT IT CANNOT SEE ─────────────────────────────────────────────────────────────
 * It reads text, not a module graph. It does not know whether a hook-free module is imported
 * by a Server Component, so it cannot flag the reverse mistake (a `'use client'` module that
 * never needed to be one). And a hook reached through an alias — `const h = useT; h()` — is
 * invisible to it. Both are the honest weak points; the shape it does catch is the one that
 * has actually shipped.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()

/**
 * ZERO, and it is a ratchet like `i18n:literals`' — there is nowhere to lower it to.
 *
 * RAISING IT IS A DELIBERATE ACT AND NEEDS A SENTENCE HERE. The honest reason to want to is a
 * false positive, and the better answer to one of those is a named entry in `NOT_A_COMPONENT`
 * with a reason, which is diffable, rather than a number that quietly admits an unknown number
 * of pages that crash for somebody.
 */
const CEILING = 0

/** Directories swept. `lib/` holds no components that render. */
const ROOTS = ['app', 'components']

const SKIP_DIRS = new Set(['node_modules', '.next', 'design', '__snapshots__'])

/**
 * The hooks that come from a `'use client'` module and therefore cannot be called from a
 * Server Component.
 *
 * ── IT IS THE WHOLE SET, NOT THE THREE THAT CRASHED ────────────────────────────────
 * The bug arrived through `useT`, and listing only the i18n hooks would make this a gate about
 * translation rather than about the boundary — so it is every hook this codebase exports from
 * a `'use client'` module, found by asking:
 *
 *     grep -rlE "^export (function|const) use[A-Z]" lib components app   # then check line 1
 *
 * A NEW ONE OWES A LINE HERE IN THE SAME COMMIT, and forgetting is the honest weak point: a
 * hook missing from this list is a hook this script cannot see. Deriving it instead was
 * considered and is worse — it would mean parsing every module's exports and directive to
 * build a list that is stable for months, to save an edit that is one line.
 *
 * `use`, `useId` and the rest of React's own are NOT here: several are legal in a Server
 * Component, and this is a list of OUR client-only hooks rather than of hooks in general.
 */
const CLIENT_HOOKS = [
  // components/layout/LocaleProvider.tsx — the three the outage came through
  'useT', 'useLocale', 'useIntlTag',
  // components/layout/MoneyProvider.tsx — the money pair, added 2026-09-01 with
  // `families.currency`. THEY BELONG HERE ON THE DAY THEY ARE WRITTEN rather than after the
  // first outage: `useMoney` reads `useIntlTag` and is exported from a `'use client'` module,
  // so it fails in exactly the way the three above did — and eleven components that render
  // money take a `money` PROP precisely because they must not reach for it.
  'useMoney', 'useCurrency',
  // components/marketing/MarketingLocale.tsx — the same three for the public site
  'useMarketingT', 'useMarketingLocale', 'useMarketingIntl',
  // The rest of the client-only surface. None of these has ever been called from a Server
  // Component; they are here so that the first time one is, it is a failing step rather than
  // a member's error screen.
  'useDismissWhenIdle',   // lib/use-dismiss-when-idle.ts
  'useServerState',       // lib/use-server-state.ts
  'useCloseOnNavigate',   // components/layout/header-panel.ts
  'usePagedMembers',      // components/admin/MemberSearch.tsx
  'useConfirm',           // components/ui/confirm.tsx
  'useTableSort',         // components/ui/sortable-header.tsx
]

/**
 * Files whose hook call is not a hook call. Each needs a reason.
 *
 * Empty today, which is the state to keep it in: a component that legitimately calls one of
 * these hooks is a client component and carries the directive.
 */
const NOT_A_COMPONENT = new Map([])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, out)
      continue
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Is `'use client'` the module's DIRECTIVE, rather than a mention of one?
 *
 * A directive prologue may be preceded by comments and by nothing else — so this walks past
 * blank lines and comments and requires the very next statement to be the directive. That
 * distinction is the whole reason this is a function: three of the ten offenders discuss
 * `'use client'` in their header comment, explaining why they deliberately do not have one,
 * and a bare `grep` calls all three client components.
 */
function hasClientDirective(src) {
  let i = 0
  const lines = src.split('\n')
  let inBlockComment = false
  while (i < lines.length) {
    const line = lines[i].trim()
    i++
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false
      continue
    }
    if (line === '') continue
    if (line.startsWith('//')) continue
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true
      continue
    }
    // A TRAILING COMMENT ON THE DIRECTIVE LINE IS STILL A DIRECTIVE, and stripping it is not
    // fussiness: `app/(protected)/error.tsx` is written
    // `'use client' // Error boundaries must be Client Components`, which a stricter test
    // reports as a Server Component calling a hook — the exact false positive this script
    // must not produce, on a file whose whole job is to render when something else failed.
    const statement = line.replace(/\/\/.*$/, '').trim()
    return /^(['"])use client\1\s*;?$/.test(statement)
  }
  return false
}

/** Strip comments and string literals, so a hook named in prose is not a call. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

const findings = []
for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const rel = relative(ROOT, file).split(sep).join('/')
    if (NOT_A_COMPONENT.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    if (hasClientDirective(src)) continue

    const code = codeOnly(src)
    for (const hook of CLIENT_HOOKS) {
      const re = new RegExp(`\\b${hook}\\s*\\(`, 'g')
      for (const m of code.matchAll(re)) {
        // The import itself is not a call.
        const before = code.slice(Math.max(0, m.index - 90), m.index)
        if (/import[^;]*$/.test(before)) continue
        const line = code.slice(0, m.index).split('\n').length
        findings.push({ file: rel, line, hook })
      }
    }
  }
}

console.log('')
console.log('  CLIENT HOOKS ON THE SERVER — a call that throws when the page renders.')
console.log('')

for (const f of findings) {
  console.log(`  ${f.file}:${f.line}`)
  console.log(`      calls ${f.hook}() with no 'use client' directive — take \`t\` as a prop instead`)
  console.log('')
}

console.log(`  ${findings.length} call(s) in ${new Set(findings.map(f => f.file)).size} file(s). Ceiling ${CEILING}.`)
console.log('')
if (findings.length > CEILING) {
  console.log('  OVER THE CEILING. Each of these renders the error boundary over a whole page,')
  console.log('  for every reader who reaches the line — see the header on why nothing else')
  console.log('  in this repo can see it.')
  console.log('')
  process.exit(1)
}
console.log('  Under the ceiling. NOTE: it reads text, not a module graph — see the header')
console.log('  for the two shapes it cannot see.')
console.log('')
