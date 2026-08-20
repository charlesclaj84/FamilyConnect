'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  GitBranch,
  Wallet,
  MessageCircle,
  CalendarDays,
  CalendarCog,
  PartyPopper,
  ShieldCheck,
  UsersRound,
  CalendarClock,
  HeartHandshake,
  History,
  Menu,
  X,
  BookOpen,
  Megaphone,
  FileText,
  Vote,
  BarChart3,
  TrendingUp,
  Camera,
  ChevronDown,
  ArrowRightLeft,
  Settings,
  LifeBuoy,
  ClipboardCheck,
  Gavel,
  PieChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isFeatureFuture } from '@/lib/features'
import { BetaBadge } from '@/components/ui/beta-badge'
import { APP_NAME, BRAND_MARK_SRC } from '@/lib/brand'
import { RAIL_CORNER_REM, RailFootDecor, RailMotto } from '@/components/layout/ShellDecor'

// Should a section close on its own when the user clicks away from it — either by
// opening a different section (accordion) or by landing on the Dashboard? When
// false, a section stays open until the user collapses it themselves and any
// number of sections may be open at once.
const AUTO_COLLAPSE_SECTIONS = true

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /**
   * Resource keys, ANY of which makes this item visible. Defaults to the one derived
   * from `href`, which is right for every page whose route and permission key match.
   *
   * Members & Access is the exception: it hosts four independently granted tabs —
   * Members under `admin/users`, Pending Approval under `admin/approvals`, Permission
   * Templates under `admin/users/templates`, and Organization under `admin/chapters` —
   * and the page opens for any one of them, so someone holding only one still needs the
   * link.
   */
  viewKeys?: string[]
  /**
   * Marks a route that is live but unfinished. HAND-SET, and it cannot be otherwise:
   * `lib/features.ts` has two states and this is a property of one of them. It is the
   * opposite of the gated case — a gated item is removed from this list entirely by the
   * filter at the bottom of `buildNavGroups`, so anything wearing this badge is a page
   * the member can actually open.
   */
  beta?: boolean
}

interface NavGroup {
  section?: { label: string; icon: React.ComponentType<{ className?: string }> }
  items: NavItem[]
}

// Hand-ordered, not alphabetical: structure first (who the family's officers are),
// then Accounting, then the people and their access. Elections and Reports are
// periodic tasks rather than setup, so they trail.
// This order is independent of the permission grid on Members & Access, which sorts
// by permission_resources.sort_order in the database.
const adminItems: NavItem[] = [
  // Members leads, having absorbed Member Approvals as its Pending Approval tab. The
  // queue is the reason for the position: it is the only admin surface with PEOPLE
  // waiting behind it, who can see nothing until somebody acts, so it is the one an
  // administrator should be prompted to look at rather than scroll to.
  //
  // Captioned "Members" since 20260812000001, where it was "Members & Access". Note it
  // is NOT the same thing as Community > Directory, which is now captioned with the one
  // word too: that one is the roster every member may read, this one is who is in the
  // family and what each of them may do. They sit under different section headings,
  // which is what tells them apart — the same rule that lets "Dues" appear under both
  // Accounting and Transactions in the permission grid.
  //
  // A FOURTH KEY SINCE 2026-08-19: `admin/chapters`, the Organization pane that used to be
  // the `/admin/chapters` rail item directly below. It has to be listed here or the move
  // TAKES A GRANT AWAY in effect if not on paper — a member holding Organization and none of
  // the other three would have a working page and no link to it, which is the failure the
  // `admin/users/templates` entry in `TAB_RESOURCES` already exists to prevent.
  //
  // AND A FIFTH SINCE 2026-08-20: `admin/boardpositions`, which is the SECOND HALF of that
  // same Organization pane rather than a pane of its own. Regions and chapters are the
  // family's geography and board positions are its offices — one action module, one set of
  // three scope words, and a regional position that is meaningless without a region to hold
  // it for. Two rail items for one answer to one question was the arrangement, and a family
  // setting itself up had to visit both. Listing the key here is what keeps a board-only
  // administrator able to reach the screen at all.
  //
  // Note the key is NOT `admin/users/organization`: a pane takes a sub-key by convention,
  // and this one is a key that RLS policies already name (see the redirect page for the
  // whole argument). The tier gate travels with it — `/admin/chapters` is `tier: 'plus'`, so
  // `viewableResources()` drops the key for a Free family and the pane simply is not there,
  // while the other three keys keep this row visible.
  {
    href: '/admin/users',
    label: 'Members',
    icon: UsersRound,
    viewKeys: [
      'admin/users', 'admin/approvals', 'admin/users/templates',
      'admin/chapters', 'admin/boardpositions',
    ],
  },
  // NO Regions & Chapters ROW and NO Board Positions ROW, since 2026-08-19 and 2026-08-20,
  // and both absences are the move rather than a deletion. Both screens are now the
  // Organization pane of Members & Access above — one rail item, four panes, and the row you
  // want is the one captioned Members.
  //
  // BOTH ROUTES still EXIST: each is a redirect to `/admin/users?tab=organization` and each
  // is still a `FEATURES` entry, because `viewableResources()` walks that registry and the
  // keys `admin/chapters` and `admin/boardpositions` have to stay in its answer — the Members
  // row above lists both in `viewKeys`, so a member whose only admin grant is one of them
  // still gets a link. Adding a row here pointing at either redirect would be two rail items
  // for one pane, and the pane's caption is the grid's caption, which is what "one rail item,
  // one permission resource" is actually about.
  //
  // THE PANE NOW SPANS TWO KEYS AND ITS CAPTION IS HAND-SET, which is the case AGENTS.md
  // describes for Accounting's Dues & Donations item: no `permission_resources` row says
  // "Organization" about both halves, because no row is about both. The grid still prints
  // "Organization" for `admin/chapters` and "Board Positions" for `admin/boardpositions`,
  // which is right — an administrator moves two switches, and they are two jobs.
  { href: '/admin/account',        label: 'Accounting',           icon: Wallet },
  // ONE GATHERINGS ROW, TWO PANES, TWO KEYS. `/admin/gatherings` is a rail: Management
  // schedules a gathering, hands out its tasks and rules on the answers, and Templates
  // authors the step lists a gathering is built FROM. They were two rail items until
  // 2026-08-19 and the panes still carry a grant each, so BOTH keys are listed — an admin
  // route missing from this list is permissioned and linked from NOWHERE, which is not a 404
  // and not a gate but a working, protected page nobody can find.
  //
  // NO Event Management OR Event Templates ROWS. Both routes are deleted with the rest of the
  // Events product; see lib/features.ts.
  {
    href: '/admin/gatherings',
    label: 'Gatherings',
    icon: CalendarCog,
    viewKeys: ['admin/gatherings', 'admin/gathering-templates'],
  },
  // NO Announcement Management ROW. The route is deleted (20260813000000) — posting,
  // pinning and deleting all live on Community > Announcements now, each control gated by
  // the `announcements` grant that governs it. An admin duplicate of a member page is a
  // second place to learn one job.
  // NO Election Management ROW AND NO Reports ROW, since 2026-08-20. Both routes came off
  // `status: 'future'` on that day and both are in the REVIEW section below instead — they
  // are live but unwalked, and the whole point of that section is that the six such screens
  // sit together under one heading rather than being scattered back into the sections they
  // will belong to once somebody has been through them. Move each row here when its screen
  // has been reviewed; that is the only thing left to do for either of them in this file.
  // SETTINGS IS LAST, and the permission grid agrees with it — 20260812000001 moved its
  // sort_order from 155 (top of the Administration block) to 260 (bottom) in the same
  // commit that shortened its label. The two lists used to disagree here on the argument
  // that "which family is this" reads first in a CATALOGUE of switches; the simpler rule
  // won. Settings is the thing you set up once and then leave alone, so it belongs where
  // a reader stops looking rather than where they start, and one order is easier to hold
  // in the head than two.
  { href: '/admin/family',         label: 'Settings',             icon: Settings },
]

