/**
 * Single source of truth for which features have shipped, which are still on the
 * roadmap, and which plan each one belongs to.
 *
 * Everything reads from this one registry — the route gate in `proxy.ts`, the sidebar,
 * the dashboard widgets, and the marketing showcase, which derives its Coming Soon pills
 * from `isFeatureFuture()` on both the landing page and `/features`.
 *
 * EVERY ENTRY ANSWERS TWO INDEPENDENT QUESTIONS, and a member has to pass both:
 *
 *   status  has this shipped at ALL?         false → Coming Soon (`proxy.ts`)
 *   tier    is it in this family's PLAN?     false → the upgrade screen (`requireView`)
 *
 * They are enforced in different places for a reason worth knowing before moving either.
 * `status` is a static fact about the build, so the edge gate can decide it with no
 * session and no query. `tier` is a fact about the FAMILY, which needs a database round
 * trip — so it is decided in the page guard, where a trip is already being made, and
 * `proxy.ts` deliberately knows nothing about it. See `lib/auth/tier.ts`.
 *
 * THE SIDEBAR DOES NOT BADGE A GATED ITEM, it drops it, and drops a whole section once
 * that empties it (see `buildNavGroups`). This comment said "Soon badges in the sidebar"
 * for a while after that changed. The badge that does exist in the rail is `BetaBadge`,
 * which is hand-set and marks the opposite case — a route that is live and unfinished.
 *
 * FLIPPING `status` IS USUALLY THE WHOLE JOB, and it is worth knowing where it is not.
 * Every surface above updates itself, but nothing here can conjure a rail item that was
 * never written: a route gated before the Admin rail existed needs an `adminItems` entry
 * as well, or the page comes back working, permissioned and linked from nowhere. Check the
 * rail when you flip an admin route.
 *
 * THE 2026-08-20 FLIP OF SIX ROUTES MEASURED THE REST OF THAT COST, and it is three things
 * rather than one — the permission grid gains a switch per key, Home stops badging the route
 * Coming Soon to strangers, and `npm run help:check` fails until the route has a chapter or a
 * stated allowance. The long note above `/reporting/pl-summary` sets out all three. None of them is
 * a reason not to flip; they are the things to have decided before merging one.
 *
 * Two rules keep this file safe to import from anywhere:
 *   1. Keep it pure — data and pure functions only. No React, no `server-only`,
 *      no environment access. `proxy.ts` is bundled separately from the render
 *      path and cannot rely on shared modules that carry state or globals.
 *      (`lib/tiers.ts`, the one import added for `tier`, obeys the same rule.)
 *   2. Register every new feature route here. Only paths that resolve to a
 *      `'future'` entry are gated, so an unlisted route stays reachable and an
 *      unknown URL still falls through to the normal 404.
 *
 * ── HOW THE TIERS BELOW WERE CHOSEN ────────────────────────────────────────────────
 * From `/pricing`, which is the offer families actually read, and NOT derived from it:
 * `PLANS[]` is prose about benefits and this is a table of routes, and they do not
 * correspond one to one in either direction. FutureFeature.md sets out the mismatches at
 * length; three are worth carrying here, because each is a decision this table makes and
 * a reader will otherwise think is a mistake.
 *
 *   * **`/admin/accounting` is STANDARD**, and this bullet said FREE until 2026-08-19 on the
 *     argument that Free sold "a real ledger for the money you collect". It no longer does:
 *     the whole ledger moved up a rung when Standard was inserted, so the setup screen moved
 *     with the thing it sets up. What PLUS still adds on top is unchanged — taking payment by
 *     card and the P&L, which is `/reporting/pl-summary` and the unbuilt payments work.
 *   * **THE LEDGER IS FIVE ROUTES, NOT ONE**, and they had to move together or the tier
 *     boundary would run through the middle of one member's money.
 *     `/reporting/transactions`, `/admin/accounting`, `/accounting/dues`, `/accounting/donations` and `/reporting/payment-history` are all
 *     `standard`, and `/accounting/summary` — which is a digest of the last three plus the
 *     family's fund balances — went with them, because a Free family reading a Summary with
 *     every section withheld is worse than a Free family with no Summary. Free keeps no money
 *     surface at all, which is the decision, stated plainly so nobody restores one route out
 *     of six and calls it a fix.
 *   * **GATHERINGS ARE SPLIT, and the split is the one thing here a per-route field only just
 *     manages to express.** Free sells "the gathering on a shared calendar" — a date, a place
 *     and the details — so `/gatherings/calendar`, `/gatherings` and `/admin/gatherings` are FREE. What
 *     Standard sells is planning: `/admin/gatherings/templates` (the checklists a gathering is
 *     built from), `/gatherings/my-tasks` (the duties), and `/gatherings/budget` (the money
 *     band). The last two are rows that exist ONLY to carry a tier, the same device
 *     `/reporting/transactions/fund-transfers` uses; both are argued at their entries.
 *
 *     THIS BULLET USED TO READ "Every Gatherings route is FREE … forced rather than generous",
 *     and what made it forced was that a gathering could only be created FROM a template. That
 *     is no longer true: `scheduleGathering` accepts an empty template list now, which is
 *     exactly what makes a Free gathering a date on the calendar rather than a promise nobody
 *     can keep. Splitting the tier without that change would have left Free selling a calendar
 *     nothing could be put on.
 *
 * NOTHING IS PREMIUM, and that is correct rather than an omission. Every Premium bullet
 * — the apps, push notifications, email distributions, automatic dues reminders, the
 * public family website — is unbuilt and has no route, so there is nothing here to mark.
 * The tier exists in `lib/tiers.ts` and a family can be put on it; it currently buys
 * everything Plus buys and nothing more, which is the honest state of that plan.
 *
 * ── WHAT A TIER STILL CANNOT DO, RESTATED BECAUSE STANDARD MADE IT TEMPTING ─────────
 * It withholds SCREENS, never rows. A family moved down from Standard to Free keeps every
 * dues payment, every relationship on the tree and every task it ever recorded, and finds
 * them where they were the day it moves back up. No policy consults `families.tier`, none may
 * start to, and the server actions behind a paid page are deliberately NOT tier-checked — the
 * first time a family downgraded, one of them would start answering "Not authorized" about
 * the family's own history.
 */

import { APP_NAME } from '@/lib/brand'
import { DEFAULT_TIER, type FamilyTier } from '@/lib/tiers'

export type FeatureStatus = 'live' | 'future'

export interface Feature {
  /** Canonical route. Nested paths (`/gatherings/abc`) inherit this feature's entry. */
  href: string
  label: string
  status: FeatureStatus
  /**
   * The cheapest plan that includes this route. Inclusive — see `lib/tiers.ts`.
   *
   * REQUIRED, WITH NO DEFAULT, on purpose. A new feature has to state a tier, because
   * the failure mode of forgetting is invisible and expensive: it ships to every family
   * on every plan, and nothing anywhere says so. That is precisely how RSVPs, day-of
   * check-in and profile pictures came to be sold as Plus while shipping free to
   * everybody — recorded in FutureFeature.md §4 as three separate special cases, because
   * there was no field to leave blank.
   *
   * `status` AND `tier` ARE INDEPENDENT and both must pass. A `'future'` entry can carry
   * a real tier — that is the plan it will belong to when it ships, and stating it now
   * is what makes the flip a one-word change rather than a pricing decision made under
   * time pressure.
   *
   * WHAT THIS CANNOT EXPRESS: a tier boundary that runs THROUGH a page rather than
   * around it. The worked example was `/events`, which was Free ("put the reunion on the
   * calendar") while the RSVPs and head counts inside it were sold as Plus — a per-route
   * field cannot say that, and the route is retired now without the problem having been
   * solved. The mechanism for it already exists and is the same one permissions use: give
   * the capability its own sub-key with its own registry entry, the way
   * `transactions/dues-payments` does, and the way `gatherings/budget` already gates the
   * money band on a page whose own tier is Free. Until somebody does that, a page's tier
   * governs everything on it.
   */
  tier: FamilyTier
  /** One-liner shown on the Coming Soon screen and in inline placeholders. */
  blurb: string
}

