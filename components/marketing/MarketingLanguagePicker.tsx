'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Languages } from 'lucide-react'
import { localizedHref, splitLocalePath } from '@/lib/i18n/route-locale'
import { rememberLocalePick } from '@/lib/i18n/locale-pick'
import { hasMarketingLanguageChoice, marketingLocales } from '@/lib/marketing/strings'
import { useMarketingT } from '@/components/marketing/MarketingLocale'
import { cn } from '@/lib/utils'

/**
 * Choose the language the public site is read in.
 *
 * ── LINKS, NOT A SELECT — WHICH IS THE OPPOSITE OF THE DASHBOARD'S PICKER ───────────
 * `components/layout/LocaleSwitcher.tsx` is a native `<select>` calling a server action, and
 * argues that at length. This one is a row of `<a>` elements, and the difference follows from
 * where the language LIVES on each side:
 *
 *   * On the Dashboard the language is a column. Choosing it is a write, so the control is a
 *     form control and its result is a saved preference.
 *   * On Home the language is the ADDRESS. Choosing it is a navigation, so the control is a
 *     link — and it has to be a real one: cmd-click, middle-click, copy-link-address and
 *     right-click-open-in-new-tab are the whole reason the language is in the URL, and a
 *     `<select>` with an `onChange` would take all four away again.
 *
 * ── IT MOVES THE READER TO THE SAME PAGE, NOT TO HOME ───────────────────────────────
 * `usePathname()` gives the address as the reader sees it — `/es/pricing`, prefix included,
 * because a rewrite keeps the original URL. So the current route is what `splitLocalePath`
 * recovers, and each item is that route in its own language. Sending somebody to `/es` from
 * `/pricing` would lose their place, which on a five-page site is the difference between
 * changing language and starting again.
 *
 * ── IT WRITES THE PICK COOKIE BEFORE IT NAVIGATES ───────────────────────────────────
 * This is the load-bearing line and the reason it is not simply three `<Link>`s. `proxy.ts`
 * redirects an unprefixed path to the reader's negotiated language on a first visit, so a
 * Spanish-speaking browser on `/es/pricing` choosing **EN · English** would go to `/pricing` and
 * be bounced straight back — the English option would be a control that cannot be used.
 *
 * `LOCALE_PICK_COOKIE` is what tells the proxy the reader has chosen, and it is set here rather
 * than server-side for the reason its constant's header states: an `<a>` cannot carry a round
 * trip, and a cookie set by the RESPONSE to the navigation arrives after the redirect has
 * already happened.
 *
 * `onClick` still fires for a plain left click before the navigation, and for cmd-click it fires
 * without one — which is correct either way: the reader has expressed a preference, and the new
 * tab they opened is governed by the same cookie.
 *
 * ── THE ENDONYM IS SHOWN WHERE THERE IS ROOM AND READ ALOUD WHERE THERE IS NOT ──────
 * `ES` alone is what fits in a 16px header beside a mark, a theme toggle and two buttons; `ES ·
 * Español` is what a reader actually scans for. So the header gets the code with the endonym in
 * `sr-only`, and `withEndonym` puts it on screen in the mobile disclosure, which has a full row
 * per item. A screen reader announces the same thing either way — the endonym is never hidden
 * from it, because *the word a speaker would use for their own language* is the whole point of
 * having one (see `lib/i18n/locales.ts`).
 */
export function MarketingLanguagePicker({ className, withEndonym = false }: {
  className?: string
  /** Show the endonym on screen as well as to a screen reader. For a full-width row. */
  withEndonym?: boolean
}) {
  const pathname = usePathname()
  const t = useMarketingT()

  if (!hasMarketingLanguageChoice()) return null

  const { locale: current, path } = splitLocalePath(pathname || '/')
  const locales = marketingLocales()

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Languages className="h-4 w-4 text-brand-on-soft/70" aria-hidden="true" />
      <span className="sr-only" id="marketing-language-label">{t('mkt.language')}</span>
      <ul
        className="flex items-center gap-1"
        aria-labelledby="marketing-language-label"
      >
        {locales.map(l => {
          const active = l.code === current
          return (
            <li key={l.code}>
              {/* `aria-current="true"` rather than `page`: the reader IS on this page, in a
                  different language, so "page" would claim the other two are elsewhere. */}
              <Link
                href={localizedHref(path, l.code)}
                hrefLang={l.code}
                onClick={() => rememberLocalePick(l.code)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide transition-colors',
                  // Explicit colours on BOTH branches: globals.css carries an unscoped
                  // `a { color: var(--brand-accent) }`, so an inactive item left alone comes
                  // out in the accent and reads as the selected one. Same trap MainRail,
                  // Sidebar and AdminAccountShell each carry a comment about.
                  active
                    ? 'bg-brand-soft text-brand-on-soft'
                    : 'text-brand-on-soft/70 hover:bg-brand-soft hover:text-brand-on-soft',
                )}
              >
                {l.code}
                <span className={withEndonym ? 'ml-1 normal-case' : 'sr-only'}>
                  {' · '}{l.endonym}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
