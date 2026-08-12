import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { FamilySwitcher } from '@/components/layout/FamilySwitcher'
import { getNotifications } from '@/app/actions/notifications'
import { getPendingApprovalCount } from '@/app/actions/admin/approvals'
import { getMyFamilies } from '@/lib/auth/family'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { APP_NAME, APP_LOGO_ALT, BRAND_MARK_GOLD_SRC } from '@/lib/brand'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch notifications + memberships (non-fatal if user not fully set up).
  // personId must come from the ACTIVE family's people row — a multi-family user
  // has one row per family, and the real-time notification filter is per row.
  let notifications: Awaited<ReturnType<typeof getNotifications>> = []
  let personId = ''
  let families: Awaited<ReturnType<typeof getMyFamilies>> = []
  // The approvals queue depth, for the bell's standing "Members Pending Approval" row.
  // getPendingApprovalCount() runs requireRead('admin/approvals') itself and returns 0
  // without it, so a member who cannot work the queue never has the number computed and
  // never receives it — the count is a fetch that is gated, not a row that is hidden
  // (AGENTS.md §5). It is a COUNT, so nothing about any applicant crosses the boundary
  // even for someone who can see it.
  let pendingApprovals = 0
  if (user) {
    const [notifResult, familyResult, pendingResult] = await Promise.all([
      getNotifications(),
      getMyFamilies(user.id),
      getPendingApprovalCount(),
    ])
    notifications = notifResult
    families = familyResult
    pendingApprovals = pendingResult

    // The bell renders only for an APPROVED membership. `personId` is what gates it,
    // and it is also what NotificationBell subscribes to for real-time inserts, so
    // leaving it blank suppresses both the panel and the subscription in one place.
    //
    // Notifications a pending member DOES have — "you have been approved", "your
    // request was declined" — are still written and still there; they simply arrive
    // with the access that makes the rest of the bell's contents readable. What is
    // being avoided is a bell offering links into pages that 404, next to an
    // awaiting-approval screen.
    //
    // FamilySwitcher above is deliberately NOT suppressed: it is how a multi-family
    // account gets back out of the family it is waiting on, and hiding it would strand
    // them on the pending screen with no navigation at all.
    const active = families.find(f => f.isActive)
    personId = active?.status === 'approved' ? active.personId : ''
  }

  // ── THE STACKING ORDER, in one place ─────────────────────────────────────
  // A positioned element with a z-index starts its OWN stacking context, and every
  // z-index inside it is then scoped to that context — it competes with the header
  // as a whole, never with the header's children individually.
  //
  // That is what broke the family switcher on a phone. This header was z-10 and so
  // was the Sidebar's mobile menu bar; equal z-index is settled by document order,
  // and the sidebar is rendered after the navbar, so the bar painted OVER the whole
  // header. The switcher's panel is z-30, but that 30 only ever ranked it against
  // the bell and the backdrop inside this header — from the outside it was part of a
  // z-10 block sitting under a z-10 bar, and the top of the menu was not merely
  // hidden, it was unclickable.
  //
  // So the levels are fixed, and the three of them have to be read together:
  //
  //   20  Sidebar's mobile menu bar        (pinned under this header)
  //   30  THIS header, and the auth/landing headers, and everything inside them
  //   40  Sidebar drawer backdrop          (covers the header — it is modal)
  //   50  Sidebar drawer, Dialog, RowMenu, lightbox
  //  100  ConfirmDialog                    (may open on top of a Dialog)
  //
  // Anything new that floats above the page picks a level from that list rather
  // than inventing one.
  // ── WHY THE SIGNED-IN HEADER IS THE HERITAGE BAND ────────────────────────
  // It was `bg-brand-bar` — the same sand as the landing and auth headers — with a
  // hairline border and four controls sitting on it in a row. Nothing about it said
  // which product you were in, and the most-seen surface in the app is the wrong place
  // to say nothing. Signing in now lands you on the SAME Heritage band the landing hero,
  // the auth banner and every email header use, so the brand is continuous across the
  // whole journey rather than appearing on the way in and evaporating once you arrive.
  //
  // The landing and auth headers deliberately keep the sand bar: there the burgundy band
  // is the hero directly beneath, and two burgundy bands stacked would erase the
  // separation the hero depends on. Inside the app there is no hero, so the header takes
  // the band itself.
  //
  // THE BAND DOES NOT CHANGE BETWEEN THEMES in the sense that matters — `--brand-hero`
  // resolves per theme, but it is deep burgundy in both, so the gold mark works on it
  // either way and there is no second artwork to keep in step (see BRAND_MARK_GOLD_SRC).
  //
  // Text on it is `--brand-on-hero`, added to globals.css for this: 9.80 in light, 16.30
  // in dark. `--brand-on-primary` would have LOOKED fine and been an unchecked pairing
  // across two token families, which AGENTS.md warns about specifically.
  return (
    <header className="sticky top-0 z-30 bg-brand-hero shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
        {/* The wordmark is hidden below sm. On a 375px screen it, the logo, the family
            switcher, the bell and Sign Out do not fit on one row, and what gave way was
            the switcher — squeezed to a few characters and an ellipsis. The wordmark is
            the cheapest thing to drop because the logo keeps the brand present and its
            alt text still carries the name; note the mark itself is wordless, so on a
            phone the name is announced but not seen. */}
        <Link
          href="/dashboard"
          className="group flex min-w-0 shrink items-center gap-2.5 rounded-lg py-1 pr-2 transition-opacity hover:opacity-90"
        >
          <Image src={BRAND_MARK_GOLD_SRC} alt={APP_LOGO_ALT} width={40} height={40} className="h-9 w-9 shrink-0" />
          <span className="gn-wordmark hidden truncate text-xl text-brand-on-hero sm:block">{APP_NAME}</span>
        </Link>
        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
          <FamilySwitcher families={families} />
          {/* ThemeToggle is shared with the landing and auth headers, where the ground is
              sand and its built-in `text-brand-ink` is correct. On this band that would be
              burgundy on burgundy — invisible in light mode. It merges `className` last
              through `cn` (tailwind-merge), so these win. */}
          <ThemeToggle className="text-brand-on-hero hover:bg-brand-primary" />
          {/* KEYED, for the reason the <main> in app/(protected)/layout.tsx is keyed:
              a family switch is a `router.refresh()`, which merges new server props
              without discarding client state, and this bell holds `initialNotifications`
              in plain `useState`. It sits OUTSIDE that main — it is chrome, rendered by
              the layout itself — so the page-level key does not reach it, and without
              this one the bell kept showing the previous family's notifications on every
              page in the app.

              `personId` rather than the family code because it is already the per-family
              value here (one `people` row per family, resolved above) and it is what the
              bell's real-time subscription filters on. Keying on the same thing the
              subscription keys on means the list and the channel can never disagree
              about which member's notifications are on screen. */}
          {personId && (
            <NotificationBell
              key={personId}
              initialNotifications={notifications}
              personId={personId}
              pendingApprovals={pendingApprovals}
            />
          )}
          <SignOutButton />
        </div>
      </div>
      {/* Legacy gold as a rule, which is the one thing it may always be: it is a
          non-text accent here, exactly as in the email templates and under the landing
          hero's lockup. 5.94 against the band, so it reads as a deliberate edge rather
          than the 1px border it replaces. This is the detail that makes the bar look
          finished rather than merely coloured. */}
      <div aria-hidden="true" className="h-0.5 w-full bg-brand-legacy" />
    </header>
  )
}