export const FEATURES: readonly Feature[] = [
  // ── Live today ──────────────────────────────────────────────────────────────
  {
    href: '/dashboard',
    label: 'Dashboard',
    status: 'live',
    tier: 'free',
    blurb: 'Your family at a glance — roles, account standing, and what needs attention.',
  },
  {
    href: '/personal-info',
    label: 'My Profile',
    status: 'live',
    tier: 'free',
    blurb: 'Your contact details, address, birthday, and t-shirt size.',
  },
  {
    href: '/my-families',
    label: 'My Families',
    status: 'live',
    tier: 'free',
    blurb: 'Every family this account belongs to, and which one opens when you log in.',
  },
  {
    href: '/community/chat',
    label: 'Chat',
    status: 'live',
    tier: 'free',
    blurb: 'Real-time group threads and private direct messages with the family.',
  },
  {
    href: '/community/directory',
    label: 'Directory',
    status: 'live',
    tier: 'free',
    blurb: 'Search and browse everyone in the family, with roles and contact info.',
  },
  {
    href: '/accounting/summary',
    // "Summary", not "My Summary", since 20260812000001. Everything in the Personal half
    // of this product is the caller's own, and the possessive was carried by four
    // labels in a row; the page still shows nobody else's money, which is a property of
    // its RLS rather than of its title. The ROUTE stays /account-summary — it is the
    // permission key in permission_resources and in every grant already issued.
    label: 'Summary',
    status: 'live',
    tier: 'standard',
    // A DIGEST OF THE THREE ENTRIES BELOW plus the family's fund balances, since
    // 20260815000000. It used to BE those three, as panes on a rail; they are screens
    // now, and this page is what it has always been called. Each section here is
    // fetched under the grant of the screen it summarises, so a member who cannot open
    // Donations does not get a donation figure on their Summary either.
    blurb: 'Where you stand: what you owe, what you have paid, the drives that are open, and what the family holds.',
  },
  // ── The three screens Summary summarises ──────────────────────────────────
  // Panes of /account-summary until 20260815000000, each already carrying its own
  // grant under an `account-summary/` prefix. Promoting them to rail items promoted
  // the keys with them, because AGENTS.md §1 leaves no choice: the resource key is the
  // route without its leading slash, and a nav item whose href and key disagree cannot
  // be hidden by the thing that appears to hide it.
  //
  // `dues` IS A RE-USED KEY AND MEANS SOMETHING ELSE NOW. The note further down this
  // file used to say there was no /dues route and no `dues` resource, and it was right
  // for the key 20260808000001 retired — "Dues Records", which governed whether you
  // could see OTHER people's payments. That question still lives on the two
  // `transactions/*` ledgers and is not coming back here. This key governs a SCREEN,
  // and everything behind it is own-only in the action before RLS is consulted at all.
  // The migration asserts the difference rather than describing it: no
  // permission_table_map row, and no policy evaluating auth_permission('dues', …).
  //
  // ALL THREE ARE STANDARD SINCE 2026-08-19, and this note said FREE — "nothing about a
  // member reading their own balance was ever sold". What changed is not a judgement about
  // reading a balance: it is that the LEDGER moved, and these three are windows onto it. A
  // family whose treasurer cannot record a payment has nothing for a member to read, so
  // leaving these Free would have sold three screens that are empty by construction.
  //
  // `/accounting/summary` above moved for the same reason and is the case worth checking first
  // when this looks wrong: it is a digest of these three, so it cannot be a rung below them.
  // ── ONE ITEM SINCE 2026-08-20, WHERE THERE WERE TWO ─────────────────────────────
  // `/accounting/dues` and `/accounting/donations` were separate rail items with separate
  // keys, and `20260820000009` merged both routes and both keys into this one. They are one
  // question in two directions — what the family asks of me, and what it invites me to give —
  // and a member checking one was checking both.
  //
  // The two `blurb`s did not fit in one entry and are not lost: they are the per-pane ledes in
  // `lib/money-panes.ts`, printed under the rail. What is here is the sentence about the SCREEN.
  {
    href: '/accounting/dues-and-donations',
    label: 'Dues & Donations',
    status: 'live',
    tier: 'standard',
    blurb: 'What you owe on every schedule you are on, and every drive your family is running.',
  },
  {
    href: '/reporting/payment-history',
    label: 'Payment History',
    status: 'live',
    tier: 'standard',
    blurb: 'Every payment recorded against you, with its date, method, status and reference.',
  },
  {
    href: '/reporting/transactions',
    label: 'Transactions',
    status: 'live',
    tier: 'standard',
    blurb: 'Every payment, donation, contribution, disbursement and fund transfer the family has recorded.',
  },
  // ── THE FIRST TIER BOUNDARY THAT RUNS *THROUGH* A PAGE, and the mechanism the `tier`
  // note above says to use for one. Added 2026-08-19.
  //
  // Fund transfers are Plus; the other four ledgers on `/reporting/transactions` are Standard as of
  // 2026-08-19 and were Free when this was written. The boundary still runs THROUGH the page,
  // which is what this row is for — only the rung underneath it moved. That is
  // a decision about the CAPABILITY rather than the screen — moving the family's savings
  // out of the pot it was collected for is treasury work, and `transactions/fund-transfers`
  // has been its own permission resource since 20260812000002 for the same reason
  // ("emptying a fund is not the same judgement as paying a member what they are owed").
  //
  // THIS ROW EXISTS ONLY TO CARRY THE TIER, and three things follow that a reader will
  // otherwise take for mistakes:
  //
  //   * `/reporting/transactions/fund-transfers` IS NOT A ROUTE. Nothing navigates there; the ledger
  //     is a pane on `/reporting/transactions?ledger=transfers`. The entry is here because
  //     `tierAllows()` resolves a key through `requiredTier()`, which is `getFeature()`'s
  //     longest-prefix match — so without this row the sub-key inherits `/reporting/transactions`
  //     and is Free, which is exactly what `lib/auth/tier.ts` documents as the default
  //     behaviour ("a tab is part of the page it is on"). This is the deliberate exception
  //     to it, and the only way to state one.
  //   * `status: 'live'` MATTERS. `proxy.ts` gates by prefix, so a `'future'` row here
  //     would rewrite `/reporting/transactions/...` paths to Coming Soon — and, worse, `getResources()`
  //     drops any grid row under a `'future'` prefix, so the Fund Transfers switch would
  //     vanish from Members & Access with no error at all.
  //   * IT ADDS NO RAIL ITEM. `buildNavGroups` renders a hand-written list in
  //     `components/layout/Sidebar.tsx` keyed on `viewKeys`, so a FEATURES row does not
  //     conjure a destination. What it does add is the key to `viewableResources()`, which
  //     is harmless and correct: the Transactions page resolves each ledger with `can()`
  //     plus `tierAllows()` directly.
  //
  // THE PAGE HAS TO HONOUR IT, and gating the fetch is the point rather than the tab
  // (§5): `app/(protected)/transactions/page.tsx` ands `tierAllows()` into every ledger's
  // view answer, so a Free family does not receive the transfer rows in the RSC payload
  // at all. It withholds a SCREEN BAND and never a row — no policy consults
  // `families.tier` and none may start to, so a family that lapses to Free keeps every
  // transfer it ever recorded and loses the pane that lists them.
  {
    href: '/reporting/transactions/fund-transfers',
    label: 'Fund Transfers',
    status: 'live',
    tier: 'plus',
    blurb: 'Moving money between the family’s funds, with both sides of the transfer on one row.',
  },
  // ── What the family is owed, as opposed to what it took ───────────────────
  // `plus`, and that is NOT a judgement made here — `lib/plans.ts` already sells "Dues
  // collected against outstanding" on the Plus card under "The numbers leadership asks
  // for". Shipping this Free would leave a paid bullet describing a free feature, which
  // is the drift FutureFeature.md §4 exists to catch, running the other way.
  //
  // It did NOT flip `/admin/reports`, the other route that bullet covered, and the reason
  // is why that route no longer exists. Reports promised four things — membership, dues
  // collected vs. outstanding, RSVP turnout, t-shirt counts — and delivering one of them
  // under that name would have put a live screen behind a card advertising three it does
  // not do. It was DELETED on 2026-08-20 rather than eventually made to claim the rest;
  // `/reporting/membership` took the one question worth keeping. This route has always claimed
  // exactly what it does, which is the property that made it the model for the split.
  //
  // ONE OF THOSE FOUR NO LONGER HAS A SOURCE, since Events was retired on 2026-08-19: RSVP
  // turnout was read off `event_rsvp_attendees`, a dropped table, and nothing in this product
  // records who is coming to anything. T-SHIRT COUNTS SURVIVED by moving — the sizes were
  // always columns on a member's own profile, and `getOrgStats` reads them from `people` now.
  // The blurb below is trimmed to what can actually be built, and whoever ships that screen
  // owes `lib/plans.ts` the same look.
  //
  // RESTRICTED BY DEFAULT, unlike almost everything else in this category. Every figure
  // is family-wide and the member table names people against what they still owe, so
  // 20260817000000 backfills `resource_visibility` rather than letting the key fall
  // through to `everyone` (§6). The grant follows `transactions/dues-payments:view` at
  // scope 'any': anybody who can already read the whole ledger can read a sum of it.
  {
    href: '/reporting/dues-projections',
    label: 'Dues Projections',
    status: 'live',
    tier: 'plus',
    blurb: 'What the family should collect in dues this year, what has come in, and who has still to pay.',
  },
  // The how-to manual. `free`, and it could not sensibly be anything else — a plan that
  // withholds the instructions is a plan that sells a product nobody can learn.
  //
  // IT HAS NO `permission_resources` ROW, deliberately, so it needs no migration and can
  // never be restricted. Same class as `/dashboard` and the Personal pages, whose rows
  // 20260806000006 deleted: this page reads no family data at all, and the one screen that
  // explains permissions should not be the screen a misconfigured permission can hide. The
  // reasoning is at length on app/(protected)/help/page.tsx.
  //
  // The ENTRY is still required even so — `viewableResources()` walks this list to build
  // the rail, so a page missing from here has no nav item however viewable it resolves to.
  // Every chapter lives beneath `/help` and inherits this entry by prefix.
  {
    href: '/help',
    label: 'How-To Manual',
    status: 'live',
    tier: 'free',
    blurb: 'How every screen works, what each control does, and where to look when something is missing.',
  },

  // Announcements is LIVE, with its admin counterpart. Both were on the roadmap and
  // neither needed a migration to come back: `announcements` and `admin/announcements`
  // have been registered in `permission_resources` since 20260618000000, the system
  // templates carry grants for them, and `resource_visibility` already answers for both —
  // 'everyone' for the member-facing page, 'restricted' for the admin one, which every
  // `category = 'admin'` resource gets from the same migration. So the flip changes who can
  // REACH them and nothing about who may do what once there.
  {
    href: '/community/announcements',
    label: 'Announcements',
    status: 'live',
    tier: 'free',
    blurb: 'Family-wide news, with the important updates pinned to the top.',
  },
  // `/community/updates` — the archive behind the dashboard's Recent Updates card, added 2026-08-19.
  //
  // `tier: 'free'` is the only defensible value and is not a default: the two things it
  // archives are `announcements` (free) and `notifications` (which has no tier because it has
  // no resource at all), and `lib/plans.ts` sells nothing about an archive. Putting a member's
  // own mail behind Plus would also make the dashboard card's "View all" link a sales screen.
  //
  // THE ENTRY IS WHAT PUTS THE KEY IN A CALLER'S VIEWABLE SET. `viewableResources()` walks
  // FEATURES, so without this line the `updates` grid switch would exist, resolve correctly,
  // and never produce a rail item for anybody — silently. It is also what `getFeature()`
  // resolves for the route, and `/community/updates` has no parent to inherit from.
  //
  // THE ROUTE IS A REDIRECT SINCE 2026-08-19 and the entry stays for exactly the reason
  // above. The archive is the Updates pane of `/community/announcements` now, and `/community/updates` sends
  // callers there; the SIDEBAR row went with it, so the key reaches a member through the
  // Announcements row's `viewKeys` instead. That is the same arrangement `/admin/members/organization`
  // has had since the Organization pane absorbed it — read that entry beside this one.
  {
    href: '/community/updates',
    label: 'Updates',
    status: 'live',
    tier: 'free',
    blurb: 'Every announcement and everything sent to you, searchable, newest first.',
  },
  // The family-wide tree, and since 2026-08-13 the ONLY tree: `/community/directory/family-tree` —
  // the per-member lineage view — has been deleted along with `FamilyTreeClient`,
  // `app/actions/ancestors.ts` and `app/actions/spouse.ts`. Both surfaces were always two
  // readers of `person_relationships`, so nothing was migrated; this canvas re-centres on
  // whoever you click, which is what the drill-down was for.
  //
  // THE `BetaBadge` CAME OFF WITH THAT PASS, here and on the rail item. It was never
  // derived from this file and cannot be — `status` has two values and "live but
  // unfinished" is a property of one of them — so it was hand-set in both places and
  // hand-removed from both. What is left for a second pass (step relationships, several
  // marriages drawn separately) is in TODO.md as an ordinary backlog.
  //
  // The permission key is still `family-tree` and is still answered by THIS entry. That is
  // now simply the route without its leading slash, which it was not while the lineage
  // view shared the key from a different path.
  //
  // STANDARD SINCE 2026-08-19, and it is the one route in that move that a reader will
  // question, because a family tree is what people think this product IS. That is the reason
  // rather than an objection to it: the tree is the first thing worth paying for, and Free
  // still answers "who is in this family and how do I reach them" through the Directory,
  // which is a different question from "how are we related". `bloodline_only` on a dues
  // schedule reads `person_relationships` and is NOT tier-checked, deliberately — the tier
  // withholds the canvas, never the graph, so a family that lapses finds every relationship
  // intact and every schedule still billing the people it always billed.
  {
    href: '/community/family-tree',
    label: 'Family Tree',
    status: 'live',
    tier: 'standard',
    blurb: 'A multi-generation tree of parents, grandparents, children, and spouses.',
  },

  // ELECTIONS IS A COMMUNITY SCREEN, SINCE 2026-08-21, and it arrived here from the Review
  // section rather than from nowhere. `20260821000003` moved the key with the route
  // (`review/elections` -> `community/elections`), which is §1's rule and not a preference:
  // the resource key IS the route without its leading slash, so a rail item that changes
  // section changes its key and that is a migration.
  //
  // WHY COMMUNITY AND NOT ITS OWN SECTION. This is the family taking part in its own
  // governance — the same register as the notice board, the roster and the tree, and the
  // opposite end of the same feature from Admin > Elections, which is the console that RUNS
  // one. The two keys stay two keys for 20260821000000's reason: running an election is not
  // voting in one.
  //
  // STILL `tier: 'plus'`, deliberately unchanged. Moving a rail item is a navigation
  // decision; re-pricing a feature is a billing one, and 20260819000009's restructure is
  // what that looks like when it is actually intended.
  {
    href: '/community/elections',
    label: 'Elections',
    status: 'live',
    tier: 'plus',
    blurb: 'Nominate, accept, and vote family-wide, with results tallied live.',
  },

  // ── Journals > Officer: an office's notebook ──────────────────────────────────
  // A rail section of one item, and the item is NOT captioned with the section's own word —
  // which it was, for one day. "Journals > Journals" is the "a section whose own index page
  // IS the section does not double up" exception (AGENTS.md, "The route tree IS the nav
  // rail"), and that exception holds only while the section and the item mean the same
  // thing. Naming the item for WHOSE notebook it is ends that: the section is the feature,
  // the item is the officer's journal. So the route is `/journals/officer` and the key
  // follows it (`20260822000017`).
  //
  // IT LEAVES ROOM, which is the second reason. A journal belonging to a CHAPTER rather than
  // to an office is the obvious next item here, and it would have had nowhere to go under a
  // `/journals` that was already a page.
  //
  // THE ROUTE HAS MOVED TWICE IN THREE DAYS — `/journal`, `/journals`,
  // `/journals/officer` — and each move is one rule being obeyed rather than three
  // opinions: the caption is the route and the route is the key. What it costs is a migration
  // copying every family's grant across, which is exactly why the rule is worth keeping ahead
  // of the archaeology 20260820000004 spent 42 keys undoing.
  //
  // `tier: 'plus'`, matching Board Positions and Organization. That is not a pricing
  // judgement so much as an arithmetic one: the Journal hangs off `family_roles`, and a family
  // that cannot record an office would have a screen that can never have content. Moving it
  // down a tier means moving those with it.
  //
  // THE ROW IS UNCONDITIONAL and appears for anybody holding the grant, whether or not they
  // hold an office. The page has a real empty state and says why; the alternative — hiding it
  // until somebody is appointed — is the `hasAssignments` prop the Sidebar deleted, and it
  // would not work here anyway, because the shell is built once and `ShellWatcher`'s
  // fingerprint does not include `user_roles`. The page's own header argues it.
  {
    href: '/journals/officer',
    label: 'Officer',
    status: 'live',
    tier: 'plus',
    blurb: 'A notebook for each office your family keeps — it stays with the role, not the person.',
  },

  // MY CHILDREN IS NOT ON THE ROADMAP — IT WAS RETIRED, 2026-08-13. `/direct-lineage`
  // was the second way a person could exist: a child record a parent owned, carrying
  // `people.is_minor`, "converted to adult" once they had an email address. There is one
  // kind of person now. A child joins the family the way any relative without an address
  // does — the family tree's "No email address" mode, which has had "Too young for an
  // account" in its own placeholder text since it shipped — and stops being a special
  // case the day somebody invites them, which is the ordinary invitation flow and not a
  // conversion. `20260813000006` dropped the column; the route, its action file and
  // `lib/family-constants.ts` went with it.
  //
  // Nothing is left to register here. `20260806000006` had already deleted the
  // `direct-lineage` row from `permission_resources` when the Personal pages were made
  // always-viewable, so retiring the route needed no migration of its own.

  // ── Events: RETIRED, 2026-08-19. Do not re-add these four entries ─────────
  // `/events`, `/event-planning`, `/admin/events` and `/admin/event-types` were live here
  // until Gatherings replaced them, and every one of them is gone: the routes, the six
  // action modules behind them, the components, the four `permission_resources` rows and
  // the twelve `permission_table_map` rows. `20260819000006` is the migration.
  //
  // THIS IS A DELETION, NOT A `status: 'future'`. AGENTS.md is explicit that Coming Soon
  // withholds a ROUTE and does nothing whatever to the server actions behind it — the
  // `/admin/members/organization` and `/admin/members/board-positions` relights are two afternoons of finding
  // out what that costs — so parking a retired product behind the roadmap gate would have
  // left six action modules published as HTTP endpoints with nobody exercising them. The
  // treatment is `/admin/groups`' and `/admin/announcements`': the entry goes, because the
  // page is not awaiting launch, it no longer exists.
  //
  // AND THE THIRTEEN `event_*` TABLES ARE DROPPED TOO, along with `funds.event_id`,
  // `photo_collections.event_id`, `cancel_overdue_event_assignments()` and the
  // `event_expenses` term in `fund_balance_cents()`. `20260819000006` says at length why a
  // half-retirement — unreachable tables nothing reads — is the expensive state, and why
  // dropping them was available at all: no family is using the product yet, so there were no
  // records to protect.
  //
  // A FUND'S BALANCE IS NOW contributions − disbursements + transfers in − transfers out.
  // Four terms, in the database and in `app/actions/funds.ts` and in
  // `getActiveFundsForRouting`, which is what keeps the three from disagreeing about what a
  // fund holds. The P&L's "Total Spent" is disbursements now, which is the first honest
  // version of that figure — it counted event spend and nothing else before.

  // ── Gatherings: LIVE, and NOT a replacement for Events ─────────────────────
  // A gathering is something the family has to ORGANISE, not merely a date to turn up on.
  // An administrator authors a TEMPLATE — a named, ordered list of steps of mixed kinds (a
  // line of text, a paragraph, a date, a list, a yes/no, a count, an amount of money) — and
  // a gathering is scheduled FROM one or more of those templates. Every step becomes a TASK
  // handed to a named relative, who submits an answer an organizer then approves or denies
  // with notes. A gathering carries a budget drawn on a fund and each task carries its own
  // line against it; a gathering can be flagged premier, which puts it across the top of the
  // Dashboard. `/gatherings/calendar` shows every gathering on the days it falls, a month at a time.
  //
  // EVENTS IS RETIRED AND GATHERINGS IS WHAT REPLACED IT, since 2026-08-19. The header of
  // this block said the opposite for a day — "not being retired, absorbed or renamed" — on
  // the argument that the two answered different questions (Events: when is it and who is
  // coming; Gatherings: who is doing what, and has it been done and accepted). Both
  // questions are answered here now: a gathering carries its dates and its place, `/gatherings/calendar`
  // shows it a month at a time, and the tasks are the half Events never had. What the old
  // note was really protecting against was re-policying twelve `event_*` tables, and the
  // migration does not do that either — it drops their POLICIES rather than rewriting them,
  // leaving the rows unreachable and intact.
  //
  // WHAT IS NOT REPLACED, and is worth naming so nobody assumes otherwise: RSVPs, hotel room
  // blocks and day-of check-in. Those were Events screens and they are gone with it, not
  // ported. A step of a gathering template can ask a relative for any of it — that is what
  // the step kinds are for — but there is no attendee count, no room block and no check-in
  // list in this product today.
  //
  // ALL FIVE ARE FREE, AND THE TEMPLATE LIBRARY IS THE ONE SOMEBODY WILL WANT TO SELL. It
  // cannot be sold, and the reason is structural rather than generous: a gathering can only
  // be created FROM a template, so a family with no template library has no way to schedule
  // a gathering at all. `/pricing`'s Free plan already promises "The reunion on the
  // calendar" (`lib/plans.ts`), so putting the authoring screen behind Plus would make an
  // existing Free bullet false — which is the same reading the retired `/admin/events` and
  // `/admin/event-types` were made Free under. `/gatherings/calendar` is that bullet said out loud: it
  // IS the calendar it names, and since Events was retired it is the ONLY thing keeping that
  // bullet true.
  //
  // The RSVP caveat on `tier` above applies here too, with the same answer. If a capability
  // INSIDE a gathering is ever sold separately it gets its own sub-key with its own entry,
  // the way `transactions/dues-payments` does — and the way `gatherings/budget` already
  // gates the money band without being a route. Until then the page's tier governs the page.
  //
  // NOTHING FROM THIS FEATURE BELONGS IN `TAB_RESOURCES`, and that is a conclusion rather
  // than an omission. All five keys below are routes with entries here, so
  // `viewableResources()` finds every one of them by walking FEATURES. The one Gatherings
  // key with no route of its own is `gatherings/budget`, the money band on
  // `/gatherings/[id]` and `/admin/gatherings/[id]` — and it must NOT be added, because it
  // can never be a caller's ONLY reason to reach a page: both pages that draw that band are
  // already gated on `gatherings:view` and `admin/gatherings:view` respectively, so a member
  // holding the budget key and neither of those has no page to be linked to. That is exactly
  // the case the note on `TAB_RESOURCES` says to leave out.
  //
  // IT DOES HAVE A REGISTRY ROW SINCE 2026-08-19, and the two facts are not in tension —
  // which is worth spelling out, because they look like they are. A row in FEATURES carries
  // the TIER for a key; `TAB_RESOURCES` decides whether `viewableResources()` should hand the
  // key back so a rail item can appear. The budget band needs the first and must not have the
  // second, exactly like `/reporting/transactions/fund-transfers`. (That list gained a second
  // entry on 2026-08-19 — `admin/chapters`, the Organization pane — which does not change
  // this reasoning: read the note on it, because the ground it earns its place on is not the
  // one `admin/users/templates` earns its place on.)
  {
    href: '/gatherings',
    label: 'Gatherings',
    status: 'live',
    tier: 'free',
    // "built from a template" came out of this blurb on 2026-08-19: a template is Standard
    // now, and a Free gathering is a date, a place and the details. The page is the same page.
    blurb: 'What the family is planning, when it falls, and where.',
  },
  // ── THE MONEY BAND, AND THE THIRD ROW THAT EXISTS ONLY TO CARRY A TIER ───────────
  // Added 2026-08-19 with Standard. `gatherings/budget` has been a permission resource since
  // 20260819000000 and had no registry row, so it inherited `/gatherings` and was Free.
  // Budgeting a gathering against a fund is planning, which is what Standard sells, so the
  // row states it.
  //
  // WHAT THIS DOES AND DOES NOT WITHHOLD, and the distinction is already argued at length in
  // the migration that created the key: `gatherings/budget` gates whether the app FETCHES the
  // money columns, and it cannot hide them, because they live on `gatherings` and
  // `gathering_tasks` whose SELECT policy is keyed on `gatherings:view` and no grant can
  // narrow a column. Adding a TIER on top changes nothing about that: it withholds the same
  // screen band from a Free family that the permission key withholds from a member without
  // the grant. If it ever has to become confidentiality, the money moves to its own table
  // with its own map row — a migration, not a comment, and not this row.
  {
    href: '/gatherings/budget',
    label: 'Gathering Budgets',
    status: 'live',
    tier: 'standard',
    blurb: 'What a gathering may spend, which fund it draws on, and what each task has claimed.',
  },
  // MORE SPECIFIC THAN `/gatherings`, WHICH IS WHY IT NEEDS ITS OWN ENTRY. `getFeature()`
  // prefers the longest match, so this row is what answers for `/gatherings/my-tasks` while
  // `/gatherings/[id]` still inherits the row above. `viewableResources()` also needs the KEY
  // `gatherings/my-tasks` in its answer or the rail item disappears for everybody.
  //
  // WHICH ROW WINS NOW MATTERS, and it did not before 2026-08-19: this note used to say the
  // two carried the same tier so nothing turned on the match. They do not — the duties are
  // Standard and the gathering itself is Free — so `/gatherings` and `/admin/gatherings` must
  // resolve their My Tasks and Review panes with `tierAllows()` BY HAND, above their union of
  // grants, the way `/admin/members` does for Organization. A page that calls `requireTier` on
  // `'gatherings'` alone and then opens a pane governed by this key has published a Standard
  // screen to a Free family, and nothing anywhere reports it.
  {
    href: '/gatherings/my-tasks',
    label: 'My Gathering Tasks',
    status: 'live',
    tier: 'standard',
    blurb: 'Every gathering task assigned to you, what to send back, and by when.',
  },
  {
    href: '/gatherings/calendar',
    label: 'Calendar',
    status: 'live',
    tier: 'free',
    blurb: 'A real month grid with every gathering on the days it falls.',
  },

  // ── THE REVIEW WORKLIST IS FINISHED, 2026-08-22 ──────────────────────
  // Six routes came off `status: future` on 2026-08-20 and the rail gathered them under one
  // heading, **Review**, rather than returning each to the section it would eventually
  // belong to. Every one of them was already BUILT — a page gating itself with
  // `requireView`, an action module behind it and a `permission_resources` row — and gated
  // only because nobody had walked them end to end.
  //
  // ALL SIX HAVE NOW BEEN WALKED, and no two went the same way, which is the section having
  // worked rather than the section having shrunk:
  //
  //   /reporting/pl-summary        reviewed, renamed **P&L Summary**, moved to Reporting
  //   /admin/reports               reviewed and DELETED outright, replaced by Membership
  //   /review/election-management  reviewed, renamed **Elections**, moved to Admin
  //   /review/elections            reviewed, moved to Community — the member's own ballot
  //   /review/photos               reviewed, renamed **Gallery**, moved to COMMUNITY
  //   /review/documents            reviewed, moved to JOURNALS
  //
  // The last two went on 2026-08-22 (`20260822000018`), and the **Review** heading in
  // `buildNavGroups` went with them — which its own comment set as the exit condition: "A
  // Review section that outlives the review is the thing to avoid."
  //
  // WHAT THE FLIP DID THAT MOVING A RAIL ITEM DOES NOT UNDO. The permission grid still
  // renders a switch for each; Home still reads them as SHIPPED rather than Coming Soon,
  // because `/features` derives that pill from `isFeatureFuture()` per route; and each now
  // owes a chapter in `/help`, which `npm run help:check` enforces. All three are the review
  // finishing rather than side effects of it.

  // ── In review: accounting ───────────────────────────────────────────────────
  // WHAT THE OLD `dues` RESOURCE GOVERNED, AND WHERE IT WENT — worth keeping now that
  // the key is back above under a different meaning. 20260808000001 retired "Dues
  // Records", and both halves of its job moved to the key of the screen that actually
  // asks the question:
  //
  //   dues_payments SELECT   -> transactions/dues-payments:view
  //                             OR transactions/donation-payments:view
  //                             ("may I see OTHER people's" — a Transactions question)
  //   dues_member_plans      -> nothing. Self-service; a member's own cadence and
  //                             opt-out, which no screen offers to set for anyone else.
  //
  // Both keep an unconditional `person_id = auth_person_id()` clause. That clause is
  // what makes /dues and /payment-history own-only regardless of any grant, and it is
  // why the `dues` entry above can gate a screen without gating a table. Neither of
  // those keys is coming back to this page.
  //
  // The note this replaces claimed `dues:edit` gated "recording a payment for someone
  // other than yourself". That stopped being true in 20260806000000, which moved
  // recording to transactions/dues-payments:create.
  // CAPTIONED "P&L Summary" SINCE 2026-08-20, and REVIEWED — it is a Reporting rail item now
  // rather than one of the six the block above put behind a Review heading. The route and the
  // resource key both stay `family-finances`: that string is in `permission_table_map`, in
  // every grant already issued and in this href, so renaming the path would orphan all of it
  // to retitle a heading. Same trade `admin/family` made when it became "Settings".
  //
  // The label is the caption the rail prints and the caption the permission grid prints, so
  // 20260820000003 moves `permission_resources.label` in the same commit — one row, one
  // caption, per AGENTS.md's "One rail item, one permission resource".
  {
    href: '/reporting/pl-summary',
    label: 'P&L Summary',
    status: 'live',
    tier: 'plus',
    blurb: 'Income against expenses, what each fund holds, and what has not been routed yet.',
  },

  // ── Reporting: who the family is made up of ─────────────────────────────────
  // THE REPLACEMENT FOR `/admin/reports`, and not a rename of it — that route is DELETED
  // (page, action module, client and `permission_resources` row; 20260820000003). It sold
  // four things and delivered a mixture: a member count, a gathering count, dues collected,
  // t-shirt sizes and the last twenty money entries. Every money figure on it duplicated a
  // screen that owns one — `/reporting/pl-summary` for the statement, `/reporting/transactions` for the
  // ledger, `/reporting/dues-projections` for what is outstanding — and the one question an organizer
  // actually brings to a report, *where are our people and how many can we reach*, it did
  // not answer.
  //
  // So this is a member-facing key under `community` rather than an admin tool, because what
  // it publishes is counts and place names and nothing else: no name, no address, no
  // birthday and no id crosses to the browser. It is `plus` because that is where the
  // "numbers leadership asks for" bullet already sells this on `/pricing`, and it is where
  // `/admin/reports` was.
  // CAPTIONED "Membership", not "Membership Report". The word "Report" was doing no work: the
  // row sits under a rail heading that already says Reporting, which is the same argument that
  // shortened "Family Settings" to "Settings" under Admin (20260812000001). The ROUTE and the
  // KEY stay `membership-report`, because a resource key IS the route without its leading
  // slash (§1) and `/membership` would be a fourth word in a family that already has
  // `/community/directory` for the Directory.
  //
  // THREE RAIL ITEMS NOW READ ALIKE — Directory (Community), Members (Admin) and Membership
  // (Reporting) — and that is the same arrangement AGENTS.md already sanctions for "Dues"
  // appearing under both Accounting and Transactions: the section heading is what tells them
  // apart, and each caption is right under its own heading.
  {
    href: '/reporting/membership',
    label: 'Membership',
    status: 'live',
    tier: 'plus',
    blurb: 'Members by region and chapter, who has finished joining, and adults against minors.',
  },

  // ── Community: the family's photographs ─────────────────────────────────────
  // **Gallery**, and `/review/photos` captioned "Photos" until 2026-08-22. A shared album is
  // the family being a family, which is what the Community section holds — the Directory, the
  // tree, Chat. It was filed under `resources` beside Documents on the strength of both being
  // uploads, which is a fact about the STORAGE rather than about what either screen is for.
  //
  // THE CAPTION MOVED TOO, because "Photos" named a file type where every other row in that
  // section names a thing the family keeps. `20260822000018` moved the key with the route and
  // the label with the caption, per "One rail item, one permission resource".
  {
    href: '/community/gallery',
    label: 'Gallery',
    status: 'live',
    tier: 'plus',
    blurb: 'Every album the family keeps — upload in a batch, tag who is in each picture, and find them again.',
  },

  // ── Journals: the family's records and how it governs itself ────────────────
  // THREE ROWS ARRIVED HERE ON 2026-08-22 and the section went from one item to four. Documents
  // MOVED (from `/review/documents`); Meeting Minutes and Bylaws are new. What they share with
  // the officer's journal is the reader: somebody looking for what the family wrote down.
  //
  // ALL THREE ARE `plus`, matching Officer — which is an arithmetic judgement rather than a
  // pricing one, the same as that row's: the section hangs off `family_roles`, and a family
  // that cannot record an office would have screens that can never have content.
  {
    href: '/journals/documents',
    label: 'Documents',
    status: 'live',
    tier: 'plus',
    blurb: 'Forms, filings and signed copies in one shared place that does not live in an inbox.',
  },
  {
    href: '/journals/meeting-minutes',
    label: 'Meeting Minutes',
    status: 'live',
    tier: 'plus',
    blurb: 'Who met, who was there, what was decided — and how the room voted.',
  },
  // SCAFFOLDING, and the entry says so rather than the screen pretending otherwise. The table,
  // the index and the search are real; extraction from PDF and Word is not built, so those
  // upload and are searchable by title and summary until it is. `app/actions/bylaws.ts` carries
  // the whole argument and every row on the screen carries a badge saying which it is.
  {
    href: '/journals/bylaws',
    label: 'Bylaws',
    status: 'live',
    tier: 'plus',
    blurb: 'The rules the family agreed to live by, searchable.',
  },
  // ── Admin ───────────────────────────────────────────────────────────────────
  // The `/admin` entry covers every nested admin route by prefix; the specific
  // entries below exist so the Coming Soon screen can name the right tool.
  //
  // `/admin` IS STILL 'future' AND MUST STAY THAT WAY, which is not an oversight of the
  // 2026-08-20 review flip above. It is NOT A PAGE — there is no app/(protected)/admin/page.tsx
  // — it is the prefix that gates every nested admin route nobody has registered here.
  // `/admin/elections` — which came back under this prefix on 2026-08-21 — carries its own
  // entry below and so wins the longest-prefix match on its own account. Flipping this row would
  // silently publish the NEXT admin route somebody adds without an entry of its own, which is
  // the failure this catch-all exists to prevent.
  //
  // Members & Access is LIVE — it was rebuilt on the permission model, and gating it
  // would leave a family unable to administer itself. Who actually sees it is decided
  // by the permission model, not here: the page starts 'restricted' so only
  // administrators reach it.
  {
    href: '/admin',
    label: 'Admin Tools',
    status: 'future',
    tier: 'free',
    blurb: 'The leadership toolkit for running your family organization.',
  },
  // Settings is LIVE, and is the family's own identity rather than a tool for
  // running it — the name every other admin page is about, and the code people join by.
  // It has to be live for a second reason beyond being built: getResources() drops any
  // resource key whose path resolves to a 'future' feature, and getFeature()
  // longest-prefix-matches — so with no entry here `/admin/settings` would resolve to the
  // catch-all `/admin` above, and the row would vanish from the permission grid with no
  // error anywhere. Who actually sees it is the permission model's business:
  // 20260812000000 registers it 'restricted' per family, so it is administrators-only
  // until a family says otherwise.
  //
  // Named "Settings", not "Family Settings", since 20260812000001. The word "Family" was
  // doing no work: every page under Admin is about the one family the caller is acting
  // in, and the rail item sat directly under an Admin heading that had already said so.
  // The ROUTE and the RESOURCE KEY both stay `admin/family` — that string is wired into
  // permission_table_map, the `families` policy and every grant already issued, so
  // renaming the path would orphan them all to retitle a heading.
  {
    href: '/admin/settings',
    label: 'Settings',
    status: 'live',
    tier: 'free',
    blurb: 'Your family’s name and the code relatives join with.',
  },
  // Absorbed /admin/groups in 20260807000000. One template per member replaced group
  // membership plus per-person overrides, which left nothing for a second screen to
  // show — so the route is gone, and its resource key was merged into this one. A
  // stale /admin/groups URL now 404s, which is right: it is not a feature awaiting
  // launch, it is a page that no longer exists.
  {
    href: '/admin/members',
    // "Members", not "Members & Access", since 20260812000001. The "& Access" half was
    // there to say the page had absorbed Groups & Permissions; two renames later it is
    // the only members screen an administrator has, and the qualifier only competed with
    // Community > Directory for what the word "members" means. The key stays
    // `admin/users`, as does the sub-heading its three tabs group under in the grid.
    label: 'Members',
    status: 'live',
    tier: 'free',
    blurb: 'Who is in the family, and the permission template deciding what each of them can do.',
  },
  // Member Approvals is LIVE, and must be: it is the only surface that can admit
  // someone who has joined by family code, and a family with an unreachable approvals
  // queue would collect applicants it could never let in. Who sees it is decided by the
  // permission model — 20260806000010 registers it 'restricted' per family, so it is
  // administrators-only until a family says otherwise.
  //
  // THE ROUTE IS NOW A REDIRECT. The queue moved into Members & Access as its Pending
  // Approval tab; /admin/approvals only forwards to it, so that the link in a pending
  // member's notification and anything an administrator bookmarked keep working.
  //
  // The entry stays, and removing it would break the move rather than tidy up after it.
  // viewableResources() walks THIS list to build the set of keys a caller may view, and
  // `admin/approvals` is the key that governs the tab, its server actions and the RLS on
  // the rows behind them — drop the entry and the tab disappears for everybody,
  // administrators included. It is a resource key that happens to have a redirect at the
  // matching path, not a page awaiting launch.
  {
    href: '/admin/members/approvals',
    label: 'Member Approvals',
    status: 'live',
    tier: 'free',
    blurb: 'Review the people asking to join your family, and admit or decline them.',
  },
  // Regions & Chapters is LIVE (2026-08-18), and dues can now be scoped to one
  // (20260817000008). The route, its actions, its client and its `admin/chapters`
  // permission resource all existed and were wired, so no migration was needed to
  // REGISTER anything — the key has been in `permission_resources` since 20260618000000,
  // it is category 'admin' and so born 'restricted' per family, and
  // `seed_family_permission_templates()` gives Administrators every action on every admin
  // key. The rail item in `Sidebar.tsx` was already there too.
  //
  // FLIPPING THE WORD WAS NOT THE WHOLE JOB, and this is the entry to read before flipping
  // another old route. Everything in `app/actions/admin/chapters.ts` predates §3, §4 and
  // the permission model, and every one of those actions was a live HTTP endpoint the
  // entire time it was gated — Coming Soon withholds the PAGE, never the actions. Two
  // cross-family deletes, one unchecked reference and two ungated reads came back with it;
  // that file's header lists them.
  //
  // STILL `plus`. /pricing sells "Split a large family into chapters with their own
  // leadership" on the Plus card and `/features` prints the same, so shipping it Free would
  // leave a paid bullet describing a free feature. National is unaffected by that and has
  // to be: it is the ABSENCE of a region rather than a row, so every family on every plan
  // has it, and a Free family's schedules are all National by construction — see
  // 20260817000008, which states the whole argument.
  //
  // THE ROUTE IS NOW A REDIRECT, AND THE ENTRY STAYS (2026-08-19). Regions & Chapters is a
  // PANE of Members & Access, captioned "Organization"; `/admin/members/organization` forwards to
  // `/admin/members?tab=organization` and renders nothing of its own. Three things depend on
  // this row surviving that, and it is the `/admin/members/approvals` argument in every particular:
  //
  //   * `viewableResources()` walks FEATURES, so this is what keeps the key
  //     `admin/chapters` in a caller's viewable set — and the Members row in `Sidebar.tsx`
  //     lists it in `viewKeys`, so a member holding Organization and nothing else still has
  //     a link to the page that opens for them.
  //   * `npm run help:check` asserts every manual chapter's `route` is an exact href in this
  //     list. The Regions & Chapters chapter carries `route: '/admin/members/organization'`.
  //   * `tier` and `status` are read by ROUTE, and deleting this row does not make them
  //     unknown — `getFeature()` longest-prefix-matches, so `/admin/members/organization` would fall
  //     through to the `/admin` catch-all above, which is `tier: 'free'` and
  //     `status: 'future'`. Both halves of that are wrong: the pane would be handed to every
  //     plan (making the Plus bullet on /pricing false), and `proxy.ts` would intercept the
  //     redirect itself into Coming Soon — a live pane advertised as not yet built.
  //
  // THE LABEL IS THE GRID'S CAPTION, WHICH IS THE RAIL'S CAPTION. 20260819000002 sets
  // `permission_resources.label` to 'Organization' and moves the row under the Members
  // sub-heading, so this string moves with it — an administrator matching a switch to the
  // thing it switches off should not have to translate ("Captions come from the screen",
  // AGENTS.md). The cost is real and worth stating: three surfaces print this label without
  // the pane around it — `/upgrade`, `/coming-soon`'s live-feature list, and
  // `describeFeature()` generally — and "Organization" is thinner there than "Regions &
  // Chapters" was. The `blurb` below is what carries the specifics on all three, and it is
  // deliberately unchanged.
  {
    href: '/admin/members/organization',
    label: 'Organization',
    status: 'live',
    tier: 'plus',
    blurb: 'Organize a large family into regional chapters with scoped leadership.',
  },
  // The route is `/admin/members/board-positions`, renamed from the old `/admin/user-roles`.
  // The permission resource key was renamed to match in 20260805000006 — requireView()
  // looks the page up by that key, so the path and the key have to stay in step. The
  // `user_roles` TABLE keeps its name; only the route and the resource key moved.
  //
  // LIVE SINCE 2026-08-19, and the flip cost far more than the one word this comment used
  // to promise. What it took is worth recording, because the next roadmap route will read
  // this entry looking for the price:
  //
  //   * **`family_roles` was a hybrid table with a global `UNIQUE (name)`.** Two families
  //     could not both call a position "Reunion Treasurer", and one family creating
  //     'President' took that name off the built-in list for everybody else. 20260819000004
  //     made the table per-family — `family_code` NOT NULL, `(family_code, name)` unique,
  //     `is_global` dropped, the 25 built-ins retired, `family_role_exclusions` dropped —
  //     and a family now starts with no positions and configures its own.
  //   * **Its SELECT policy had no family conjunct.** `20260604000000` wrote `USING (true)`,
  //     nothing revisited it, and `20260618000001`'s sweep faithfully preserved the `true` —
  //     so anybody holding this key in their own family read every family's positions off
  //     PostgREST. That is the cross-pollination, and it was the base policy rather than the
  //     sweep that was wrong.
  //   * **Four exports in `app/actions/admin/users.ts` were unswept and unreviewed.**
  //     `assignRole` wrote four client-supplied ids onto a row carrying the caller's own
  //     family_code (§4), `revokeRoleByAssignmentId` deleted by id with no family conjunct at
  //     all (§3), two reads demanded nothing but a session — and `updateUserProfile` shared
  //     their helper, so "may curate board positions" meant "may rewrite any member's
  //     profile". None of the four had a caller.
  //   * **There was no UI that gave anybody a position**, so the screen curated a catalogue
  //     nothing consumed. `assignBoardPosition` / `revokeBoardPosition` and the assignment
  //     dialog are what make the blurb below true.
  //
  // The lesson is the one AGENTS.md already states and this is the second file to prove it:
  // COMING SOON WITHHELD THE PAGE AND NEVER THE ACTIONS. Every hole above was reachable for
  // as long as the word said `'future'`. Reviewing a roadmap feature's actions is owed when
  // the code is written, not when the flag flips.
  //
  // ── AND SINCE 2026-08-20 THE ROUTE IS A REDIRECT, NOT A SCREEN ──────────────────
  // Board Positions is the SECOND HALF of Members & Access's Organization pane, beside Regions
  // & Chapters, and `/admin/members/board-positions` rewrites to `/admin/members?tab=organization`. The
  // entry stays for the three reasons the redirect page argues at length — old links, the key
  // in `viewableResources()`'s answer, and `help:check` asserting every chapter's `route` is a
  // FEATURES href — and the key is also in `TAB_RESOURCES` below, on the same footing as
  // `admin/chapters`.
  //
  // `status: 'live'` AND `tier: 'plus'` BOTH STILL MATTER even though nothing renders here.
  // `'future'` would send `proxy.ts` after the redirect itself and rewrite it to Coming Soon —
  // a live pane advertised as unbuilt — and would drop the grid row out of `getResources()`.
  // The tier is what `/admin/members` ands into the pane's grant by hand, since that page's own
  // key is Free.
  {
    href: '/admin/members/board-positions',
    label: 'Board Positions',
    status: 'live',
    tier: 'plus',
    blurb: 'Keep the offices your family holds, and record who holds each one.',
  },
  // ELECTIONS IS THE ORGANIZER'S SCREEN, AND IT CAME BACK HERE ON 2026-08-21. It spent one
  // day at `/review/election-management` in the rail's Review section — the worklist of six
  // routes that came off `status: 'future'` on 2026-08-20 — and this is that section working
  // rather than shrinking: the screen was walked, and what the walk found is 20260821000001.
  // The route, the folder and the key all moved together, which AGENTS.md's route rule leaves
  // no choice about: a screen lives at `/<rail section>/<rail caption>` and its key is that
  // path without the leading slash. So Admin > Elections is `/admin/elections`.
  //
  // CAPTIONED "Elections", not "Election Management". The word "Management" was doing the
  // work the rail heading already does — the same argument that shortened "Family Settings"
  // to "Settings" (20260812000001) and "Membership Report" to "Membership" (20260820000003).
  //
  // TWO RAIL ITEMS NOW READ "Elections", this one under Admin and `/community/elections`
  // under Community, which is the
  // arrangement AGENTS.md sanctions for "Dues" appearing under both Accounting and
  // Transactions: each caption is right under its own section heading, and the two are two
  // KEYS because they are two jobs — running an election is not voting in one.
  //
  // BOTH HALVES HAVE NOW LEFT REVIEW, in opposite directions and on the same day. This one
  // came here on 20260821000000; the member's ballot went to Community on 20260821000003.
  //
  // THE KEY IS `admin/elections` AGAIN, WITH CATEGORY `admin`, and that pair is load-bearing
  // rather than cosmetic: 20260817000004 makes an `admin/…` key resolve `view` to 'none'
  // where a family has no visibility row, so the move is what puts this screen back to
  // FAILING CLOSED. 20260821000000 is the migration, and 20260820000004's own header
  // predicted it word for word.
  {
    href: '/admin/elections',
    label: 'Elections',
    status: 'live',
    tier: 'plus',
    blurb: 'Set the nomination and voting windows, choose the level, and publish the ballot.',
  },
  // THERE IS NO `/admin/announcements` ENTRY, and its absence is deliberate rather than an
  // oversight. The route is deleted — page, client and permission resource
  // (20260813000000) — because it was a second screen answering the same question as
  // `/community/announcements`: post news, pin it, delete it. Everything it could do, the member
  // page now does under the same `announcements` key, gated per control by
  // `announcements:edit` and `announcements:delete`. A stale URL 404s, which is correct:
  // it is not a feature awaiting launch, it is a page that no longer exists — the same
  // treatment `/admin/groups` got in 20260807000000.
  //
  // Do not re-add it on the strength of the note that used to sit here about the rail. The
  // `Sidebar.tsx` `adminItems` entry went with it.
  // THERE IS NO `/admin/reports` ENTRY, and its absence is a DELETION rather than a gate.
  // Removed 2026-08-20 with the page, `app/actions/admin/reports.ts`, `AdminReportsClient`
  // and the `permission_resources` row (20260820000003). What replaced it is
  // `/reporting/membership` above, which is a different screen answering a question that one
  // did not — the argument is at that entry. A stale URL 404s, which is correct: it is not a
  // feature awaiting launch, it is a page that no longer exists, and that is the same
  // treatment `/admin/announcements` and `/admin/groups` got.
  //
  // Do not re-add it on the strength of the marketing item that used to point here. The
  // `Leadership reports` card in `/features`'s ALSO grid points at `/reporting/membership` now,
  // and its blurb was rewritten to describe what that screen actually does.
  // The organizer half of Gatherings — see the long note beside `/gatherings` above for what
  // a gathering is, what retiring Events did and did not replace, and why none of the five
  // keys is a `TAB_RESOURCES` case. Both of these sit here rather than up there for the
  // reason every other admin route does: this file groups by AUDIENCE, so the member-facing
  // rows are up in the Gatherings block and the two admin rows are down here in the admin
  // block. They ship together and they have to — `/admin/gatherings` cannot schedule a
  // gathering that `/admin/gatherings/templates` was not there to author, and `/gatherings`
  // cannot show one that nothing scheduled.
  {
    href: '/admin/gatherings',
    label: 'Gathering Management',
    status: 'live',
    tier: 'free',
    blurb: 'Schedule a gathering, set its budget, hand out the tasks, and rule on the answers.',
  },
  {
    href: '/admin/gatherings/templates',
    label: 'Gathering Templates',
    status: 'live',
    tier: 'standard',
    blurb: 'Reusable step-by-step lists that every gathering is built from.',
  },
  // ── SEPARATION OF DUTIES IS SOLD ON STANDARD, AND THIS ROW IS HOW ────────────────
  // Added 2026-08-19. Second instance of the `/reporting/transactions/fund-transfers` device — a
  // registry row whose only job is to carry a tier for a sub-key — and everything that entry
  // says about it applies here. Three things a reader will otherwise take for mistakes:
  //
  //   * `/admin/members/templates` IS NOT A ROUTE. The permission grids are a PANE of
  //     `/admin/members`, and the key is in `TAB_RESOURCES` below precisely because it has no
  //     route to be found by. The row is here because `tierAllows()` resolves a key through
  //     `requiredTier()`, which is `getFeature()`'s longest-prefix match — so without it the
  //     sub-key inherits `/admin/members` and is Free, which is what `lib/auth/tier.ts`
  //     documents as the default ("a tab is part of the page it is on"). This is the
  //     deliberate exception, and a row is the only way to state one.
  //   * IT ADDS NO RAIL ITEM. `buildNavGroups` renders a hand-written list keyed on
  //     `viewKeys`, so a row here conjures no destination. What it adds is the key to
  //     `viewableResources()`, which is what the key was already in `TAB_RESOURCES` for.
  //   * `status: 'live'` MATTERS, for the reason spelled out on the fund-transfers row:
  //     `'future'` would rewrite `/admin/members/...` to Coming Soon at the edge AND drop every
  //     grid row under the prefix out of `getResources()`, so the switches would vanish with
  //     no error at all.
  //
  // THE PAGE HAS TO HONOUR IT, and `/admin/members` already had the machinery: it resolves its
  // four panes by hand and ands `tierAllows()` into the Organization one. The Templates pane
  // now does the same, and the pane is ABSENT rather than empty (§5). A Free family keeps
  // every template it ever built and every grant on it — this withholds the EDITOR, not the
  // model: `auth_permission()` still reads whatever template each member is on, because a
  // permission model that switched off with a plan would be a downgrade that hands the family
  // more access than it paid for rather than less.
  {
    href: '/admin/members/templates',
    label: 'Permission Templates',
    status: 'live',
    tier: 'standard',
    blurb: 'The grid that decides who may do what, one row per feature and four switches across.',
  },
  // Accounting is LIVE — it is where dues get set up: schedules, recorded
  // payments, and the funds those payments route into. The route stays
  // `/admin/accounting` because that string is also the permission resource key, wired
  // into RLS via permission_table_map. Only the display name changed.
  {
    href: '/admin/accounting',
    label: 'Accounting',
    status: 'live',
    tier: 'standard',
    blurb: 'Dues schedules, funds, and payment routing for the whole family.',
  },
]

