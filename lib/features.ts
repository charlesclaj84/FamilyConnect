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
 *   * **`/admin/account` is FREE.** Free sells "a real ledger for the money you collect —
 *     dues plans and a contribution ledger for cash", and dues schedules and funds are
 *     where that is set up. What Plus adds is taking payment by card and the P&L, which
 *     is `/family-finances` and the unbuilt payments work — not the setup screen.
 *   * **`/admin/events` and `/admin/event-types` are FREE**, because "put the reunion on
 *     the calendar" is a Free bullet and `/events` cannot show a reunion that nothing can
 *     create. The RSVPs and head counts inside them are sold as Plus and are NOT split
 *     out; see the note on `tier` above for why a per-route field cannot express that and
 *     what would.
 *   * **`/event-planning` is FREE by decision**, closing FutureFeature.md decision 3,
 *     which warned it would otherwise "decide itself as Free by default". It ships with
 *     the events set and no marketing surface sells it separately.
 *
 * NOTHING IS PREMIUM, and that is correct rather than an omission. Every Premium bullet
 * — the apps, push notifications, email distributions, automatic dues reminders, the
 * public family website — is unbuilt and has no route, so there is nothing here to mark.
 * The tier exists in `lib/tiers.ts` and a family can be put on it; it currently buys
 * everything Plus buys and nothing more, which is the honest state of that plan.
 */

import { APP_NAME } from '@/lib/brand'
import { DEFAULT_TIER, type FamilyTier } from '@/lib/tiers'

export type FeatureStatus = 'live' | 'future'