// Build the nav groups for the current user. Every item is listed unconditionally
// and then filtered by what the member may actually view — the permission model is
// the single authority, so there is no separate isAdmin branch here any more.
function buildNavGroups(viewable: Set<string>): NavGroup[] {
  // ── GATHERINGS ─────────────────────────────────────────────────────────────────────
  // THIS SECTION WAS CALLED "EVENTS" UNTIL 2026-08-19 and held seven rows: Upcoming Events,
  // Event Planning, Gatherings, My Gathering Tasks, Calendar, Event Management, Event
  // Templates. Four of those seven were the Events product, which is retired — the routes,
  // the actions and the components are deleted, and `lib/features.ts` says at length why the
  // entries are DELETED rather than parked behind `status: 'future'`. So the heading names
  // what is under it: three rows, all Gatherings.
  //
  // `hasAssignments` WENT WITH EVENT PLANNING, and its absence is the decision the old note
  // beside it argued for. That prop existed because `/event-planning` read as broken when a
  // member had nothing assigned, so the row was hidden until they did — and the comment
  // already said Gatherings does not do that: `/gatherings` has a real empty state, and a row
  // that is sometimes there is worse than a row that is sometimes empty. There is nothing
  // left in this group that is conditional on the caller's own workload.
  //
  // ORDER IS MEMBER-FACING FIRST, THEN THE CALENDAR THAT SPANS IT. Gatherings is a rail of
  // two panes now — the family's gatherings, and the tasks assigned to the caller — so what
  // was two rows is one, and the admin pair below is one row for the same reason.
  const gatheringItems: NavItem[] = [
    // TWO KEYS, ONE ROW. `/gatherings` opens for either `gatherings` (the family's list) or
    // `gatherings/my-tasks` (the caller's own tasks), because the page resolves them one at a
    // time and renders whichever panes survive. Without the second key here a member granted
    // only their own tasks would have a working page and no link to it — the same failure the
    // Members row's four `viewKeys` exist to prevent.
    {
      href: '/gatherings',
      label: 'Gatherings',
      icon: PartyPopper,
      viewKeys: ['gatherings', 'gatherings/my-tasks'],
    },
    { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  ]

  const groups: NavGroup[] = [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    // THE PERSONAL SECTION IS GONE, 2026-08-13, and this time deleting it is right.
    //
    // It survived one earlier pass deliberately: My Profile and My Families had moved to
    // the account menu in the top bar, leaving one `status: 'future'` item that the filter
    // at the bottom of this function dropped — so the group rendered nothing but was kept,
    // on the argument that My Children would bring the heading back on its own.
    //
    // My Children is not coming back. `/direct-lineage` was the product's second kind of
    // person — a child record its parent owned and later "converted to adult" — and there
    // is one kind now: a child is recorded like any other relative without an email
    // address, on the family tree, under Community. So the section has nothing left to
    // wait for, and an empty group kept for an item that will never ship is the comment
    // arguing for itself.
    //
    // FAMILY TREE was under this heading once and is under Community for a reason that
    // outlived the section: the tree is the WHOLE family's, not the caller's own line.
    {
      // Family Tree LAST, and directly after Directory on purpose: the two answer the same
      // question — who is in this family and how are they related. Chat and Announcements
      // are conversation; these two are the roster.
      //
      // NO `beta` FLAG, since 2026-08-13. The badge was hand-set here and on the page, and
      // both came off together when the per-member lineage view was retired and this
      // became the only tree — see app/(protected)/family-tree/page.tsx. Nothing derives
      // it, so if a surface ever needs it again it is set here by hand exactly as it was.
      section: { label: 'Community', icon: UsersRound },
      items: [
        { href: '/chat',          label: 'Chat',             icon: MessageCircle },
        // ONE ROW FOR THREE PANES, since 2026-08-19. Announcements is a rail — General (the
        // board), Updates (the archive of announcements and the member's own notifications)
        // and Birthdays — so the three keys are listed here for the reason `admin/users`
        // lists four: `viewableResources()` resolves a nav item against the key derived from
        // its href, and a member holding ONLY the archive or ONLY the birthdays pane would
        // otherwise have a working page and no link to it. That is a grant taken away in
        // effect if not on paper.
        //
        // NO SEPARATE Updates ROW. It had one until the archive became a pane; `/updates`
        // still exists and redirects to `?pane=updates`, so a second row here would be two
        // rail items for one pane — the thing "one rail item, one permission resource" is
        // actually about.
        {
          href: '/announcements',
          label: 'Announcements',
          icon: Megaphone,
          viewKeys: ['announcements', 'updates', 'announcements/birthdays'],
        },
        { href: '/members',       label: 'Directory',        icon: UsersRound },
        { href: '/family-tree',   label: 'Family Tree',      icon: GitBranch },
      ],
    },
  ]

  groups.push({ section: { label: 'Gatherings', icon: PartyPopper }, items: gatheringItems })

  // SUMMARY FIRST, THEN TWO OF THE THREE SCREENS IT SUMMARISES — the third, Payment History,
  // is in Reporting below — and then the forward reading of the same money. Dues, Donations
  // and Payment History were panes on a rail
  // INSIDE Summary until 20260815000000; each is a destination now, with its own route, its
  // own permission_resources row and — the part that makes them appear here at all — its own
  // entry in lib/features.ts, since viewableResources() builds its answer by walking that
  // registry and a key with no entry there can never be in `viewable`.
  //
  // The order is still the permission grid's WITHIN this group: sort_order 100, 105, 106,
  // then 125 and 130 in the accounting category (the note that used to sit here said 116 for
  // Dues Projections, which 20260817000000 never wrote — it is 125, and Family Finances went
  // to 130 in 20260806000005). Two lists of the same items in two different
  // orders is a thing an administrator has to reconcile by hand, and Settings' position is
  // the precedent for keeping them in step rather than arguing each one separately.
  //
  // The icons are the ones the rail items carried when they were panes — CalendarClock for
  // schedules, HeartHandshake for giving — which is what keeps these recognisable as the
  // screens that replaced them. History went with Payment History into Reporting below.
  groups.push({
    section: { label: 'Accounting', icon: Wallet },
    items: [
      { href: '/account-summary',  label: 'Summary',         icon: Wallet },
      { href: '/dues',             label: 'Dues',            icon: CalendarClock },
      { href: '/donations',        label: 'Donations',       icon: HeartHandshake },
      // DUES PROJECTIONS LEFT THIS GROUP ON 2026-08-20 and is in Reporting below. The note
      // that used to stand here argued for keeping it — "the request named two screens" — and
      // the note on Reporting said moving a third would be scope creep. It was asked for, so
      // it moved; the argument for where it belongs is now made in one place, down there.
      //
      // FAMILY FINANCES LEFT IT THE SAME DAY, for a different reason and to a different place.
      // It is not a regrouping: the route came off `status: 'future'` in lib/features.ts, and
      // every route that did is in the REVIEW section below until somebody has walked it. This
      // is where it comes back to — it is the family's own money read family-wide, which is
      // what this group is — so move the row here rather than inventing a place for it.
    ],
  })

  // ── REPORTING: THE TWO SCREENS THAT READ THE MONEY BACK ────────────────────────────
  // Payment History (what one member has paid) and Transactions (the family's four
  // ledgers). Both were items in the Accounting group directly above until 2026-08-19,
  // where they sat between the things you SET UP and the things you PROJECT — and the
  // Accounting group had grown to seven rows, which is the point at which a collapsible
  // section stops being a list and becomes a page of its own.
  //
  // NOTHING ELSE CHANGED. No route moved, no permission key moved, no migration: these are
  // the same two hrefs under the same two keys, `payment-history` and `transactions`
  // (sort_order 107 and 115, unmoved), still in the `accounting` CATEGORY and so still
  // printed under Accounting on the grid, between Donations and Dues Projections. That is a
  // deliberate divergence from the "keep the two lists in
  // step" note above, and it is narrow: the grid groups by the category a resource belongs
  // to — which is accounting, because that is the money these screens read — while the rail
  // groups by what a member came to DO. Regrouping the grid would mean a migration moving
  // two rows out of a category that describes them correctly.
  //
  // DUES PROJECTIONS IS THE THIRD, MOVED HERE 2026-08-20. This paragraph said it and
  // `/admin/reports` were "the obvious next candidates and DELIBERATELY NOT MOVED", on the
  // ground that the request named two screens; it was asked for on 2026-08-20 and the
  // reasoning it was waiting for turns out to be the group's own: Reporting is where the
  // family's money is READ rather than set up, and a projection is a reading. Payment History
  // and Transactions are what came in, Dues Projections is what should — three readings of one
  // ledger, which is a group, where two readings and a forecast in a different group was a
  // split nobody could state.
  //
  // WHAT DID NOT MOVE, AND THIS IS THE SAME DIVERGENCE THE PARAGRAPH ABOVE ARGUES: the
  // permission grid still prints `dues-projections` under Accounting, at sort_order 125 in the
  // `accounting` category, because that is the money it is about. No route moved, no key
  // moved, no migration — the rail groups by what a member came to DO and the grid groups by
  // what a resource is ABOUT, and regrouping the grid would mean a migration moving a row out
  // of a category that describes it correctly.
  //
  // `/admin/reports` STILL STAYS OUT, and the reason changed on 2026-08-20 without changing
  // the answer. It was `status: 'future'`, so it was in no rail at all — `buildNavGroups`
  // renders from `viewKeys` and a future route is never viewable, which made placing it here
  // placing a row nobody could see. It is LIVE now, and it is in the Review section below with
  // the other five routes that flipped, because live is not the same as walked. This is still
  // where it belongs the day somebody has been through it: membership over time and dues
  // collected against what is outstanding are readings of the family's money, which is what
  // this group is. The group is shaped for it.
  //
  // BarChart3 as the section icon, already imported for Family Finances and Reports. Both
  // of those are readings of the family's money too, so the glyph is doing the same job in
  // all three places rather than being borrowed — and section icons are reused as item icons
  // elsewhere in this file already (BookOpen heads Resources and labels the manual).
  groups.push({
    section: { label: 'Reporting', icon: BarChart3 },
    items: [
      { href: '/payment-history',  label: 'Payment History',  icon: History },
      { href: '/transactions',     label: 'Transactions',     icon: ArrowRightLeft },
      { href: '/dues-projections', label: 'Dues Projections', icon: TrendingUp },
    ],
  })

  // ── THE RESOURCES SECTION IS GONE, 2026-08-20 ──────────────────────────────────────
  // It held exactly three rows — Photos, Documents, Elections — and all three came off
  // `status: 'future'` on the same day and moved into Review below. So this is not a
  // deletion of a heading anybody chose to remove: the group emptied, and the filter at the
  // bottom of this function would have dropped it on its own. It is written out rather than
  // left as an empty `items: []` for the reason the Personal section was deleted rather than
  // kept — a group held open for rows that are somewhere else is a comment arguing with the
  // code beside it.
  //
  // The three rows come BACK here, under this heading and this icon, as each screen is
  // reviewed. Whoever moves the last one out of Review re-creates this group; the shape it
  // had is in the git history and in the Review block below.

  groups.push({ section: { label: 'Admin', icon: ShieldCheck }, items: adminItems })

  // ── REVIEW: LIVE, BUT NOT YET WALKED ───────────────────────────────────────────────
  // The six routes that came off `status: 'future'` in lib/features.ts on 2026-08-20. Every
  // one of them was already built — a page gating itself with `requireView`, an action module
  // behind it and a `permission_resources` row registered since 20260618000000 — and gated
  // only because nobody had been through it end to end. They are reachable now so that
  // somebody can be.
  //
  // WHY ONE SECTION RATHER THAN SIX ROWS PUT BACK WHERE THEY BELONG. Two of these are
  // Accounting, three were Resources and two are Admin, and scattering them is exactly what
  // makes a review impossible to finish: there would be no list of what is left, and the only
  // way to tell a reviewed screen from an unreviewed one would be to remember. One heading is
  // the worklist. It empties itself — each row leaves for its real section as its screen is
  // walked, and the notes at Accounting, Reporting and Resources above each name the row they
  // are waiting for — and when the last row goes, this whole block goes with it. A Review
  // section that outlives the review is the thing to avoid.
  //
  // IT IS NOT A PERMISSION BOUNDARY AND CHANGES NOTHING ABOUT WHO SEES WHAT. Every row here
  // is filtered by `viewable` like every other row in this file, and each page still resolves
  // its own `requireView` — a member without the grant sees no row AND no page, exactly as
  // before. All six are `tier: 'plus'`, so a Free or Standard family gets `/upgrade` rather
  // than the screen. This heading is a place to stand, not a gate.
  //
  // NO `beta` BADGES, deliberately. That flag marks a route that is live and UNFINISHED, and
  // that is a claim about the screen that nobody is yet in a position to make about any of
  // these — the review is what will decide it. Set it per row if a walk finds one, which is
  // the badge doing its actual job rather than being applied six times in advance.
  //
  // TWO ICONS ARE NEW, and only because this section puts pairs side by side that were never
  // neighbours: Gavel for Election Management (Vote is the member's ballot, one row above it)
  // and PieChart for Reports (BarChart3 is Family Finances, three rows above it). Two rows in
  // one collapsed list wearing the same glyph is not a list of six things, it is a list of
  // four. Each row keeps its original icon when it leaves for its real section, where its
  // twin is somewhere else entirely.
  groups.push({
    section: { label: 'Review', icon: ClipboardCheck },
    items: [
      { href: '/family-finances', label: 'Family Finances',    icon: BarChart3 },
      { href: '/photos',          label: 'Photos',             icon: Camera },
      { href: '/documents',       label: 'Documents',          icon: FileText },
      { href: '/elections',       label: 'Elections',          icon: Vote },
      { href: '/admin/elections', label: 'Election Management', icon: Gavel },
      { href: '/admin/reports',   label: 'Reports',            icon: PieChart },
    ],
  })

  // HELP IS LAST, and it is the one section whose position is not a judgement about
  // importance. It is where a reader's eye goes when everything above has failed them, and
  // it is the only section that survives every narrowing below — `help` is registered as a
  // Free feature with no `permission_resources` row, so it resolves to viewable for
  // everybody, a pending applicant included (see PENDING_RESOURCES).
  //
  // ONE ITEM, so NavSection renders it as a static divider rather than a slider — there is
  // nothing to collapse. A second item here would make it a slider automatically, which is
  // the correct behaviour and needs no change.
  groups.push({
    section: { label: 'Help', icon: LifeBuoy },
    items: [
      { href: '/help', label: 'How-To Manual', icon: BookOpen },
    ],
  })

  // Two independent gates, both narrowing:
  //   * roadmap — has the feature shipped at all? (lib/features.ts)
  //   * permission — may THIS member view it? (viewable, from the permission model)
  // Then drop any section left with nothing in it. proxy.ts still gates the
  // roadmap routes and RLS still gates the data, so this is presentation only.
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        !isFeatureFuture(item.href)
        && (item.viewKeys ?? [item.href.replace(/^\//, '')]).some(key => viewable.has(key)),
      ),
    }))
    .filter(group => group.items.length > 0)
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * One row in the nav.
 *
 * WHY IT LOOKED FLAT, AND WHAT CHANGED. Every row used to carry a filled `bg-brand-soft`
 * chip and the active one swapped to `bg-brand-primary`. When everything is a chip
 * nothing is selected — the eye has fourteen equal sand blocks to sort through, and the
 * one that matters differs only in hue. A list of destinations should read as a list,
 * with exactly one thing standing out.
 *
 * So rows are plain text with a hover well, and only the active row is filled.
 *
 * THE ACTIVE FILL IS `--brand-legacy`, and it is gold because the rail is now Heritage.
 * It has been burgundy twice before, and both times for a rail that was a PALE surface:
 * `--brand-soft` while the rail was page-coloured (1.19 against the sand one — sand on
 * sand, gone), then `--brand-primary` when the rail became recessed muted sand (8.67,
 * correct at the time). Burgundy on burgundy is that same mistake a third time, so the
 * selected row takes the brand's signature pairing instead: `bg-brand-legacy` under
 * `text-brand-on-legacy`, which is Ink in BOTH themes and the one `on-` token that does
 * not flip. It is also exactly what the Golden Master draws.
 *
 * Worth being precise about what the original mistake was: not the hue, but that the
 * INACTIVE rows were filled too. One filled row among plain ones is a selection;
 * fourteen filled rows are wallpaper.
 *
 * THE PILL BLEEDS OFF THE LEFT EDGE — `-ml-3` cancels the nav's `p-3`, and the left
 * corners are square while the right ones are a full radius. That is the kit's own
 * treatment (`Sidebar.svg` draws it `x="0" width="218" rx="24"`, running off the
 * canvas), and it does a job beyond decoration: a pill that touches the rail's edge
 * reads as attached to the rail rather than floating on it, which is what separates a
 * selected destination from a button someone might press.
 *
 * BOTH BRANCHES SET AN EXPLICIT TEXT COLOUR, and neither may be dropped. `globals.css`
 * carries an unscoped `a { color: var(--brand-accent) }` in its base layer, so a nav link
 * without one comes out terracotta in light and GOLD in dark — the second of which would
 * be indistinguishable from the active pill. This is the trap documented in AGENTS.md and
 * commented at every other rail in the codebase.
 *
 * BOTH BRANCHES ALSO CARRY IDENTICAL BOX METRICS — same padding, same radii, same
 * negative margin — so selecting a row changes colours and never a size. Same reasoning
 * as MainRail's stacked variant, and the reason the old `transparent` left marker is
 * gone rather than merely recoloured: the gold fill IS the marker now.
 */
function NavLink({ href, label, icon: Icon, active, beta, onClick }: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  beta?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative -ml-3 flex items-center gap-3 rounded-l-none rounded-r-full py-2 pl-7 pr-3 text-sm transition-colors',
        active
          ? 'bg-brand-legacy font-semibold text-brand-on-legacy shadow-sm'
          : 'text-brand-on-hero/75 hover:bg-brand-primary hover:text-brand-on-primary',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100')} />
      {label}
      {/* THE OUTLINE VARIANT, WHICH INHERITS THIS ROW'S COLOUR — and that is the whole
          reason it exists. A row sits on Heritage when inactive and on Legacy gold when
          active, and those grounds take different `on-` partners: naming either here would
          be wrong half the time, and borrowing one across pairs is what AGENTS.md forbids.
          Both branches above already set the correct partner as the text colour, so a
          `currentColor` badge is right on both without knowing which it is on. */}
      {beta && <BetaBadge variant="outline" className="ml-auto" />}
    </Link>
  )
}

