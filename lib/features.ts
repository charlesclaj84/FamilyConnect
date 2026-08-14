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
    blurb: 'What you owe, what you have paid, and your full payment history.',
  },
  {
    href: '/transactions',
    label: 'Transactions',
    status: 'live',
    tier: 'free',
    blurb: 'Every payment, donation, contribution, disbursement and fund transfer the family has recorded.',
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

  // ── On the roadmap: accounting ──────────────────────────────────────────────
  // There is no `/dues` route and, since 20260808000001, no `dues` permission resource
  // either. Both halves of what it used to govern moved to the key of the screen that
  // actually asks the question:
  //
  //   dues_payments SELECT   -> transactions/dues-payments:view
  //                             OR transactions/donation-payments:view
  //                             ("may I see OTHER people's" — a Transactions question)
  //   dues_member_plans      -> nothing. Self-service; a member's own cadence and
  //                             opt-out, which no screen offers to set for anyone else.
  //
  // Both keep an unconditional `person_id = auth_person_id()` clause, which is what
  // makes My Summary own-only regardless of any grant. My Summary and Transactions are
  // two different screens answering two different questions and no longer share a key.
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
  {
    href: '/admin/chapters',
    label: 'Regions & Chapters',
    status: 'future',
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