export interface Feature {
  /** Canonical route. Nested paths (`/events/abc`) inherit this feature's entry. */
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
   * around it. `/events` is Free ("put the reunion on the calendar") and the RSVPs and
   * head counts inside it are sold as Plus, and a per-route field cannot say that. The
   * mechanism for it already exists and is the same one permissions use — give the
   * capability its own sub-key with its own registry entry, the way
   * `transactions/dues-payments` does. Until somebody does that for RSVPs, the page's
   * tier governs everything on it.
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
    href: '/chat',
    label: 'Chat',
    status: 'live',
    tier: 'free',
    blurb: 'Real-time group threads and private direct messages with the family.',
  },
  {
    href: '/members',
    label: 'Directory',
    status: 'live',
    tier: 'free',
    blurb: 'Search and browse everyone in the family, with roles and contact info.',
  },
  {
    href: '/account-summary',
    // "Summary", not "My Summary", since 20260812000001. Everything in the Personal half
    // of this product is the caller's own, and the possessive was carried by four
    // labels in a row; the page still shows nobody else's money, which is a property of
    // its RLS rather than of its title. The ROUTE stays /account-summary — it is the
    // permission key in permission_resources and in every grant already issued.
    label: 'Summary',
    status: 'live',
    tier: 'free',
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
  // ALL THREE ARE FREE, like the page they came off. Nothing about a member reading
  // their own balance was ever sold, and splitting one Free screen into three would be
  // a strange moment to start.
  {
    href: '/dues',
    label: 'Dues',
    status: 'live',
    tier: 'free',
    blurb: 'Every schedule you are on, what each installment costs, and when the next one falls due.',
  },
  {
    href: '/donations',
    label: 'Donations',
    status: 'live',
    tier: 'free',
    blurb: 'The drives your family is running, how far each has got, and what you have given.',
  },
  {
    href: '/payment-history',
    label: 'Payment History',
    status: 'live',
    tier: 'free',
    blurb: 'Every payment recorded against you, with its date, method, status and reference.',
  },
  {
    href: '/transactions',
    label: 'Transactions',
    status: 'live',
    tier: 'free',
    blurb: 'Every payment, donation, contribution, disbursement and fund transfer the family has recorded.',
  },
  // ── What the family is owed, as opposed to what it took ───────────────────
  // `plus`, and that is NOT a judgement made here — `lib/plans.ts` already sells "Dues
  // collected against outstanding" on the Plus card under "The numbers leadership asks
  // for". Shipping this Free would leave a paid bullet describing a free feature, which
  // is the drift FutureFeature.md §4 exists to catch, running the other way.
  //
  // It does NOT flip `/admin/reports`, which is the other route that bullet covers.
  // Reports promises four things — membership, dues collected vs. outstanding, RSVP
  // turnout, t-shirt counts — and delivering one of them under that name would put a
  // live screen behind a card that still advertises three it does not do. This route
  // claims exactly what it does; Reports stays `future` until it can claim the rest.
  //
  // RESTRICTED BY DEFAULT, unlike almost everything else in this category. Every figure
  // is family-wide and the member table names people against what they still owe, so
  // 20260817000000 backfills `resource_visibility` rather than letting the key fall
  // through to `everyone` (§6). The grant follows `transactions/dues-payments:view` at
  // scope 'any': anybody who can already read the whole ledger can read a sum of it.
  {
    href: '/dues-projections',
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
    href: '/announcements',
    label: 'Announcements',
    status: 'live',
    tier: 'free',
    blurb: 'Family-wide news, with the important updates pinned to the top.',
  },
  // The family-wide tree, and since 2026-08-13 the ONLY tree: `/members/family-tree` —
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
  {
    href: '/family-tree',
    label: 'Family Tree',
    status: 'live',
    tier: 'free',
    blurb: 'A multi-generation tree of parents, grandparents, children, and spouses.',
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

  // ── Events: LIVE ────────────────────────────────────────────────────────────
  // All four event routes came back together, and they have to: `/events` cannot show a
  // reunion that `/admin/events` is not there to create, and `/event-planning` lists
  // assignments that only `/admin/event-types` and `/admin/events` hand out. Shipping the
  // member-facing half alone would have been an empty page with no way to fill it.
  //
  // Same as announcements, no migration was needed — all four keys are registered, the
  // two admin ones are 'restricted' per family, and `events` and `event-planning` default
  // to 'everyone' for view.
  //
  // WHAT DID NOT COME BACK WITH THEM: the storage rework. `event-photos` is a `public`
  // bucket whose policies carry no family predicate, and `deleteEventPhoto` takes its
  // object path from the client. Those were queued behind this flip and are now ahead of
  // it — see FutureFeature.md, where the item moved out of the Free list for that reason.
  {
    href: '/events',
    label: 'Events',
    status: 'live',
    tier: 'free',
    blurb: 'Reunion itineraries, hotel room blocks, and RSVPs for your whole household.',
  },
  {
    href: '/event-planning',
    label: 'Event Planning',
    status: 'live',
    tier: 'free',
    blurb: 'Your assigned planning tasks, with deadlines and completion tracking.',
  },

  // ── Gatherings: LIVE, and NOT a replacement for Events ─────────────────────
  // A gathering is something the family has to ORGANISE, not merely a date to turn up on.
  // An administrator authors a TEMPLATE — a named, ordered list of steps of mixed kinds (a
  // line of text, a paragraph, a date, a list, a yes/no, a count, an amount of money) — and
  // a gathering is scheduled FROM one or more of those templates. Every step becomes a TASK
  // handed to a named relative, who submits an answer an organizer then approves or denies
  // with notes. A gathering carries a budget drawn on a fund and each task carries its own
  // line against it; a gathering can be flagged premier, which puts it across the top of the
  // Dashboard. `/calendar` shows gatherings and events together, a month at a time.
  //
  // EVENTS IS NOT BEING RETIRED, ABSORBED OR RENAMED. `/events`, `/event-planning`,
  // `/admin/events` and `/admin/event-types` stay exactly where they are, on their own
  // tables, their own resource keys and their own policies, and the four entries in this
  // file are untouched. The two products answer different questions — Events answers "when
  // is it and who is coming", Gatherings answers "who is doing what, and has it been done
  // and accepted" — and unifying them would mean re-policying every `event_*` table, which
  // is the class of change "How migrations reach the hosted project" is a whole section of
  // AGENTS.md about. The rail lists both sets under one Events heading; that is a heading,
  // not a merge.
  //
  // ALL FIVE ARE FREE, AND THE TEMPLATE LIBRARY IS THE ONE SOMEBODY WILL WANT TO SELL. It
  // cannot be sold, and the reason is structural rather than generous: a gathering can only
  // be created FROM a template, so a family with no template library has no way to schedule
  // a gathering at all. `/pricing`'s Free plan already promises "The reunion on the
  // calendar" (`lib/plans.ts`), so putting the authoring screen behind Plus would make an
  // existing Free bullet false — which is the same reading `/admin/events` and
  // `/admin/event-types` were made Free under, recorded in the tier notes at the top of this
  // file. `/calendar` is that bullet said out loud: it IS the calendar it names.
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
  // the case the note on `TAB_RESOURCES` says to leave out, and `admin/users/templates`
  // remains the only key that earns a place there.
  {
    href: '/gatherings',
    label: 'Gatherings',
    status: 'live',
    tier: 'free',
    blurb: 'Family gatherings built from a template, with every task assigned and tracked.',
  },
  // MORE SPECIFIC THAN `/gatherings`, WHICH IS WHY IT NEEDS ITS OWN ENTRY. `getFeature()`
  // prefers the longest match, so this row is what answers for `/gatherings/my-tasks` while
  // `/gatherings/[id]` still inherits the row above. Both carry the same status and tier, so
  // nothing here turns on which one wins — what does turn on it is `viewableResources()`,
  // which needs the KEY `gatherings/my-tasks` in its answer or the rail item disappears for
  // everybody.
  {
    href: '/gatherings/my-tasks',
    label: 'My Gathering Tasks',
    status: 'live',
    tier: 'free',
    blurb: 'Every gathering task assigned to you, what to send back, and by when.',
  },
  {
    href: '/calendar',
    label: 'Calendar',
    status: 'live',
    tier: 'free',
    blurb: 'A real month grid with every gathering and event on the days it falls.',
  },

  // ── On the roadmap: accounting ──────────────────────────────────────────────
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
  {
    href: '/family-finances',
    label: 'Family Finances',
    status: 'future',
    tier: 'plus',
    blurb: 'Fund balances, contributions, and a clean profit-and-loss ledger.',
  },

  // ── On the roadmap: resources ───────────────────────────────────────────────
  {
    href: '/photos',
    label: 'Photos',
    status: 'future',
    tier: 'plus',
    blurb: 'A shared gallery for every gathering — upload, caption, and relive it.',
  },
  {
    href: '/documents',
    label: 'Documents',
    status: 'future',
    tier: 'plus',
    blurb: 'Bylaws, forms, meeting minutes, and family records in one shared place.',
  },
  {
    href: '/elections',
    label: 'Elections',
    status: 'future',
    tier: 'plus',
    blurb: 'Nominate, accept, and vote family-wide, with results tallied live.',
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  // The `/admin` entry covers every nested admin route by prefix; the specific
  // entries below exist so the Coming Soon screen can name the right tool.
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
  // longest-prefix-matches — so with no entry here `/admin/family` would resolve to the
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
    href: '/admin/family',
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
    href: '/admin/users',
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
    href: '/admin/approvals',
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
  {
    href: '/admin/chapters',
    label: 'Regions & Chapters',
    status: 'live',
    tier: 'plus',
    blurb: 'Organize a large family into regional chapters with scoped leadership.',
  },
  // The route is `/admin/boardpositions`, renamed from the old `/admin/user-roles`.
  // The permission resource key was renamed to match in 20260805000006 — requireView()
  // looks the page up by that key, so the path and the key have to stay in step. The
  // `user_roles` TABLE keeps its name; only the route and the resource key moved.
  //
  // Back on the roadmap. The page and its permission resource both still exist and are
  // wired correctly — only the status moved — so shipping it again is this one word.
  //
  // AND THAT SENTENCE IS NOW KNOWN TO BE OPTIMISTIC, which is the useful thing to record
  // here. Regions & Chapters was described the same way and it was not: its actions were
  // written before §3 and §4 and carried two cross-family deletes. The four board-position
  // actions live in `app/actions/admin/chapters.ts`, were gated on `admin/chapters` until
  // 2026-08-18 (the wrong key — `permission_table_map` points `family_roles` at
  // `admin/boardpositions`), and `deleteCustomRole` had no `family_code` conjunct at all.
  // Those are fixed and covered by tests/rls; what has NOT been done is reading this page
  // and its client with the same care. Do that before flipping the word.
  //
  // ITS DATA WAS EMPTY UNTIL 20260817000003. `family_roles`'s global rows — the 25 built-in
  // board positions — are seeded only by migrations, and `truncate_entire_database.sql` had
  // emptied them; the page rendered nothing, with no error anywhere. That reseed is what
  // makes shipping this possible at all.
  {
    href: '/admin/boardpositions',
    label: 'Board Positions',
    status: 'future',
    tier: 'plus',
    blurb: 'Assign officer roles and track who holds each seat.',
  },
  {
    href: '/admin/elections',
    label: 'Election Management',
    status: 'future',
    tier: 'plus',
    blurb: 'Open nominations, launch the ballot, and publish the results.',
  },
  // THERE IS NO `/admin/announcements` ENTRY, and its absence is deliberate rather than an
  // oversight. The route is deleted — page, client and permission resource
  // (20260813000000) — because it was a second screen answering the same question as
  // `/announcements`: post news, pin it, delete it. Everything it could do, the member
  // page now does under the same `announcements` key, gated per control by
  // `announcements:edit` and `announcements:delete`. A stale URL 404s, which is correct:
  // it is not a feature awaiting launch, it is a page that no longer exists — the same
  // treatment `/admin/groups` got in 20260807000000.
  //
  // Do not re-add it on the strength of the note that used to sit here about the rail. The
  // `Sidebar.tsx` `adminItems` entry went with it.
  {
    href: '/admin/reports',
    label: 'Reports',
    status: 'future',
    tier: 'plus',
    blurb: 'Membership, dues collected vs. outstanding, RSVP turnout, and t-shirt counts.',
  },
  // Both live with `/events` — see the note there for why the four move together, and for
  // the storage work that did NOT come with them.
  {
    href: '/admin/events',
    label: 'Event Management',
    status: 'live',
    tier: 'free',
    blurb: 'Build events, assign the to-do list, and run day-of check-in.',
  },
  {
    href: '/admin/event-types',
    label: 'Event Templates',
    status: 'live',
    tier: 'free',
    blurb: 'Reusable event blueprints that auto-assign the planning checklist.',
  },
  // The organizer half of Gatherings — see the long note beside `/gatherings` above for what
  // a gathering is, why Events keeps every one of its four routes, and why none of the five
  // new keys is a `TAB_RESOURCES` case. Both of these sit here rather than up there for the
  // same reason `/admin/events` and `/admin/event-types` do: this file groups by AUDIENCE,
  // and the member-facing rows are in the events block while the two admin rows are in the
  // admin block. They ship together and they have to — `/admin/gatherings` cannot schedule a
  // gathering that `/admin/gathering-templates` was not there to author, and `/gatherings`
  // cannot show one that nothing scheduled.
  {
    href: '/admin/gatherings',
    label: 'Gathering Management',
    status: 'live',
    tier: 'free',
    blurb: 'Schedule a gathering, set its budget, hand out the tasks, and rule on the answers.',
  },
  {
    href: '/admin/gathering-templates',
    label: 'Gathering Templates',
    status: 'live',
    tier: 'free',
    blurb: 'Reusable step-by-step lists that every gathering is built from.',
  },
  // Accounting is LIVE — it is where dues get set up: schedules, recorded
  // payments, and the funds those payments route into. The route stays
  // `/admin/account` because that string is also the permission resource key, wired
  // into RLS via permission_table_map. Only the display name changed.
  {
    href: '/admin/account',
    label: 'Accounting',
    status: 'live',
    tier: 'free',
    blurb: 'Dues schedules, funds, and payment routing for the whole family.',
  },
]

/** True when `pathname` is `href` itself or nested beneath it. */
function covers(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Resolve the feature owning `pathname`, preferring the most specific match so
 * `/admin/reports` reports Reports rather than the catch-all Admin Tools entry.
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
 * six `admin/account/*` sections are all reached through a page that has its own
 * entry — but not for one that can be a caller's ONLY reason to reach a page.
 *
 * `admin/users/templates` is that case. Members & Access opens for any of its three
 * tab grants (see the page), so someone holding Permission Templates and neither of
 * the other two has a working page and, without this, no link to it.
 *
 * `admin/approvals` is NOT here: it has a real FEATURES entry, because its path is a
 * redirect into the same page and the entry is what keeps that link working. Read the
 * note on it above before adding anything to either list.
 */
export const TAB_RESOURCES: readonly string[] = ['admin/users/templates']