/**
 * The label on a section heading, shared by the static and collapsible forms so the two
 * cannot drift apart.
 *
 * The old heading centred a muted label between two grey rules, which put the least
 * important thing on the row — a divider — in the two most prominent positions and left
 * the label itself the faintest thing in the panel. It now reads left-to-right like a
 * heading: label first in brand ink, then a gold hairline running out to the edge. The
 * gold fades rather than stopping, so a stack of sections looks like a considered
 * structure instead of a run of horizontal bars.
 */
function SectionLabel({ label, icon: Icon }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <>
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-on-hero/70">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {/* Legacy gold as a rule — a non-text accent, the one thing it may always be. */}
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-brand-legacy/60 to-transparent" />
    </>
  )
}

function SectionDivider({ label, icon: Icon }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="mt-4 flex items-center gap-2 px-3 py-1.5">
      <SectionLabel label={label} icon={Icon} />
    </div>
  )
}

// A nav group. Sections with more than one item become collapsible sliders;
// single-item sections (and the top-level Dashboard group) render statically.
// `open`/`onToggle` are owned by NavTree, which decides how sections interact
// with one another (see AUTO_COLLAPSE_SECTIONS).
function NavSection({ group, pathname, open, onToggle, onNavClick }: {
  group: NavGroup
  pathname: string
  open: boolean
  onToggle: () => void
  onNavClick?: () => void
}) {
  const { section, items } = group

  // WHICH ROW IS SELECTED IS THE LONGEST MATCH, NOT EVERY MATCH.
  //
  // `isActive` is `pathname === href || pathname.startsWith(href + '/')`, which is correct
  // and stays as it is: /gatherings/<id> genuinely IS Gatherings and must light that row.
  // What it cannot do on its own is decide between two items when one is nested inside the
  // other, and this group now holds such a pair — /gatherings and /gatherings/my-tasks. On
  // the second of those both rows satisfied `isActive`, and two gold pills in one section
  // is not a selection, it is two.
  //
  // The tie-break is the longest match, which is the same longest-prefix rule
  // `getFeature()` in lib/features.ts already applies to these very hrefs — so the rail and
  // the registry agree about which feature a path belongs to, rather than each having its
  // own answer. It changes nothing for any pair already in this file: no other two nav
  // hrefs are nested (/dues and /dues-projections only look it — `startsWith` needs a
  // literal '/dues/'), so every existing group resolves to exactly the row it did before.
  //
  // Scoped to the GROUP on purpose. Nothing stops two sections listing hrefs that nest —
  // Events already carries /admin/events, which the Admin section deliberately does not
  // repeat, and the next such pair may be less tidy — and a rail that resolved the winner
  // across the whole tree would let one section's row suppress another section's. Each
  // section decides its own selection. NavTree's `activeSection` keeps the plain `isActive`
  // for the mirror-image reason: it asks "does anything in here match", not "which one".
  const activeHref = items
    .filter(item => isActive(pathname, item.href))
    .reduce<string | null>((best, item) => (!best || item.href.length > best.length ? item.href : best), null)

  const links = items.map(item => (
    <NavLink key={item.href} {...item} active={item.href === activeHref} onClick={onNavClick} />
  ))

  // No section header (e.g. Dashboard) — render the items plainly.
  if (!section) {
    return <div className="flex flex-col gap-0.5">{links}</div>
  }

  const Icon = section.icon

  // A single option doesn't need a slider — keep it as a static divider.
  if (items.length <= 1) {
    return (
      <div>
        <SectionDivider label={section.label} icon={Icon} />
        <div className="flex flex-col gap-0.5 mt-0.5">{links}</div>
      </div>
    )
  }

  // More than one option — collapsible slider.
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-brand-primary/50"
      >
        <SectionLabel label={section.label} icon={Icon} />
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-brand-on-hero/50 transition-transform group-hover:text-brand-on-hero',
            open ? '' : '-rotate-90',
          )}
        />
      </button>
      {open && <div className="mt-1 flex flex-col gap-0.5">{links}</div>}
    </div>
  )
}