/** True when `pathname` is `href` itself or nested beneath it. */
function covers(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Resolve the feature owning `pathname`, preferring the most specific match so
 * `/admin/elections` reports Elections rather than the catch-all Admin Tools entry.
 */
export function getFeature(pathname: string): Feature | undefined {
  let match: Feature | undefined
  for (const feature of FEATURES) {
    if (covers(pathname, feature.href) && (!match || feature.href.length > match.href.length)) {
      match = feature
    }
  }
  return match
}

/** Explicitly registered as still on the roadmap. Unknown paths are not future. */
export function isFeatureFuture(pathname: string): boolean {
  return getFeature(pathname)?.status === 'future'
}

/** Explicitly registered as shipped. Unknown paths are not live. */
export function isFeatureLive(pathname: string): boolean {
  return getFeature(pathname)?.status === 'live'
}

/**
 * The cheapest plan that includes `pathname`.
 *
 * An unregistered path answers Free, which matches `isFeatureFuture()` answering false
 * for one: this registry gates what it knows about and lets everything else through to
 * the ordinary 404. A path nobody has registered is not a paid feature — it is a typo,
 * or a sub-key riding on its parent, and either way withholding it would be the wrong
 * error.
 */
export function requiredTier(pathname: string): FamilyTier {
  return getFeature(pathname)?.tier ?? DEFAULT_TIER
}

/**
 * The gate used by `proxy.ts`. Only known future features are intercepted, so a
 * mistyped URL still renders the real 404 instead of claiming to be a feature
 * that is on the way.
 */
export function isGatedPath(pathname: string): boolean {
  return isFeatureFuture(pathname)
}

const UNKNOWN_FEATURE = {
  label: 'This feature',
  blurb: `We are still building this part of ${APP_NAME}. It will show up here once it ships.`,
}

/**
 * Copy for the roadmap surfaces. Always resolves to something printable so call
 * sites don't each need to handle an unregistered path.
 */
export function describeFeature(pathname: string): { label: string; blurb: string } {
  return getFeature(pathname) ?? UNKNOWN_FEATURE
}

/** Shipped features, in registry order — the "available now" list. */
export const LIVE_FEATURES: readonly Feature[] = FEATURES.filter(f => f.status === 'live')

/**
 * Permission resource keys that gate a TAB inside a live page rather than a route of
 * their own.
 *
 * `viewableResources()` builds the sidebar's answer by walking FEATURES, so a key with
 * no entry there resolves to nothing and any nav item depending on it disappears. That
 * is fine for a key nobody navigates by — the four `transactions/*` ledgers and the
 * seven `admin/account/*` sections are all reached through a page that has its own
 * entry — but not for one that can be a caller's ONLY reason to reach a page.
 *
 * `admin/users/templates` is that case. Members & Access opens for any of its four
 * tab grants (see the page), so someone holding Permission Templates and none of the
 * other three has a working page and, without this, no link to it.
 *
 * `admin/chapters` is the same case since 2026-08-19 — Organization is the fourth of
 * those tabs — AND IT IS REDUNDANT TODAY, which is the honest way to record it rather
 * than leaving a future reader to discover it. `/admin/members/organization` is still a FEATURES
 * entry (a redirect into the same page, and the note on that entry says why the entry
 * has to stay), so `viewableResources()` already finds the key by walking FEATURES and
 * this listing adds nothing but a second insert into a Set. That is exactly the ground
 * on which `admin/approvals` — also a redirect into this same page — is deliberately
 * NOT here.
 *
 * It is listed anyway, and the reason is what the two entries do NOT share. The
 * `/admin/members/approvals` path is quoted in notification links and invitation emails outside
 * this codebase's control, so nobody will ever be tempted to delete that entry.
 * `/admin/members/organization` renders nothing at all now, which makes deleting it look like
 * tidying up — and the day somebody does, this line is what stops the Organization pane
 * from silently disappearing from the rail for the one caller whose only grant it is.
 * A key that gates a tab belongs in the list of keys that gate tabs.
 *
 * `announcements/birthdays` is the THIRD, added 2026-08-19, and it is the pure form of the
 * case — the one entry here whose key has no route of any kind, so nothing else could ever
 * find it. `/community/announcements` opens for EITHER `announcements` or `announcements/birthdays`
 * (the page decomposes `requireView` and says why), and `viewableResources()` resolves the
 * nav item for that href against the `announcements` key alone. So a family that grants the
 * Birthdays pane while restricting the board leaves that member a page that works and no
 * link to it — reachable by typing the URL, which is not a product. Unlike `admin/chapters`
 * above, this line is not redundant: delete it and the sidebar item disappears for that
 * caller today, not on some future tidy-up.
 *
 * `admin/boardpositions` is the FOURTH, added 2026-08-20, and it is the `admin/chapters`
 * case exactly — including the redundancy. Board Positions became the second half of the same
 * Organization pane, `/admin/members/board-positions` is still a FEATURES entry (a redirect into it),
 * so `viewableResources()` already finds the key by walking FEATURES and this line adds
 * nothing but a second insert into a Set.
 *
 * It is listed anyway, and for the reason that entry gives about itself rather than a new one:
 * `/admin/members/board-positions` renders nothing at all now, which makes deleting it look like
 * tidying up — and the day somebody does, this line is what stops the offices half of
 * Organization silently disappearing from the rail for the one caller whose only grant it is.
 * A key that gates a tab belongs in the list of keys that gate tabs.
 *
 * Read all four notes before adding anything to either list.
 */
export const TAB_RESOURCES: readonly string[] = [
  'admin/members/templates', 'admin/members/organization', 'community/announcements/birthdays',
  'admin/members/board-positions',
]
