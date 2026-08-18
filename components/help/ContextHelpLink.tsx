'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CircleQuestionMark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { matchHelpRoute, type HelpRouteEntry } from '@/lib/help/route-match'

/**
 * The one help affordance that is everywhere: a question mark in the top bar, pointing at
 * the chapter about the screen the member is currently looking at.
 *
 * ── WHY IT IS A CLIENT COMPONENT, WHICH LOOKS LIKE AN ODDITY AND IS NOT ─────────────
 * `app/(protected)/layout.tsx` renders the shell — the rail and this bar — and **App
 * Router does not re-render a shared layout on a client-side navigation** (AGENTS.md, "The
 * shell is built once"). It refetches only the segments below the common layout, so
 * anything the shell resolved when the tab was opened is what it keeps saying however many
 * pages the member visits. A server-resolved "which chapter am I on?" would therefore be
 * frozen at whatever page happened to load first and would silently send somebody reading
 * Accounting to the chapter on the Dashboard.
 *
 * `usePathname()` is a client hook that DOES update on every navigation, which is why this
 * one control in the bar crosses the boundary while its neighbours do not.
 *
 * ── THE INDEX ARRIVES AS A PROP, AND MUST ──────────────────────────────────────────
 * `lib/help/routes.ts` derives it from `lib/help/content.ts` — the entire manual, ~79KB of
 * prose. Importing it here would bundle all of that for the browser on every page in the
 * app. The matcher this runs is `lib/help/route-match.ts`, which has no imports at all for
 * the same reason. See both headers.
 *
 * ── IT DEGRADES TO NOTHING, NEVER TO A BROKEN LINK ─────────────────────────────────
 * Two cases render nothing at all:
 *
 *   * The reader is already IN the manual. An icon on `/help` pointing at `/help` is a
 *     control that does nothing, and one on a chapter page is worse — it competes with the
 *     contents and the neighbour links that are the real navigation there.
 *   * No chapter covers this path. `/coming-soon`, `/upgrade`, `/login`'s siblings and any
 *     screen shipped ahead of its chapter all land here. An icon that 404s, or that lands
 *     on a chapter about something else, teaches a member that the help button is a lie —
 *     and that is the one thing this affordance cannot afford, because it is the control
 *     somebody reaches for when they are already lost.
 *
 * `npm run help:check` asserts that every LIVE screen has a chapter or a stated reason not
 * to, so the second case is a small and visible set rather than an unknown one.
 *
 * ── THE ACCESSIBLE NAME NAMES THE CHAPTER ──────────────────────────────────────────
 * "Help: Accounting", never a bare "Help". A screen reader user tabbing the bar gets four
 * controls; three of them say what they are for and this one has to as well. It is also
 * what makes the control honest about being contextual rather than a link to a manual's
 * front door.
 *
 * ── THE CLASSES ARE `ThemeToggle`'s, VERBATIM ──────────────────────────────────────
 * Same `size-8` square, same hover well, same focus ring, so the bar's controls are one
 * row of one size rather than four things that nearly match. **The explicit
 * `text-brand-ink` is not optional**: `app/globals.css` carries an unscoped
 * `a { color: var(--brand-accent) }` in its base layer, and without it this anchor comes
 * out terracotta in light and Legacy GOLD in dark — the loudest thing in the bar, on its
 * least-used control. Same trap `MainRail`, `Sidebar` and `AdminAccountShell` each carry a
 * comment about.
 *
 * NOT KEYED, unlike `NotificationBell` beside it. It holds no family data and no state at
 * all: `usePathname()` is the only thing it reads, and nothing about the answer differs per
 * member or per family. So neither the `key={familyCode}` rule nor `ShellWatcher` has
 * anything to do with it.
 */
export function ContextHelpLink({
  entries,
  className,
}: {
  /** `HELP_ROUTE_INDEX`, passed down from a server component. */
  entries: readonly HelpRouteEntry[]
  className?: string
}) {
  const pathname = usePathname()

  // The manual does not need a link to itself, and this guard is not merely belt-and-braces:
  // `/help` sits in `help-check`'s `UNDOCUMENTED_OK` today ("there is no chapter about the
  // chapters"), and the day somebody writes that chapter the index would gain a `/help`
  // entry — putting an icon on every chapter page pointing at the manual the reader is
  // already inside. `startsWith('/help/')` rather than a bare prefix test, so a future
  // `/helpdesk` would not be swallowed by it.
  if (pathname === '/help' || pathname.startsWith('/help/')) return null

  const hit = matchHelpRoute(pathname, entries)
  if (!hit) return null

  return (
    <Link
      href={`/help/${hit.slug}`}
      // NOT PREFETCHED. A chapter is one long static page and this icon sits on every
      // screen in the app, so prefetching would fetch a document nobody asked for on every
      // navigation — to save a moment on the rarest control in the bar.
      prefetch={false}
      aria-label={`Help: ${hit.title}`}
      title={`Help: ${hit.title}`}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
        'text-brand-ink transition-colors hover:bg-brand-primary/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <CircleQuestionMark className="size-4" aria-hidden="true" />
    </Link>
  )
}