function NavTree({ groups, pathname, onNavClick }: {
  groups: NavGroup[]
  pathname: string
  onNavClick?: () => void
}) {
  // Default to the section that contains the active route so the current page
  // stays visible. With AUTO_COLLAPSE_SECTIONS on this behaves as an accordion —
  // only one section open at a time; with it off, sections open independently.
  const collapsible = (g: NavGroup) => Boolean(g.section) && g.items.length > 1
  const activeSection = groups.find(g => collapsible(g) && g.items.some(it => isActive(pathname, it.href)))
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(activeSection?.section?.label ? [activeSection.section.label] : []),
  )

  const toggleSection = (label: string) =>
    setOpenSections(curr => {
      if (curr.has(label)) {
        const next = new Set(curr)
        next.delete(label)
        return next
      }
      return AUTO_COLLAPSE_SECTIONS ? new Set([label]) : new Set(curr).add(label)
    })

  // Collapse every section when the user lands on the Dashboard.
  //
  // Adjusted during render, not in an effect. React's documented pattern for "reset some
  // state when a prop changes": compare against the value the state was computed for and
  // set during render, which React handles by re-rendering before it commits anything. An
  // effect instead paints one frame with the previous route's sections still open and then
  // re-renders — the cascading render `react-hooks/set-state-in-effect` exists to stop.
  const [seenPathname, setSeenPathname] = useState(pathname)
  if (seenPathname !== pathname) {
    setSeenPathname(pathname)
    // Deliberately only /dashboard, matching the effect this replaced. Resetting on every
    // navigation would also be defensible — arguably more so, since a section that does not
    // contain the active route stays open today — but that is a behaviour change and does
    // not belong in a lint fix.
    if (AUTO_COLLAPSE_SECTIONS && pathname === '/dashboard') setOpenSections(new Set())
  }

  return (
    <>
      {groups.map((group, i) => {
        const label = group.section?.label ?? `group-${i}`
        return (
          <NavSection
            key={label}
            group={group}
            pathname={pathname}
            open={openSections.has(label)}
            onToggle={() => toggleSection(label)}
            onNavClick={onNavClick}
          />
        )
      })}
    </>
  )
}

