import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'
import { requireStaff } from '@/lib/auth/staff'
import { APP_NAME, APP_LOGO_ALT, BRAND_MARK_SRC } from '@/lib/brand'
import { PAGE_MEASURE } from '@/components/layout/PageShell'
import { ConfirmProvider } from '@/components/ui/confirm'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { StaffNav } from '@/components/staff/StaffNav'
import { cn } from '@/lib/utils'
import { callerI18n } from '@/lib/i18n/server'
import { LocaleProvider } from '@/components/layout/LocaleProvider'

/**
 * The GENORRA staff console — a separate application that happens to share a codebase.
 *
 * ── WHY ITS OWN ROUTE GROUP ────────────────────────────────────────────────────────
 * `app/(staff)` is a sibling of `app/(protected)`, so it inherits NOTHING from the
 * member product: not the sidebar, not the TopBar, not `ConfirmProvider`, not
 * `IdleTimeout`, not `ShellWatcher`, and — the one that decides it — not
 * `<main key={familyCode}>`. Every one of those is built around the caller acting in ONE
 * family, and this console is defined by having no family at all. Nesting these screens
 * under the protected layout would have wrapped a cross-family tool in a shell that
 * resolves `viewableResources()`, draws a rail of one family's pages and remounts itself
 * when that family changes — none of which means anything here.
 *
 * It is the same reasoning AGENTS.md gives for Home and Dashboard being two products
 * rather than two views: opposite rules, so a change aimed at one is usually wrong in the
 * other. This is a third.
 *
 * ── THE GUARD IS HERE *AND* ON EVERY PAGE AND EVERY ACTION ─────────────────────────
 * `requireStaff()` below is a convenience, not a gate — exactly the distinction AGENTS.md
 * §2 draws between a page and the server action behind it. A layout runs when Next
 * renders it; a server action reached by POST does not render it at all, and a route
 * added under this group tomorrow could resolve through a different layout. So each page
 * calls it again and each action in `app/actions/staff/*` calls it first. Three calls,
 * one memoized query (`staffGrant` is `cache()`d per request).
 *
 * It 404s rather than refusing. See `lib/auth/staff.ts`: a screen that says "you are not
 * GENORRA staff" tells every signed-in customer that a cross-family console exists and
 * how you get into it.
 *
 * ── NO `permission_resources` ROW FOR ANY OF THIS ──────────────────────────────────
 * Stated here because it is where a reader following AGENTS.md §6 will look for one.
 * These are not family surfaces: there is no family to administer them, and a row would
 * print a "GENORRA Staff" switch on every customer's Members & Access grid, giving away
 * the thing the 404 above exists to keep quiet. The full argument is in
 * `lib/auth/staff.ts`.
 *
 * ── `/staff` IS NOT IN `lib/features.ts`, AND MUST NOT BE ──────────────────────────
 * That registry answers two questions about the MEMBER product — has this shipped, and
 * is it in the family's plan — and neither applies. An entry would also give the console
 * a rail item, a Coming Soon screen and a tier, and would put it in front of
 * `npm run help:check`, which asks that every LIVE feature has a chapter in the manual.
 * The manual documents the member product. `isGatedPath('/staff')` answers false for an
 * unregistered path, which is exactly the fall-through that registry is designed for.
 *
 * ── IT IS NOT NAMED IN `app/robots.ts` EITHER ──────────────────────────────────────
 * Deliberately, and on that file's own reasoning: `robots.txt` is world-readable and is
 * the first thing anyone probing a site fetches, so listing a route there discloses it.
 * `noindex` below is the mechanism that actually keeps a page out of an index, and it
 * needs no disclosure to work.
 */
