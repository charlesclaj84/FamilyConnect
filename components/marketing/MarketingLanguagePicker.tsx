'use client'

import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { localizedHref, splitLocalePath } from '@/lib/i18n/route-locale'
import { rememberLocalePick } from '@/lib/i18n/locale-pick'
import { hasMarketingLanguageChoice, marketingLocales } from '@/lib/marketing/strings'
import { useMarketingT } from '@/components/marketing/MarketingLocale'
import { useDismissWhenIdle } from '@/lib/use-dismiss-when-idle'
import { cn } from '@/lib/utils'

/**
 * Choose the language the public site is read in.
 *
 * ── A DROPDOWN OF REAL LINKS, WHICH IS BOTH HALVES OF THE ANSWER ────────────────────
 * It was a row of three chips — `EN` `ES` `FR` sitting in the header — until 2026-08-29, on the
 * argument that the language is the ADDRESS here and a link is the honest control for a
 * navigation. That argument was right and is kept; what it did not survive is the header being
 * full. Three chips is a control that grows with the product: a fourth language is a fourth
 * thing competing with the mark, the theme toggle, Sign in and the call to action, on a bar
 * that already hides the picker below `sm` for want of room. A disclosure is one control at any
 * number of languages, and it is the shape a reader expects a language switch to be.
 *
 * So it is a dropdown whose ITEMS ARE STILL ANCHORS, and that is not a detail: cmd-click,
 * middle-click, right-click-open-in-new-tab and copy-link-address are the whole reason the
 * language is in the URL rather than in a cookie. A `<select>` with an `onChange` — which is
 * what the Dashboard's switcher is, correctly, because there the language is a COLUMN and
 * choosing it is a write — would take all four away again.
 *
 * ── AND THEY ARE PLAIN `<a>`, NOT `next/link`. THIS IS THE "CLICK IT TWICE" FIX ─────
 * Reported as: *choosing a language does nothing until you choose it a second time.*
 *
 * The language is a property of the DOCUMENT, not of the page segment, and a client-side
 * navigation cannot change it. Two things say so, and the first needs no measurement at all:
 *
 *   * **`<html lang>` is set in `app/layout.tsx` from the request header.** The root layout
 *     renders once per document and never re-renders on a client-side navigation — which is
 *     precisely why `components/layout/LocaleSync.tsx` exists to poke that attribute from an
 *     effect on the Dashboard. So a `<Link>` switch left `lang="en"` on a page of Spanish
 *     prose, which is the one thing that attribute must never say: a screen reader uses it to
 *     choose pronunciation.
 *
 *   * **All three languages resolve to ONE route.** Measured: `GET /es/pricing` answers
 *     `x-middleware-rewrite: /pricing`, because `proxy.ts` serves every language from the
 *     unprefixed page and carries the locale in a request header. So `/pricing` and
 *     `/es/pricing` are the same route tree, `app/(marketing)/layout.tsx` is a COMMON layout
 *     across that navigation, and AGENTS.md's own rule applies — *"App Router does not
 *     re-render a shared layout on a client-side navigation"*. `MarketingLocaleProvider` is
 *     mounted there, so it goes on handing every client component under it the language the
 *     reader has just left.
 *
 * A plain `<a>` is a full document load, which re-runs both layouts and the negotiation with
 * them. It costs one navigation on a control somebody presses about once, and it is the only
 * shape that can be right — there is nothing to memoise around, because what has to change is
 * the `<html>` element itself.
 *
 * ── IT MOVES THE READER TO THE SAME PAGE, NOT TO HOME ───────────────────────────────
 * `usePathname()` gives the address as the reader sees it — `/es/pricing`, prefix included,
 * because a rewrite keeps the original URL. So the current route is what `splitLocalePath`
 * recovers, and each item is that route in its own language. Sending somebody to `/es` from
 * `/pricing` would lose their place, which on a five-page site is the difference between
 * changing language and starting again.
 *
 * ── IT WRITES THE PICK COOKIE BEFORE IT NAVIGATES ───────────────────────────────────
 * This is the load-bearing line and the reason the items are not simply three hrefs. `proxy.ts`
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
 * ── THE TRIGGER SHOWS THE CODE; THE PANEL SHOWS THE ENDONYM ─────────────────────────
 * `ES` alone is what fits in a 16px header beside a mark, a theme toggle and two buttons. Inside
 * the panel there is a full row per language, so `Español` is on screen where a reader actually
 * scans for it — *the word a speaker would use for their own language* is the whole point of
 * having one (see `lib/i18n/locales.ts`). Both are announced either way: the trigger's
 * `aria-label` names the control and its current value, because a bare `ES` is an abbreviation
 * a screen reader spells out with no idea what it abbreviates.
 *
 * `withEndonym` puts the endonym on the TRIGGER as well, for the mobile disclosure, where the
 * row is full width and there is nothing to compete with.
 *
 * ── CODES AND ENDONYMS, NEVER FLAGS ─────────────────────────────────────────────────
 * A flag is a COUNTRY and a language is not — Spanish is not Spain to a family in Monterrey,
 * English is not the United States to one in Lagos. `lib/i18n/locales.ts` carries that decision
 * and has no `flag` field for it to be undone with.
 *
 * ── NOT `role="menu"` ───────────────────────────────────────────────────────────────
 * A disclosure button and a list of links, which is what it is. `role="menu"` would promise
 * arrow-key roving focus and `aria-activedescendant` that are not implemented, and a screen
 * reader changes its own key handling to match — the same call `MainRail` makes about
 * `role="tablist"` and `RowMenu` about `role="menu"`. `aria-expanded` and `aria-controls` are
 * the whole contract here, and both are honoured.
 */