/**
 * The brand block at the top of the rail — the multicolour mark over the wordmark.
 *
 * IT MOVED HERE FROM THE HEADER, and that is the Golden Master's whole top-left
 * composition: the kit places the mark at x=83..168, y=50..135 and the wordmark centred
 * beneath it at y=158, inside the burgundy. There is no header band in the master to put
 * it in.
 *
 * `BRAND_MARK_SRC`, not `BRAND_MARK_GOLD_SRC`. The gold mark exists for the Heritage
 * header bar that this change deletes; the master draws the full-colour mark here, and it
 * survives burgundy for the reason `lib/brand.ts` gives — it is stroked with the heart cut
 * out, so the ground shows through, and its gold, terracotta and olive strokes carry
 * against Heritage on their own.
 *
 * The wordmark is SET, not placed: `.gn-wordmark` reproduces the brand board's
 * letterspaced Cormorant caps in CSS, so it stays crisp at any size, recolours per theme
 * and is selectable. The kit draws it at 18px with 8 units of tracking; `text-lg` and the
 * class's own `0.18em` are that.
 *
 * A link to /dashboard, because a logo in the top-left corner of an app is one, and
 * removing the header removed the only other thing that was.
 */
function RailBrand() {
  return (
    <Link
      href="/dashboard"
      className="flex flex-col items-center gap-2 rounded-2xl px-3 pb-2 pt-4 transition-opacity hover:opacity-90"
    >
      <Image src={BRAND_MARK_SRC} alt="" aria-hidden="true" width={96} height={96} className="h-16 w-16" />
      <span className="gn-wordmark text-lg text-brand-on-hero">{APP_NAME}</span>
    </Link>
  )
}

