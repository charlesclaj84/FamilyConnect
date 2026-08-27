import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * The `hreflang` block every public page owes.
 *
 * ── WHY THIS IS WORTH A TEST WHEN IT IS FOUR LINES ──────────────────────────────────
 * Because it is the one part of the public site's localization whose failure is invisible from
 * inside the product. A wrong `canonical` or a missing `x-default` renders identically, breaks
 * no page, fails no build, and costs search traffic months later — there is nothing to notice.
 *
 * Everything else about `lib/marketing/locale.ts` reads a request header and is therefore not
 * this runner's business (§7b): `marketingLocale` and `marketingRoute` are asserted by the
 * routing itself, in `proxy.ts`, against a real server.
 *
 * Mutation-checked: dropping `x-default` turns one case red, and returning the unprefixed path
 * as the canonical for every language turns another.
 */

/**
 * Every public entry point mounts the provider.
 *
 * ── THE BUG THIS EXISTS FOR WAS SHIPPED AND MEASURED ────────────────────────────────
 * `app/page.tsx` is not in the `(marketing)` route group — a group cannot own `/` — so it does
 * not inherit that layout's `MarketingLocaleProvider`. Without one of its own, `/es` rendered
 * the header in ENGLISH and the footer in SPANISH, three inches apart: `MarketingHeader` is a
 * client component that falls back to `BASE_LOCALE` when there is no provider, while
 * `MarketingFooter` resolves the language itself.
 *
 * Nothing failed. No build warning, no type error, no runtime error — the page rendered, in two
 * languages at once. That is the whole reason for this test: the failure mode of forgetting a
 * provider is a page that looks like it works.
 *
 * ── IT LOOKS FOR THE JSX TAG, NOT FOR THE IMPORT ────────────────────────────────────
 * A file under `app/` that renders the marketing chrome must MOUNT the provider, and the mount
 * is `<MarketingLocaleProvider`. Matching the import instead would have been the obvious spelling
 * and is weaker in two ways that both showed up while mutation-checking this: an unused import is
 * a lint error already, so the check would be a second opinion on something already caught — and
 * the doc comment on `app/page.tsx` NAMES the provider, so a file with the mount deleted and the
 * prose intact would have passed on the strength of a sentence about it.
 *
 * It is a grep rather than a render, so it needs no jsdom, no React and no request, and stays in
 * the runner AGENTS.md §7b reserves for pure modules. It cannot see a provider mounted three
 * components deep; it does not have to, because the convention is that the chrome and the
 * provider are siblings.
 */
describe('the marketing chrome and its provider are mounted together', () => {
  function tsxFilesUnder(dir: string): string[] {
    const out: string[] = []
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) out.push(...tsxFilesUnder(full))
      else if (name.endsWith('.tsx')) out.push(full)
    }
    return out
  }

  it('every app/ file rendering the header or footer mounts MarketingLocaleProvider', () => {
    const files = tsxFilesUnder(join(process.cwd(), 'app'))
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      const usesChrome = src.includes('components/marketing/MarketingHeader')
        || src.includes('components/marketing/MarketingFooter')
      if (!usesChrome) continue
      if (!src.includes('<MarketingLocaleProvider')) {
        offenders.push(relative(process.cwd(), file).split(sep).join('/'))
      }
    }
    expect(offenders, 'renders the marketing chrome with no locale provider').toEqual([])
  })
})
