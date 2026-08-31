import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * THE CONVERSIONS API ACCESS TOKEN MUST NEVER REACH A BROWSER BUNDLE.
 *
 * Next already makes that true by construction — a variable without a `NEXT_PUBLIC_` prefix
 * is not inlined, so a client component referencing it compiles to `undefined`. That is a
 * reason the mistake is not FATAL; it is not a reason not to make it. A reference in a
 * client module would be a silent no-op that reads as working code, and the next person to
 * "fix" it would reach for the prefix.
 *
 * So this walks the module graph from every `'use client'` file in the tree and asserts
 * that nothing reachable from one names a server-only variable. It is a static sweep with
 * the same honest limitation as `audit:family-scope`: it cannot see a dynamic `import()` or
 * a name assembled at runtime. Both are absent from this codebase and both would be visible
 * in a diff.
 *
 * Mutation-checked: adding `process.env.META_CONVERSIONS_API_ACCESS_TOKEN` to
 * lib/meta/pixel.ts turns the first case red, and importing `@/lib/meta/capi` from
 * components/meta/MetaPixel.tsx turns the second red.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCAN = ['app', 'lib', 'components']

/** Variables that must exist only on the server. `META_PIXEL_ID` is deliberately absent — */
/** a Pixel id is public, and it reaches the browser as a PROP rather than as a variable. */
const SERVER_ONLY_ENV = [
  'META_CONVERSIONS_API_ACCESS_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  // ── STRIPE, ADDED 2026-08-23 ──────────────────────────────────────────────────────
  // `STRIPE_SECRET_KEY` is the strongest reason this file exists: it can charge, refund and
  // read every customer on GENORRA's account, and with a `Stripe-Account` header it acts on
  // every connected family's account too. The two webhook secrets are what stand between a
  // POST from the internet and a family being granted a tier they did not pay for.
  //
  // THERE IS NO PUBLISHABLE KEY HERE AND THAT IS THE DESIGN. A publishable key would be
  // legitimately client-side — but this integration uses HOSTED Checkout, so the browser
  // never loads Stripe.js and is only ever handed one URL to visit. Nothing about Stripe
  // belongs in a client bundle at all, which makes this list absolute rather than a
  // judgement about which key is safe to ship.
  //
  // The PRICE ids are deliberately absent: they are not secrets, and they are also never
  // read client-side, so listing them would be a rule nothing enforces.
  'STRIPE_SECRET_KEY',
  'STRIPE_PLATFORM_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
]

/** Modules that read a secret, hold `node:crypto`, or touch the database. */
const SERVER_ONLY_MODULES = [
  '@/lib/meta/capi',
  '@/lib/meta/config',
  '@/lib/meta/dispatch',
  '@/lib/meta/conversions',
  '@/lib/meta/billing',
  '@/lib/meta/hash',
  '@/lib/meta/event-id',
  '@/lib/meta/identity',
  '@/lib/meta/attribution-store',
  '@/lib/supabase/admin',
  // ── THE STRIPE MODULES ────────────────────────────────────────────────────────────
  // Every one of these either reads the secret key, holds the SDK, or writes a family's
  // billing state. `lib/platform-billing.ts` is deliberately NOT here: it is the pure
  // arithmetic half, it reads no environment and touches no database, and a client component
  // that wanted to render a paid-through date is entitled to import it.
  '@/lib/stripe/client',
  '@/lib/stripe/config',
  '@/lib/stripe/webhook',
  '@/lib/stripe/webhook-route',
  '@/lib/stripe/platform-events',
  '@/lib/stripe/connect-events',
  '@/lib/stripe/tier-sweep',
  '@/lib/dues-routing',
]

/**
 * ONE PRE-EXISTING CHAIN, STATED RATHER THAN TOLERATED.
 *
 * Found by this sweep on its first run, and it predates the Meta integration entirely:
 *
 *     components/admin/resource-groups.ts   (a plain module, imported by client components)
 *       → @/lib/auth/permissions            (for the `PERMISSION_ACTIONS` value)
 *         → @/lib/supabase/admin            (which reads SUPABASE_SERVICE_ROLE_KEY)
 *
 * IT IS NOT A LEAK TODAY, and the reason is the one the header gives about Next: the key
 * has no `NEXT_PUBLIC_` prefix, so it is not inlined and the reference compiles to
 * `undefined`. It is still worth fixing — the repair is to move `PERMISSION_ACTIONS` into a
 * pure module, exactly as `lib/gathering-panes.ts` and `components/admin/account-sections.ts`
 * already do for their own client/server boundary — and it is recorded here rather than
 * silently widening the rule, so the gate keeps its meaning for everything else.
 *
 * The list is an EXACT match on `path → name`, so a new occurrence in the same file is a
 * failure rather than a tolerated repeat. Same discipline as `audit:family-scope`: a stated
 * verdict, never a suppressed one.
 */