/**
 * The desktop rail: brand, nav, motto, on Heritage.
 *
 * THE STICKY BLOCK NOW STARTS AT `top-0`. It used to be `top-[calc(4rem + 2px)]`, pinned
 * under a header that no longer exists — the rail runs to the top of the shell now and
 * carries the logo itself. Its cap moved with it, from `calc(100vh - 4rem - 2px)` to the
 * full viewport, for the same reason. That cap is what makes `overflow-y-auto` mean
 * anything: without a max-height the nav grows to its content and scrolls away with the
 * page instead of scrolling within itself.
 *
 * `relative` is SAFE for the two things that would otherwise break here: it does not
 * create a containing block for `fixed` (only transform/filter/will-change do — see
 * components/layout/header-panel.ts, which depends on that), and it does not disturb the
 * `sticky` block inside it.
 *
 * NO `overflow-hidden` ON THE ASIDE, ever. It would compute the sticky block's
 * `overflow-y` to `auto` and kill its stickiness.
 *
 * THE LOWER DECORATION IS NOT RENDERED HERE, and that is the substance of the kit's
 * PATCH 01. The olive hill runs from x=132 to x=664 in kit coordinates while the rail ends
 * at 258, so more than half of it belongs to the workspace — it is drawn from `<main>` in
 * app/(protected)/layout.tsx, where it can cross the boundary. Putting it back in this
 * element clips it, which is the bug the patch was issued to correct.
 *
 * The `border-r` is gone: burgundy against the page is a 6.6:1 edge on its own, and a sand
 * hairline over it read as a seam.
 *
 * THE BURGUNDY IS A FIXED LAYER, NOT THIS ELEMENT'S BACKGROUND — and the rounded top-left
 * corner is why. A radius on the <aside> rounds the top of the ASIDE, which is the top of
 * the document; scroll a long page and the corner travels up out of the viewport, leaving a
 * square burgundy edge in the corner of the window. The rail is a full-height column whose
 * contents are pinned to the viewport anyway, so its ground may as well be pinned too: then
 * the corner is at the corner of the screen by construction, at every scroll position.
 *
 * Three things about that layer:
 *
 *   * **The <aside> stays,** transparent, and keeps `w-56 shrink-0`. It is what claims the
 *     14rem column from the flex row — a fixed element is out of flow and would leave the
 *     workspace to fill the whole width with the rail painted over the top of it.
 *   * **It needs no breakpoint of its own.** `hidden` on this element is `display: none`,
 *     which removes the entire subtree from rendering, fixed descendants included — so the
 *     ground appears and disappears with the rail it belongs to.
 *   * **Something has to be behind it.** The shell row was `bg-brand-hero`, so a round on a
 *     burgundy layer over a burgundy ground is invisible. It carries the page ground now
 *     (app/(protected)/layout.tsx), which is what the kit puts outside this corner.
 *
 * NO `overflow-hidden` to clip the round, and this element may never have it — it would
 * compute the sticky block's `overflow-y` to `auto` and kill its stickiness. A radius clips
 * its own element's background without help, and nothing of the rail's reaches that corner:
 * the only thing that could is a nav pill bleeding off the left edge, and the first of those
 * sits ~150px down.
 *
 * Only the top-left. The kit rounds its bottom corners too, but its sidebar is a card on a
 * canvas; this one runs to the bottom of a page of unknown length.
 */
