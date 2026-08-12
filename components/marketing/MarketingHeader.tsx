'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { MARKETING_ROUTES, ACCOUNT_ROUTES } from '@/lib/marketing-nav'
import { APP_NAME, APP_LOGO_ALT, BRAND_MARK_SRC } from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * The public site's header, extracted from `app/page.tsx` when the marketing surface grew
 * from one page to six.
 *
 * WHY IT IS A CLIENT COMPONENT when the landing page's inline version was not: five nav
 * links do not fit beside the brand and two buttons on a phone, so below `lg` they
 * collapse into a disclosure. That needs state. The cost is real and worth naming — this
 * is on every public page, so it ships JavaScript to the one audience most likely to be
 * on a slow connection. It is kept small deliberately: no animation library, no portal,
 * no focus-trap dependency.
 *
 * NOT A `role="navigation"` TABLIST OR MENU. It is a `<nav>` containing links, which is
 * what it is. `aria-expanded` and `aria-controls` on the trigger are the whole contract,
 * and both are implemented — unlike `role="menu"`, which would promise arrow-key roving
 * focus this does not have. Same reasoning as `MainRail` refusing `role="tablist"`.
 *
 * THE EXPLICIT TEXT COLOURS ARE LOAD-BEARING. `app/globals.css` carries an unscoped
 * `a { color: var(--brand-accent) }` in its base layer, so every link here comes out
 * terracotta without them — including the ones meant to read as plain nav. Both branches
 * of the active/inactive ternary set a colour for that reason; do not remove one.
 */
export function MarketingHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b bg-brand-bar">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image
            src={BRAND_MARK_SRC}
            alt={APP_LOGO_ALT}
            width={40}
            height={40}
            className="h-9 w-9 shrink-0"
            priority
          />
          {/* The wordmark is set, not placed — `.gn-wordmark` is the brand board's
              letterspaced Cormorant caps in CSS. Hidden below sm for the same reason the
              landing page hides it: at text-xl with 0.18em tracking it wants ~116px, and
              a 375px screen has to fit the mark, the menu trigger and two actions. */}
          <span className="gn-wordmark hidden truncate text-xl text-brand-ink sm:block">
            {APP_NAME}
          </span>
        </Link>

        {/* ── Desktop nav ───────────────────────────────────────────────── */}
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {MARKETING_ROUTES.map(route => {
            const active = pathname === route.href
            return (
              <Link
                key={route.href}
                href={route.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'text-brand-ink'
                    : 'text-brand-ink/70 hover:bg-brand-soft/60 hover:text-brand-ink',
                )}
              >
                {route.label}
                {/* The active marker is a gold underline rather than a fill: the header
                    band is already Heritage-adjacent, and a filled pill on it competes
                    with the two buttons to its right for the same attention. */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-legacy"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          <Link href={ACCOUNT_ROUTES.login} className="hidden sm:block">
            <Button variant="outline" size="icon" aria-label="Sign in" className="sm:w-auto sm:gap-1.5 sm:px-2.5">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          </Link>

          <Link href={ACCOUNT_ROUTES.register}>
            <Button className="gn-shimmer-hover">Get Started Free</Button>
          </Link>

          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-brand-ink/15 text-brand-ink transition-colors hover:bg-brand-soft/60 lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile nav ─────────────────────────────────────────────────────
          Rendered only when open rather than hidden with a class: a hidden nav is
          still in the tab order in some browsers, and five off-screen links ahead
          of the page content is a worse first keyboard experience than a trigger.

          A vertical stack, one item per line, with the marker on the LEFT edge —
          the same decision `MainRail` documents for the same reason: a full-width
          bottom border under a stacked item is indistinguishable from a divider
          between two items. */}
      {open && (
        <nav
          id="marketing-mobile-nav"
          aria-label="Main"
          className="border-t bg-brand-bar px-4 pb-4 pt-2 lg:hidden"
        >
          <ul className="flex flex-col">
            {MARKETING_ROUTES.map(route => {
              const active = pathname === route.href
              return (
                <li key={route.href}>
                  <Link
                    href={route.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center border-l-2 py-2.5 pl-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-brand-legacy text-brand-ink'
                        : 'border-transparent text-brand-ink/70 hover:text-brand-ink',
                    )}
                  >
                    {route.label}
                  </Link>
                </li>
              )
            })}
            <li className="mt-2 border-t pt-2 sm:hidden">
              <Link
                href={ACCOUNT_ROUTES.login}
                onClick={() => setOpen(false)}
                className="flex items-center border-l-2 border-transparent py-2.5 pl-3 text-sm font-medium text-brand-ink/70 transition-colors hover:text-brand-ink"
              >
                Sign In
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