const KNOWN_PRE_EXISTING = [
  'lib/supabase/admin.ts → SUPABASE_SERVICE_ROLE_KEY',
  'lib/auth/tier.ts → @/lib/supabase/admin',
  'lib/auth/family.ts → @/lib/supabase/admin',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const FILES = SCAN.flatMap((d) => walk(join(ROOT, d))).map((path) => ({
  path: path.slice(ROOT.length + 1).replace(/\\/g, '/'),
  source: readFileSync(path, 'utf8'),
}))

const isClient = (source: string) => /^\s*['"]use client['"]/m.test(source)

/**
 * A `'use server'` module is a BOUNDARY, not an edge to follow.
 *
 * This is the correction that made this sweep true rather than merely strict. A client
 * component importing `registerUser` does not pull `app/actions/register.ts` into the
 * bundle: Next replaces the import with an RPC stub and the module's body — its secrets,
 * its admin client, its `node:crypto` — stays on the server. Following that edge reported
 * every server action in the product as a leak, which is the sort of finding that gets a
 * whole test deleted.
 *
 * The boundary cuts the other way too, and that is why it is safe to stop here: everything
 * reachable only THROUGH a server action is, by definition, only ever executed on the
 * server.
 */
const isServer = (source: string) => /^\s*['"]use server['"]/m.test(source)

/**
 * Everything a client component can pull in, transitively.
 *
 * Resolved by matching the `@/…` import specifiers rather than by parsing — every internal
 * import in this codebase uses that alias, and a regex over specifiers is exact for the one
 * question being asked.
 */
function clientReachable(): Set<string> {
  const byModule = new Map(FILES.map((f) => [
    '@/' + f.path.replace(/\.tsx?$/, ''),
    f,
  ]))
  const seen = new Set<string>()
  const queue = FILES.filter((f) => isClient(f.source)).map((f) => f.path)

  while (queue.length > 0) {
    const path = queue.pop()!
    if (seen.has(path)) continue
    seen.add(path)
    const file = FILES.find((f) => f.path === path)
    if (!file) continue
    for (const match of file.source.matchAll(/from\s+['"](@\/[^'"]+)['"]/g)) {
      // A type-only import is erased at build time and carries nothing into the bundle.
      const line = file.source.slice(
        file.source.lastIndexOf('\n', match.index) + 1,
        match.index,
      )
      if (/^\s*import\s+type\b/.test(line)) continue
      const target = byModule.get(match[1]) ?? byModule.get(`${match[1]}/index`)
      // Stop at a server action — see `isServer`.
      if (target && !isServer(target.source)) queue.push(target.path)
    }
  }
  return seen
}

describe('the browser bundle', () => {
  const reachable = clientReachable()

  it('reaches at least the components under test — otherwise this proves nothing', () => {
    // A sweep that resolves nothing passes trivially. Same argument as the positive control
    // in tests/rls: assert the harness can see the thing it is asserting about.
    expect(reachable.has('components/meta/MetaPixel.tsx')).toBe(true)
    expect(reachable.has('lib/meta/pixel.ts')).toBe(true)
    expect(reachable.has('lib/meta/events.ts')).toBe(true)
    expect(reachable.size).toBeGreaterThan(20)
  })

  it('never names a server-only environment variable', () => {
    const offenders: string[] = []
    for (const path of reachable) {
      const source = FILES.find((f) => f.path === path)!.source
      for (const name of SERVER_ONLY_ENV) {
        if (source.includes(`process.env.${name}`)) offenders.push(`${path} → ${name}`)
      }
    }
    expect(offenders.filter((o) => !KNOWN_PRE_EXISTING.includes(o))).toEqual([])
    // The Conversions API token specifically is absolute: nothing, pre-existing or not,
    // may name it from anywhere a browser can reach.
    expect(offenders.filter((o) => o.includes('META_CONVERSIONS_API_ACCESS_TOKEN'))).toEqual([])
  })

  it('never imports a module that reads a secret or the database', () => {
    const offenders: string[] = []
    for (const path of reachable) {
      const source = FILES.find((f) => f.path === path)!.source
      for (const mod of SERVER_ONLY_MODULES) {
        // Value imports only — a `import type {…}` is erased.
        const pattern = new RegExp(`(?<!import type[^\\n]*)from\\s+['"]${mod}['"]`)
        const lines = source.split('\n').filter((l) => l.includes(`from '${mod}'`))
        if (lines.some((l) => !/^\s*import\s+type\b/.test(l)) && pattern.test(source)) {
          offenders.push(`${path} → ${mod}`)
        }
      }
    }
    expect(offenders.filter((o) => !KNOWN_PRE_EXISTING.includes(o))).toEqual([])
    // Every `lib/meta/` server module is absolute, pre-existing list or not.
    expect(offenders.filter((o) => o.includes('@/lib/meta/'))).toEqual([])
  })
})

describe('no colour literal was smuggled in with the Pixel', () => {
  it('holds for every file this integration added', () => {
    // AGENTS.md: app/globals.css is the only file in the app that may contain a colour
    // literal. The consent banner is new UI, which is exactly where one gets typed.
    const added = FILES.filter((f) =>
      f.path.startsWith('lib/meta/') || f.path.startsWith('components/meta/')
      || f.path.startsWith('components/consent/') || f.path === 'lib/consent.ts')
    expect(added.length).toBeGreaterThan(8)
    for (const file of added) {
      expect(file.source, `${file.path} contains a colour literal`).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    }
  })
})