export function Sidebar({ viewable }: { viewable: string[] }) {
  const pathname = usePathname()
  const navGroups = buildNavGroups(new Set(viewable))

  return (
    <aside className="relative hidden md:flex w-56 shrink-0 flex-col">
      {/* The rail's ground. `inset-y-0` on a fixed element is the VIEWPORT's height, not
          the column's, so this is always exactly the visible rail — which is the whole
          point: the corner cannot scroll away from a corner it is measured against.
          `w-56` twice is the one duplication here, and it is unavoidable: the layer is out
          of flow and cannot inherit the width of the box it fills. */}
      <div
        aria-hidden="true"
        className="fixed inset-y-0 left-0 w-56 bg-brand-hero"
        style={{ borderTopLeftRadius: RAIL_CORNER_REM }}
      />
      {/* THE PADDING IS ASYMMETRIC, AND THE RIGHT NUMBER IS FROM THE KIT.
          `Sidebar.svg` draws the active pill as `x=0 width=218` on a canvas whose rail
          spans x=12..258 — so it covers 83.7% of the rail and leaves 16.3% clear on the
          right. At `w-56` that is a right edge at 188px with 36px of rail beside it.

          This was `p-3`, which put the right edge at 212px and left 12px. Three things
          were wrong with that at once: the pill read as almost-full-bleed rather than as
          a shape sitting on a rail, the row had no breathing room for the chevron on a
          collapsible section, and — the visible one — the inward swoosh at the top of the
          rail runs through the rightmost ~14px, so a 212px pill overlapped the bite and
          cut it off just where it is deepest.

          `pr-9` is 36px. The kit's motto card arrives at the same answer independently
          (`x=30..217`, a 37px right inset), which is the check that this is the rail's
          real margin and not one shape's quirk. `pl-3` stays, because NavLink cancels it
          with `-ml-3` to bleed the pill off the left edge exactly as the kit does. */}
      <div className="sticky top-0 z-10 flex max-h-screen flex-col overflow-y-auto overscroll-contain py-3 pl-3 pr-9">
        <RailBrand />
        <nav className="mt-4 flex flex-col">
          <NavTree groups={navGroups} pathname={pathname} />
        </nav>
        <RailMotto />
      </div>
    </aside>
  )
}