export const metadata: Metadata = {
  // Replaces the root layout's `index: true` for this whole subtree, the same way
  // app/(protected)/layout.tsx does. A staff console is the last thing that should be
  // reachable from a search result, and every page under here inherits this by existing.
  robots: { index: false, follow: false, nocache: true },
  // Its OWN title template, so a tab that belongs to the console says so. The root
  // layout's is `%s — GENORRA`, which would make these screens indistinguishable from the
  // member product in a row of tabs — and somebody with the console open has the product
  // open beside it, which is the whole reason it opens in a new window.
  title: {
    default: 'Staff Console',
    template: `%s — ${APP_NAME} Staff`,
  },
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  // RESTORED 2026-08-19. This line read
  //
  //     const staff = { email: 'MUTATED', role: 'support' } as Awaited<ReturnType<typeof requireStaff>>
  //
  // from 3e653b7 until now: a mutation-testing artifact that was committed and never put
  // back. It was NOT an authentication hole — every page under this group and every action
  // in `app/actions/staff/*` calls `requireStaff()` itself, which is the design the section
  // above describes, and that is what kept the console shut. Three real things were wrong,
  // and the third is the one that would eventually have cost something:
  //
  //   * the header printed `MUTATED` as the acting account, to every staff member
  //   * `role` was pinned to `'support'`, and this layout is the ONLY place the console
  //     prints it — so after 20260819000002 promoted the existing rows to `owner`, every
  //     owner would have been shown as support
  //   * the paragraph above claimed a call that was not happening, which is exactly how
  //     somebody later deletes a page's guard as redundant — and THAT would be the hole
  //
  // The literal survived review because `requireStaff` stayed referenced in the type
  // position, so no unused-import lint fired on it. A mutation left in place looks like
  // ordinary code; the only defence is putting it back in the same session it was made.
  const staff = await requireStaff()
  const { locale } = await callerI18n(staff.userId)

  return (
    // `ConfirmProvider` is mounted HERE because this group inherits none of the member
    // shell, and `useConfirm()` outside a provider silently degrades to `window.confirm`
    // — which the browser can suppress with "prevent this page from creating additional
    // dialogs". Restoring a family is the one action in this console and it must not be
    // one stray checkbox away from happening without a prompt.
    // THE LANGUAGE. The console is GENORRA's own screen, and its readers are employees —
    // but they read what they read, so it is translated like everything else. There is a
    // caller here (`requireStaff` above), so this is the stored choice rather than the
    // header.
    <LocaleProvider locale={locale}>
    <ConfirmProvider>
      <div className="flex min-h-screen flex-col bg-background">
        {/* THE BAND IS THE POINT. The member product deliberately has no header band at
            all — the Golden Master put the brand in the rail and let the workspace begin
            — so a full-width Heritage bar is the single clearest way of saying "this is
            not the app you were just in". Somebody with both windows open must be able to
            tell them apart at a glance, before reading a word.

            `bg-brand-hero` / `text-brand-on-hero` is the pair that is guaranteed AA in
            both themes (9.80 light, 16.30 dark). Never mix an `on-` foreground from one
            pair onto another pair's surface. */}
        <header className="sticky top-0 z-30 bg-brand-hero text-brand-on-hero">
          <div className={cn(PAGE_MEASURE, 'flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4')}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Image
                src={BRAND_MARK_SRC}
                alt={APP_LOGO_ALT}
                width={32}
                height={32}
                className="h-8 w-8 shrink-0"
              />
              <div className="min-w-0">
                {/* NOT `.gn-wordmark` on its own. The wordmark alone is the product, and
                    this is not the product — the word "Staff" has to be part of the thing
                    the eye lands on, not a subtitle under it. */}
                <p className="truncate text-sm font-semibold leading-tight">
                  <span className="gn-wordmark">{APP_NAME}</span>
                  <span className="mx-1.5 opacity-50" aria-hidden="true">/</span>
                  Staff Console
                </p>
                {/* THE STANDING NOTICE, on every screen rather than on the index. Every
                    figure in here is the whole platform: a count that would be one
                    family's anywhere else in this codebase is every family's here, and
                    somebody reading a number needs to know that at the moment they read
                    it, not once when they arrived. */}
                <p className="truncate text-xs opacity-80">
                  Reads across every family on the platform
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto">
              {/* THE ROLE IS PASSED, and it is the whole reason the Access item is reachable
                  from the nav rather than only by typing the URL. `StaffNav` must stay a
                  client component — it reads `usePathname()` for `aria-current`, and a
                  server-resolved active state would freeze on whichever page loaded first,
                  because App Router does not re-render a shared layout on a client-side
                  navigation (the `ContextHelpLink` argument in AGENTS.md). So the role has to
                  arrive as a prop from here, where the service role has already resolved it.

                  IT IS NOT A GATE. The prop only decides whether a LINK is drawn; the page
                  and all four actions behind it call `requireStaffOwner()` themselves, and
                  the prop fails closed (absent, or anything but 'owner', hides the item) so a
                  mount point that does not know the role cannot advertise the screen that
                  hands out cross-family access. */}
              <StaffNav role={staff.role} />
              <span className="hidden h-5 w-px bg-brand-on-hero/25 sm:block" aria-hidden="true" />
              {/* WHOSE SESSION THIS IS. On a console that can see every customer, the
                  account acting is a fact worth carrying on the screen rather than one
                  click into a menu — the audit trail in `genorra_staff` names it, and a
                  person should be able to check it matches who they think they are. */}
              <span className="flex min-w-0 items-center gap-1.5 text-xs opacity-90">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{staff.email || staff.userId}</span>
                <span className="shrink-0 rounded-full bg-brand-on-hero/15 px-1.5 py-0.5 font-medium capitalize">
                  {staff.role}
                </span>
              </span>
              <ThemeToggle />
              {/* Back to the member product. An explicit colour on both this and the nav
                  links, because globals.css paints every bare anchor `--brand-accent`. */}
              <Link
                href="/dashboard"
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-on-hero/80 underline-offset-4 transition-colors hover:bg-brand-on-hero/10 hover:text-brand-on-hero hover:underline"
              >
                Back to the app
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </ConfirmProvider>
    </LocaleProvider>
  )
}