export function MarketingLanguagePicker({ className, withEndonym = false }: {
  className?: string
  /** Show the endonym on the trigger as well as in the panel. For a full-width row. */
  withEndonym?: boolean
}) {
  const pathname = usePathname()
  const t = useMarketingT()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Closes a few seconds after the reader stops using it — the same beat as every other
  // dropdown in the product. The trigger and the panel are named individually rather than a
  // wrapper around them, because the wrapper also holds the full-viewport scrim, and testing
  // that would call every pointer position on the page "inside the menu".
  useDismissWhenIdle({
    open,
    close: () => setOpen(false),
    parts: () => [trigger.current, panel.current],
  })

  if (!hasMarketingLanguageChoice()) return null

  const { locale: current, path } = splitLocalePath(pathname || '/')
  const locales = marketingLocales()
  const currentLocale = locales.find(l => l.code === current) ?? locales[0]

  return (
    <div className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="marketing-language-panel"
        aria-label={`${t('mkt.language')}: ${currentLocale.endonym}`}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-brand-ink/70 transition-colors hover:bg-brand-soft/60 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span aria-hidden="true">{currentLocale.code}</span>
        {withEndonym && (
          <span aria-hidden="true" className="normal-case">{` · ${currentLocale.endonym}`}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Click-away. Under the panel and over everything else in the header. */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panel}
            id="marketing-language-panel"
            className="absolute right-0 top-full z-40 mt-1 min-w-[11rem] overflow-hidden rounded-xl border bg-card py-1 shadow-lg"
          >
            <ul>
              {locales.map(l => {
                const active = l.code === current
                return (
                  <li key={l.code}>
                    {/*
                      A PLAIN ANCHOR, deliberately — see the header. `next/link` here is the
                      "press it twice" bug, because the language lives on `<html>` and on a
                      layout, neither of which a client-side navigation re-renders.

                      `aria-current="true"` rather than `page`: the reader IS on this page, in
                      a different language, so "page" would claim the other two are elsewhere.
                    */}
                    <a
                      href={localizedHref(path, l.code)}
                      hrefLang={l.code}
                      onClick={() => rememberLocalePick(l.code)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                        // Explicit colours on BOTH branches: globals.css carries an unscoped
                        // `a { color: var(--brand-accent) }`, so an inactive item left alone
                        // comes out in the accent and reads as the selected one. Same trap
                        // MainRail, Sidebar and AdminAccountShell each carry a comment about.
                        active
                          ? 'bg-brand-soft font-medium text-brand-on-soft'
                          : 'text-card-foreground hover:bg-muted',
                      )}
                    >
                      {/* Drawn on every row and made invisible on the inactive ones, so the
                          three labels line up instead of the chosen one being indented past
                          its neighbours. */}
                      <Check
                        className={cn('h-4 w-4 shrink-0', !active && 'invisible')}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                        {l.code}
                      </span>
                      <span className="min-w-0 flex-1">{l.endonym}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