/**
 * The same nav as a drawer, plus the trigger that opens it — rendered by `TopBar` into
 * the left of the bar below `md`.
 *
 * WHY IT IS ITS OWN EXPORT. The trigger used to be a second sticky strip of its own,
 * pinned under the header at `z-20`, which meant a phone showed two horizontal bands
 * before any content. With the header gone there is one bar, and the trigger belongs in
 * it — so the component that owns `mobileOpen` has to be the one the bar renders. Lifting
 * the state into a context to keep the old split would have been more machinery for a
 * worse result.
 *
 * `Sidebar` above is now desktop-only and holds no state at all.
 */
export function MobileNav({ viewable }: { viewable: string[] }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navGroups = buildNavGroups(new Set(viewable))

  // Close the drawer on navigation, during render rather than in an effect — same
  // reasoning as NavTree above. Every link in the drawer already calls setMobileOpen(false)
  // on click, so this is the backstop for a navigation the drawer did not initiate: a
  // redirect, a browser Back, or the idle timeout sending the member to /login.
  const [seenPathname, setSeenPathname] = useState(pathname)
  if (seenPathname !== pathname) {
    setSeenPathname(pathname)
    setMobileOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden flex items-center gap-2 rounded-full bg-brand-primary px-3 py-1.5 text-sm font-medium text-brand-on-primary transition-opacity hover:opacity-90"
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen ? 'true' : 'false'}
      >
        <Menu className="h-4 w-4" />
        Menu
      </button>

      {mobileOpen && (
        <>
          {/* Above the bar (z-30), not below it: this is a modal drawer, and a backdrop
              that leaves the bar live lets someone sign out through the scrim they just
              tapped to dismiss. */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* No `relative` needed and none wanted — `fixed` is already a positioned
              element, so RailFootDecor resolves against this box. Adding `relative` beside
              it would be two `position` declarations fighting over one element.
              `overflow-hidden` is forbidden here for the same reason as the desktop rail:
              the nav below scrolls. */}
          <div className="md:hidden fixed inset-y-0 left-0 w-64 bg-brand-hero z-50 flex flex-col">
            {/* The drawer leads with the same brand block the desktop rail does, so
                opening the menu on a phone lands somewhere that is recognisably the same
                rail rather than a plain strip that belongs to no product. */}
            <div className="shrink-0 flex items-start justify-between gap-2 pr-2">
              <RailBrand />
              <button
                onClick={() => setMobileOpen(false)}
                className="mt-4 rounded-lg p-1.5 text-brand-on-hero transition-colors hover:bg-brand-primary"
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Same asymmetric inset as the desktop rail, and for the first of the same
                three reasons — a pill that stops short of the edge reads as sitting on
                the rail. The drawer has no swoosh to protect, so this is proportion
                alone. */}
            <nav className="relative z-10 flex flex-col overflow-y-auto py-3 pl-3 pr-9">
              <NavTree groups={navGroups} pathname={pathname} onNavClick={() => setMobileOpen(false)} />
              <RailMotto />
            </nav>
            {/* The rail-windowed variant, not the shell one: a drawer is a 16rem panel
                with nothing beside it, so a hill drawn to run 400 units past the rail
                would simply be cut off at the panel's edge. */}
            <RailFootDecor />
          </div>
        </>
      )}
    </>
  )
}
