import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveLocale } from '@/lib/auth/locale'
import { requireViewOrPending, can, canAny } from '@/lib/auth/permissions'
import { PendingApproval } from '@/components/membership/PendingApproval'
import { FamilyRemoved } from '@/components/membership/FamilyRemoved'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyFamilies, getMyFamilyCode, isActiveFamily } from '@/lib/auth/family'
import { getMyRoles } from '@/app/actions/admin/users'
import { getLinkPersonBannerData } from '@/app/actions/link-person'
import { getAnnouncementFeed, getChapters } from '@/app/actions/announcements'
import { getMyDuesSummary, getFamilyDuesCollected, getDonationProgress } from '@/app/actions/dues'
import { getNotifications } from '@/app/actions/notifications'
import { getPendingApprovalCount } from '@/app/actions/admin/approvals'
import { formatRoleTitle } from '@/lib/role-utils'
import { LinkPersonBanner } from '@/components/dashboard/LinkPersonBanner'
import { LINK_EXISTING_PERSON_ENABLED } from '@/lib/feature-flags'
import { ChapterReminderBanner } from '@/components/dashboard/ChapterReminderBanner'
import { ProfileReminderBanner } from '@/components/dashboard/ProfileReminderBanner'
import { SafetyCheckInBanner } from '@/components/dashboard/SafetyCheckInBanner'
import { PlanSetupBanner } from '@/components/dashboard/PlanSetupBanner'
import { profileCompleteness } from '@/lib/profile-completeness'
import { familyShowsPhotos } from '@/lib/auth/tier'
import { DuesBalanceKpi } from '@/components/dues/DuesBalanceKpi'
import { PageShell } from '@/components/layout/PageShell'
import { WelcomeHero } from '@/components/dashboard/WelcomeHero'
import { AtAGlance } from '@/components/dashboard/AtAGlance'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { FamilyTreeCard } from '@/components/dashboard/FamilyTreeCard'
import { DonationDrivesCard } from '@/components/dashboard/DonationDrivesCard'
import { FamilyDuesCollectedCard } from '@/components/dashboard/FamilyDuesCollectedCard'
import { getFamilyTreeSummary } from '@/app/actions/family-tree'
import {
  getPremierGathering, getUpcomingGatheringCount, getMyGatheringTaskCount,
} from '@/app/actions/gatherings'
import { getMyActionableElection } from '@/app/actions/elections'
import { getSignupPlanPrompt } from '@/app/actions/billing'
import { anyPlatformBillingConfigured } from '@/lib/stripe/config'
import { PremierGatheringHero } from '@/components/dashboard/PremierGatheringHero'
import { RecentUpdates } from '@/components/dashboard/RecentUpdates'
import { mergeUpdates } from '@/components/dashboard/updates'
import {
  TILE_RESOURCE, QUICK_ACTION_GRANT, routeForGrant, DUES_COLLECTED_RESOURCE,
  ELECTION_ACTION_LABEL,
  type ResolvedTile, type ResolvedQuickAction,
} from '@/components/dashboard/tiles'
import { isFeatureLive } from '@/lib/features'

export const metadata = { title: 'Dashboard' }

/**
 * The member's landing screen, in the Golden Master's visual language.
 *
 * ── WHAT THIS PAGE IS NOT ────────────────────────────────────────────────────────────
 * The kit (`design/dashboard/v1_0/`) composes nine panels. Three of them are omitted here and
 * every omission is a fact about the product rather than a shortcut:
 *
 *   Upcoming Events (a row card)   There is no Events product any more (2026-08-19), so this
 *                                  one is not a panel nobody has written — it is a panel with
 *                                  nothing to draw. The nearest thing the data supports is a
 *                                  list of upcoming GATHERINGS, and the two surfaces that
 *                                  already answer it are the Upcoming Gatherings tile and the
 *                                  premier band below the greeting.
 *   Family hero photograph         No column, no bucket, no schema. The kit's own image
 *                                  is stock photography with the design burnt into it.
 *   Recent Activity (a feed)       No table records who did what. See RecentUpdates,
 *                                  which answers the question the data can answer.
 *
 * THE EVENT HERO WAS ON THAT LIST UNTIL 2026-08-19 AND IS NOW ON THE PAGE — the band this
 * file used to describe as "where they go" is filled, by `PremierGatheringHero`. What fills
 * it is a GATHERING rather than an event, and that is the substance of the change rather
 * than a substitution: Gatherings ships beside Events with a `gatherings.is_premier` flag
 * whose entire job is "put this across the top of the Dashboard", which is the fact the kit's
 * hero needed and the events schema never had. Everything else the kit draws in that band —
 * the eyebrow, the title, the date and place lines, the gold CTA pill and the hairline along
 * the swoop — is built. The photograph is not, for the reason the row above gives.
 *
 * The kit's fourth At a Glance tile landed with it, for the same reason: it is an olive
 * calendar chip over a count and a "View calendar" caption, and until there was something to
 * count there was nothing to put in it.
 *
 * FAMILY TREE HIGHLIGHTS WAS ON THAT LIST AND IS NOW ON THE PAGE. It was omitted on two
 * grounds — the tree was "the beta scaffold, no data behind it at all", and "nothing
 * computes a family-wide generation depth either" — and both expired on 2026-08-13 when
 * the tree became real and `summarizeTree` was written. That is the shape these omissions
 * are meant to have: a statement of what is missing, checked when the missing thing lands,
 * rather than a permanent absence nobody revisits. See `FamilyTreeCard`.
 *
 * Nothing renders a placeholder for the remaining three, and the policy outlived the
 * sentence that used to state it: "omitted entirely until Events ships, no placeholder, no
 * badge" was written when Events was gated, and Events has now shipped without these
 * panels arriving with it. The rule that survives is the useful half — the layout narrows
 * to what is real rather than advertising what is not, whatever the registry says about
 * the route.
 *
 * ONE PANEL DOES SWITCH ITSELF ON, and it is the model for how the rest should arrive:
 * `announcementsLive` below is read from the registry, so flipping `/community/announcements` to live
 * both un-gated the page and started fetching the pinned news for this screen. No edit here
 * was needed. That is what a panel wired to the registry looks like, and it is precisely
 * what the three rows above do not have.
 *
 * ── THE ORDER OF THIS FUNCTION IS THE SECURITY MODEL ─────────────────────────────────
 * Read top to bottom, it is: resolve the caller, refuse a pending one, resolve every
 * grant, and only then fetch. That sequence is the whole of AGENTS.md §5 on this screen
 * and it is easy to undo by accident, because the natural way to write a dashboard is one
 * big `Promise.all` followed by `{canSee && <Tile/>}`. That version leaks: props are
 * serialized into the RSC payload whether a component renders them or not, so a hidden
 * tile over a fetched number has already published the number.
 *
 * This page shipped a live instance of exactly that. The member count was fetched
 * unconditionally on the admin client and rendered inside `<Link href="/community/directory">` — so a
 * family that restricted its Member Directory still handed every member the exact
 * approved-member count, under a link that 404s. `canViewMembers` below is that hole
 * closed, and it is the reason the grants are resolved in their own `Promise.all` above
 * the data one rather than inline.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // The reader's language, for the shell strings and the relative-time captions below.
  const locale = await resolveLocale(user.id)

  // requireViewOrPending, not requireView: a pending member must be able to LAND
  // somewhere that tells them what is happening. The early return is above every fetch
  // below, and has to stay there — what follows is a family's roster count, its dues
  // total and its notification feed, and props reach the browser in the RSC payload
  // whether or not a component renders them. Returning after it would publish
  // everything this screen exists to withhold from somebody the family has not admitted.
  const gate = await requireViewOrPending(user.id, 'dashboard')
  if (gate.pending) return <PendingApproval membership={gate.membership} />

  // ── AND THE SECOND EARLY RETURN, FOR A FAMILY THAT HAS BEEN REMOVED ────────────────
  // Same position and same reasoning as the pending branch above it: ABOVE every fetch,
  // because what follows is the family's roster count, its dues total and its notification
  // feed, and props reach the browser in the RSC payload whether a component renders them
  // or not (AGENTS.md §5).
  //
  // It has to be here rather than in `requireViewOrPending`, and that is a real constraint
  // rather than a preference: 20260817000006 deliberately keeps the removal test out of
  // `auth_family_code()` (a conjunct there SKIPS to the next family instead of hiding this
  // one), so there is no database-side answer for a guard to mirror — enforcement is
  // app-layer by design, and this is the screen that does it. See `FamilyRemoved`.
  //
  // `getMyFamilies` is cache()d per request and the shell has already warmed it, so both
  // calls here are free.
  const myFamilies = await getMyFamilies(user.id)
  const viewing = myFamilies.find(f => f.isActive) ?? myFamilies[0]
  if (viewing && !isActiveFamily(viewing.familyStatus)) {
    return <FamilyRemoved membership={viewing} families={myFamilies} />
  }

  const firstName = user.user_metadata?.first_name || user.email?.split('@')[0] || 'Member'
  const lastName  = user.user_metadata?.last_name ?? ''
  const initials  = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()

  const familyCode = await getMyFamilyCode(user.id)
  const admin = createAdminClient()

  // ── Every grant, resolved BEFORE anything is fetched ────────────────────────────────
  // Two independent narrowings on each, exactly as the sidebar applies them: has the
  // feature shipped at all (lib/features.ts), and may THIS member view it (the
  // permission model). Either one false and the query below is never issued.
  const announcementsLive = isFeatureLive('/community/announcements')
  const [
    canViewMembers, canAddMember, canRecordPayment, canSendMessage, canViewTree,
    canViewDonations, canViewGatherings, canViewCalendar, mayViewUpdates,
    canViewMyTasks, canViewDuesCollected, canViewElections,
  ] = await Promise.all([
    isFeatureLive(routeForGrant(TILE_RESOURCE.members[0]))
      ? can(user.id, TILE_RESOURCE.members[0], 'view')
      : false,
    // `create`, not `view` — a button captioned with a verb promises the verb. See the
    // note on QUICK_ACTION_GRANT.
    isFeatureLive(routeForGrant(QUICK_ACTION_GRANT['add-member'].resource))
      ? can(user.id, QUICK_ACTION_GRANT['add-member'].resource, QUICK_ACTION_GRANT['add-member'].action)
      : false,
    // `canAny`, per AGENTS.md: recording money for somebody is not an "own" action, and
    // the row a member would own is the abuse case.
    isFeatureLive(routeForGrant(QUICK_ACTION_GRANT['record-payment'].resource))
      ? canAny(user.id, QUICK_ACTION_GRANT['record-payment'].resource, QUICK_ACTION_GRANT['record-payment'].action)
      : false,
    isFeatureLive(routeForGrant(QUICK_ACTION_GRANT['send-message'].resource))
      ? can(user.id, QUICK_ACTION_GRANT['send-message'].resource, QUICK_ACTION_GRANT['send-message'].action)
      : false,
    // The Family Tree card. `family-tree` is the key the page and every one of its actions
    // gate on, and 20260806000006 deliberately left it unregistered — so `can()` resolves
    // it to true for every approved member and a family cannot switch it off. That is
    // recorded in TODO.md as a decision to make rather than assumed here: the check is
    // written the same way every other one on this page is, so registering the resource
    // later starts narrowing this card without anybody having to remember it exists.
    isFeatureLive('/community/family-tree') ? can(user.id, 'community/family-tree', 'view') : false,
    // The Donation Drives card. It BORROWS the Donations screen's grant rather than
    // getting a `dashboard/*` key of its own — the rule in components/dashboard/tiles.ts,
    // which 20260806000006 settled: a dashboard panel is a pointer at a job that already
    // has a switch, and registering a second one gives an administrator two controls for
    // one thing that can disagree. Restrict /donations and this card goes with it.
    //
    // The key is `donations` since 20260815000000, which promoted My Summary's three
    // panes to screens; it was `account-summary/donations`, and the migration copied
    // every family's grant across, so nothing about who sees this card changed.
    isFeatureLive('/accounting/dues-and-donations')
      ? can(user.id, 'accounting/dues-and-donations', 'view')
      : false,
    // The premier gathering band. `gatherings` is the key `/gatherings` and every one of its
    // reads gate on, and the band's whole content is one row of that table — a title, a
    // location, dates and a task count — so it borrows that grant rather than getting a
    // `dashboard/*` key of its own (the rule in components/dashboard/tiles.ts).
    //
    // `can`, not `canAny`: `gatherings.created_by` is a real owner and the SELECT policy has
    // an `own_expr` for it, so a member who may only see the gatherings they created is
    // legitimately entitled to this band — and the policy, not this line, decides whether
    // the premier one is among them.
    isFeatureLive('/gatherings') ? can(user.id, 'gatherings', 'view') : false,
    // The "Upcoming Gatherings" tile. `calendar`, NOT `gatherings`, because the tile LEADS
    // to /calendar and a tile borrows the grant of its destination — offering a count under
    // a link to a screen this family has switched off would be a dead affordance. The figure
    // is narrowed a second time by the read below, which gates itself on `gatherings:view`.
    isFeatureLive(routeForGrant(TILE_RESOURCE.gatherings[0]))
      ? can(user.id, TILE_RESOURCE.gatherings[0], 'view')
      : false,
    // The "View all updates" link at the foot of the Recent Updates card. `/community/updates` is a
    // permissioned screen of its own (20260819000005), so the link is resolved rather than
    // rendered unconditionally — a link to a page that 404s is worse than no link, which is
    // exactly why the card carried a comment where the link is until that page existed.
    //
    // A GRANT AND NOT A FETCH, which is why it sits here and adds nothing below: the card
    // already has its rows. This decides whether it offers the archive.
    isFeatureLive('/community/updates') ? can(user.id, 'community/updates', 'view') : false,
    // THE "My Tasks" QUICK ACTION, which is the one entry on that row conditional on the
    // caller's own workload rather than only on a grant. Both halves are needed and this is
    // the cheap one: without the grant there is no button, and the COUNT below decides whether
    // there is anything to press it for. `can`, not `canAny` — scope 'own' is exactly what
    // that pane shows, so it is a complete reason to be offered the way in.
    isFeatureLive(routeForGrant(QUICK_ACTION_GRANT['my-gathering-tasks'].resource))
      ? can(user.id, QUICK_ACTION_GRANT['my-gathering-tasks'].resource, QUICK_ACTION_GRANT['my-gathering-tasks'].action)
      : false,
    // THE FAMILY'S COLLECTED-DUES WIDGET, which was the `dues` TILE until 2026-08-19. The keys
    // are unchanged — either ledger will do, mirroring the SELECT policy on `dues_payments` —
    // so nothing about who sees the figure moved with it. Resolved HERE rather than left to
    // the action's own gate for §5's reason: the point is not to run the query at all.
    Promise.all(
      DUES_COLLECTED_RESOURCE.map(key =>
        isFeatureLive(routeForGrant(key)) ? can(user.id, key, 'view') : false),
    ).then(answers => answers.some(Boolean)),
    // THE ELECTION QUICK ACTION. `view` on the member's own key — nominating and voting are
    // self-service, so `create` would hide the button from the whole family (see the note on
    // QUICK_ACTION_GRANT). `can`, not `canAny`: there is no own version of a ballot, and the
    // area rule rather than a scope is what decides whose election it is.
    //
    // §5: this is what stops the read below happening at all for a family that has switched
    // elections off. `/community/elections` is `tier: 'plus'`, so `isFeatureLive` is not the
    // whole roadmap gate here — the TIER is checked by the read, which resolves the caller's
    // elections through RLS and the area rule and answers null for anybody with none.
    isFeatureLive(routeForGrant(QUICK_ACTION_GRANT.election.resource))
      ? can(user.id, QUICK_ACTION_GRANT.election.resource, QUICK_ACTION_GRANT.election.action)
      : false,
  ])

  // ── The plan they chose at signup, if they are still owed the checkout ─────────────
  //
  // NO GRANT RESOLVED HERE, unlike everything above, and that is deliberate rather than an
  // omission: `getSignupPlanPrompt` opens with `requireEdit('admin/settings')` and answers
  // null for anybody who could not act on it, so the §5 narrowing is inside the action. It
  // returns one word or nothing, so there is nothing to withhold by not calling it.
  //
  // NOT TIER-GATED. It is a prompt to BUY a tier — asking whether the family's current plan
  // permits it would be exactly backwards.

  // ── Now fetch, and only what the answers above allow ────────────────────────────────
  const [
    myRoles, linkBannerData, announcements, duesSummary,
    notifications, memberCountResult, myPersonResult, chapters,
    pendingApprovals, duesCollectedCents, treeSummary, donations,
    premierGathering, upcomingGatheringCount, myTaskCount, actionableElection,
    signupPlan,
  ] = await Promise.all([
    getMyRoles(),
    // "Were you already added to the family?" — parked, see lib/feature-flags.ts.
    // Not fetched rather than fetched-and-hidden: the response is a roster of unlinked
    // people, and props are serialized into the RSC payload whether a component renders
    // them or not (AGENTS.md §5). The action refuses independently of this line.
    LINK_EXISTING_PERSON_ENABLED
      ? getLinkPersonBannerData()
      : Promise.resolve({ showBanner: false, unlinkedPeople: [] }),
    // Announcements are rows in Recent Updates now, not a banner of their own — see
    // components/dashboard/updates.ts. Still read from the registry rather than
    // unconditionally, so a family whose announcements feature is gated fetches nothing
    // rather than fetching and hiding (AGENTS.md §5).
    announcementsLive ? getAnnouncementFeed() : [],
    getMyDuesSummary(),
    getNotifications(),
    // The "Family Members" tile. THREE conditions, and none is decoration:
    //
    //   canViewMembers        — resolved above. Without it there is no query and no
    //                           number in the payload, which is the fix described in the
    //                           header comment.
    //   membership_status     — this runs on the ADMIN client, so no policy is filtering
    //                           it. Without the conjunct an applicant was counted as a
    //                           member of the family on the dashboard of EVERY member,
    //                           not just of the administrators who can see the queue.
    //                           Someone who has asked to join has not joined.
    //   family_code           — §3. The admin client bypasses RLS, so family isolation is
    //                           this line and nothing else.
    //
    // TWO CONJUNCTS CAME OFF ON 2026-08-13, and they came off for different reasons.
    // `is_minor` went with the column (20260813000006). `user_id IS NOT NULL` was
    // DELIBERATELY dropped: this tile answers "how big is this family", and a
    // grandfather recorded on the tree without an email address is a member of it. He
    // was invisible here while being listed in the Directory next door, so the two
    // screens disagreed about the size of the same family.
    //
    // `membership_status = 'approved'` is what still keeps applicants out, and it is
    // exactly the right conjunct to be left holding this. tg_person_stamp_membership_status
    // RETURNS EARLY for `user_id IS NULL` (20260806000011 §2), so a record entered by
    // somebody else is never stamped 'pending' — it keeps the column's 'approved' default,
    // which that migration's own comment says is there so these people "stay visible in
    // the directory". They are family records rather than memberships, and this tile counts
    // the family. An applicant, who does have a user_id, is still stamped and still
    // excluded.
    canViewMembers
      ? admin.from('people').select('id', { count: 'exact', head: true }).eq('family_code', familyCode).eq('membership_status', 'approved')
      : Promise.resolve(null),
    // The caller's own people row — chapter for the hero's location line, avatar for its
    // portrait. Both are per-family (one `people` row PER family), so this is scoped to
    // the family being viewed and not to the account. No grant: it is their own row, on
    // their own client, and RLS says so.
    // THE PROFILE FIELDS RIDE ALONG on the read that was already here, which is why this
    // feature costs no extra round trip. §5 does not bite: it is the caller's OWN row, on
    // their own client, and every column is one they can see on their own profile page.
    supabase.from('people').select('chapter_id, avatar_url, chapters(name), primary_phone, city, state, country, date_of_birth').eq('user_id', user.id).eq('family_code', familyCode).maybeSingle(),
    getChapters(),
    // The queue depth for the Pending Approval tile. Gated INSIDE the action on
    // admin/approvals:view, so a member who cannot work the queue gets 0 and the tile
    // never renders — the number is not fetched for them, not merely hidden.
    getPendingApprovalCount(),
    // Gated HERE as well as inside the action, since 2026-08-19 — §5's "not fetched rather
    // than fetched and hidden", applied to the one figure on this page that is the family's
    // income. The action returns null rather than 0 for anyone without a ledger grant (see
    // `getFamilyDuesCollected` on why 0 would have been a lie), so this line changes no
    // answer; what it changes is whether the query runs at all.
    canViewDuesCollected ? getFamilyDuesCollected() : Promise.resolve(null),
    // The tree's three figures. `null` for a caller who may not see it, so the card is
    // never rendered over numbers that were fetched anyway (§5) — the action refuses
    // independently, but "not fetched" and "fetched then hidden" are the distinction this
    // whole preamble exists to keep.
    //
    // Note this is NOT the same shape as `memberCountResult`: an empty tree is a real
    // answer that the card renders deliberately, so zero here means zero and only `null`
    // means "not entitled".
    canViewTree ? getFamilyTreeSummary() : Promise.resolve(null),
    // The family's open drives. NOT FETCHED without the grant rather than fetched and
    // hidden (§5): every row carries a label, a goal and how much the family has raised,
    // and props reach the browser in the RSC payload whether a component renders them or
    // not. The action gates independently — it reads the schedules through the user's
    // client, so a drive the caller is a beneficiary of never comes back at all — and
    // this line is what keeps the whole list out of the payload for somebody the family
    // has withheld Donations from.
    canViewDonations ? getDonationProgress() : Promise.resolve([]),
    // The premier gathering, for the band under the greeting. NOT FETCHED without the grant
    // rather than fetched and hidden (§5): the row carries a title, a location, dates and how
    // far the family has got with preparing it, and props reach the browser in the RSC
    // payload whether a component renders them or not.
    //
    // `null` is the ordinary answer and means "nothing to announce" as well as "not
    // entitled" — which is the one place on this page those two collapse, and they may,
    // because the band renders nothing either way. No placeholder, no badge.
    canViewGatherings ? getPremierGathering() : Promise.resolve(null),
    // The count behind the "Upcoming Gatherings" tile, gated on the CALENDAR grant because
    // that is where the tile leads. `canViewCalendar` here and `requireRead('gatherings/calendar')`
    // inside the action must stay the SAME key: gate the count on `gatherings` instead and
    // the guard refuses for a caller this line was willing to ask, answering 0 — which is
    // the value at which the tile is omitted, so "I could not count" would be rendered as
    // "there is nothing to show".
    //
    // THIS WAS A LIST READ FOR A COUNT until 2026-08-19 — `getGatherings()` filtered here by
    // `gatheringTiming` — which fetched every gathering's title, summary, location and task
    // statuses, and marshalled the lot, to render one integer. The action now counts in SQL
    // with `head: true`, and it reads the clock itself for the reason the old comment gave:
    // `gatheringTiming` takes `today` as a parameter (AGENTS.md §7b), so somebody has to say
    // when now is, and `todayLocal()` there is the same answer this page computed. The span
    // test is `getPremierGathering`'s verbatim and provably equals
    // `gatheringTiming(...) !== 'past'`, so the number did not change when it moved.
    canViewCalendar ? getUpcomingGatheringCount() : Promise.resolve(null),
    // How many gathering tasks are actually waiting on this member — `open` and `denied`
    // only, because an approved one is finished and a Quick Action that never goes away is
    // not a prompt. `getMyGatheringTaskCount` gates itself on `requireMember()` rather than
    // on a view grant (answering a task you were handed is self-service), so the grant above
    // is what decides whether the button may exist and this decides whether it should.
    canViewMyTasks ? getMyGatheringTaskCount() : Promise.resolve(0),
    // THE ELECTION QUICK ACTION's own read, and §5 is the whole reason it is conditional: the
    // answer names a ballot the caller may act in, and a title and an id reach the browser in
    // the RSC payload whether the chip renders or not. The action checks the same grant itself
    // (it is a public endpoint), so this line is about not asking rather than about safety.
    canViewElections ? getMyActionableElection() : Promise.resolve(null),
    // NO GRANT CONDITION, which every other line here has — `getSignupPlanPrompt` resolves
    // `admin/settings:edit` itself and returns one tier or null, so there is no roster and
    // no figure to withhold by not asking.
    //
    // WHAT IS CONDITIONAL IS WHETHER THIS DEPLOYMENT CAN TAKE A PAYMENT AT ALL, and it is
    // asked HERE rather than inside the action on purpose. A credential check inside a read
    // makes it answer null to everybody, which is perfectly isolated and therefore untestable
    // — `tests/rls` has no Stripe key, so the two cases covering that action would become
    // evidence about the key. Measured: it was written there first and the positive control
    // caught it on the first run. Skipping the CALL is the same §5 shape as every line above.
    anyPlatformBillingConfigured() ? getSignupPlanPrompt() : Promise.resolve(null),
  ])

  const memberCount = memberCountResult?.count ?? 0
  const myPersonData = myPersonResult.data as {
    chapter_id: string | null
    avatar_url: string | null
    chapters?: { name: string } | null
    primary_phone: string | null
    city: string | null
    state: string | null
    country: string | null
    date_of_birth: string | null
  } | null
  // ── PROFILE PICTURES ARE STANDARD (2026-08-22) ─────────────────────────────────────
  // Resolved once and used twice: the hero's portrait, and whether the completeness nudge is
  // allowed to ask for a photo at all. `familyShowsPhotos` is cached per request (it reads
  // `getMyFamilyTier`, which the layout has already warmed), so this costs nothing here.
  const showPhotos = await familyShowsPhotos(user.id)
  const heroAvatarUrl = showPhotos ? myPersonData?.avatar_url : null

  const myChapterId = myPersonData?.chapter_id ?? null
  const myChapterName = (myPersonData?.chapters as { name: string } | null)?.name ?? null
  const needsChapter = !myChapterId && chapters.length > 0

  // ── THE PROFILE NUDGE ──────────────────────────────────────────────────────────────
  // Derived here rather than in the banner so the PAGE decides whether to render it at all —
  // the same shape every tile on this screen follows. `profileCompleteness` is pure and takes
  // the row (AGENTS.md §7b), so the threshold and the field list are checkable under
  // `npm test` with no dashboard involved; the banner re-checks `shouldPrompt` itself, because
  // a banner that renders over a complete profile because a caller forgot the condition is
  // worse than one that occasionally renders nothing.
  //
  // A NULL ROW IS NOT PROMPTED, and the function is what decides that: no `people` row in this
  // family, or a read that failed, is not the same fact as an empty profile — greeting somebody
  // with "there is not much there yet" over a query that did not answer is §8 in a friendly
  // voice.
  // `showPhotos` is passed, not looked up: on a Free family "a photo" would sit in `missing`
  // forever, since the upload control is not rendered and the column is narrowed away. See
  // the note on `countPhoto`.
  const completeness = profileCompleteness(myPersonData, showPhotos)

  // ── This page no longer reads the clock ─────────────────────────────────────────────
  // It did, for exactly this count, and both the clock read and the span test moved into
  // `getUpcomingGatheringCount` with the arithmetic: "upcoming" is `!== 'past'`, so a
  // gathering happening TODAY counts, and a multi-day reunion counts on every day it covers.
  // `null` is still "not entitled" and is the one thing the action never returns.
  const upcomingGatherings = upcomingGatheringCount ?? 0

  // ── Compose the tiles from what actually resolved ───────────────────────────────────
  // A tile appears only if its value was fetched. `duesCollectedCents === null` and
  // `memberCountResult === null` are the two "not entitled" signals, and they are null
  // rather than 0 precisely so that this list can tell them apart from a real zero — a
  // family that has collected nothing this year is not the same as a member who may not
  // ask, and the tile must not say "$0.00" for the second one.
  const tiles: ResolvedTile[] = [
    ...(memberCountResult ? [{ id: 'members' as const, value: String(memberCount) }] : []),
    // NO `dues` TILE since 2026-08-19 — the family's collected total is `FamilyDuesCollectedCard`
    // in the narrow column now. `duesCollectedCents` is still `null` for "not entitled" and a
    // real number for zero, and that card makes the same distinction.

    // Only when somebody is actually waiting. A standing "0 pending" tile is a control
    // that never changes and a row of the grid spent on nothing.
    ...(pendingApprovals > 0 ? [{ id: 'approvals' as const, value: String(pendingApprovals) }] : []),
    // Same precedent, for the same reason: a permanent "0 upcoming" is a row of the grid
    // spent on nothing, and a family with no gathering on the books is the common case.
    // `upcomingGatheringCount === null` is "not entitled"; a real 0 is a family with nothing
    // on the books. Both omit the tile, which is why the action never returns null — the
    // distinction is kept by this page not calling it, not by the value it answers.
    ...(upcomingGatherings > 0 ? [{ id: 'gatherings' as const, value: String(upcomingGatherings) }] : []),
  ]

  const quickActions: ResolvedQuickAction[] = [
    // ── AN ELECTION OPEN FOR BUSINESS GOES FIRST ─────────────────────────────────────
    // Ahead of My Tasks, and the two are ordered by DEADLINE rather than by importance: a
    // gathering task can be answered late and an organizer will chase it, while a ballot
    // closes on its date and nothing reopens it. `getMyActionableElection` has already
    // narrowed this to the phases a member can act in and to the one closing soonest, so its
    // being non-null IS the reason to show it.
    //
    // The caption is what there is to do — "Nominate" or "Vote" — and the destination is that
    // one ballot rather than the list. Both are overrides on `QUICK_ACTION_META`, which is
    // what `ResolvedQuickAction` exists for.
    ...(actionableElection
      ? [{
        id: 'election' as const,
        label: ELECTION_ACTION_LABEL[actionableElection.phase],
        href: `/community/elections/${actionableElection.id}`,
      }]
      : []),
    // AHEAD OF THE THREE STANDING BUTTONS, and only when something is waiting. It comes
    // before them because it exists BECAUSE somebody is owed something by this member —
    // every one of those three is a job they MAY do, and this is one they have been asked to.
    // See the note on `QuickActionId`: it is deliberately conditional on the workload, unlike
    // the rail item, which is unconditional so a task handed out this morning can be found
    // this morning.
    //
    // IT WAS FIRST UNTIL 2026-08-21, and the election chip above it is the only thing that
    // outranks it: a task can be answered late and an organizer will chase it; a ballot
    // closes on its date and nothing reopens it.
    ...(canViewMyTasks && myTaskCount > 0 ? [{ id: 'my-gathering-tasks' as const }] : []),
    ...(canAddMember ? [{ id: 'add-member' as const }] : []),
    ...(canRecordPayment ? [{ id: 'record-payment' as const }] : []),
    ...(canSendMessage ? [{ id: 'send-message' as const }] : []),
  ]

  return (
    <PageShell className="space-y-6">
      {/* THE GREETING AND THE PREMIER BAND ARE ONE COMPOSITION, OR THE GREETING IS THE BAND.
          The Golden Master draws a single hero: the greeting on CREAM top-left, the family
          photograph cropped top-right, then the burgundy event band beneath with one swoop
          between them and a gold hairline along it. The repo could not have that while the
          event band was hypothetical — a cream greeting with nothing under it is three lines
          floating on the page, and the Heritage band is the screen's whole identity — so the
          greeting WAS the band.

          Now that there is a real band to sit above, the composition follows whether it is
          there. `ground="page"` puts the greeting on cream with the kit's crop beside it and
          the band's crest as the boundary; `ground="band"` is the standalone Heritage band
          every other member sees. `WelcomeHero`'s header carries the table.

          THE WRAPPER IS LOAD-BEARING AND IT IS NOT A LAYOUT DIV. `PageShell` is
          `space-y-6`, so as two siblings the greeting and the band would be 24px apart and the
          crest would read as a wave under an unrelated block of text rather than as the edge
          between them. Wrapped, they are ONE flow child and the boundary is the swoop, which
          is what the kit draws. Do not add a gap class here.

          ABOVE THE BANNER SLOT, deliberately. The banners below are each a thing this member
          has to DO about their own account, and they must not be pushed under an announcement
          about the family — a linked-person prompt buried below a reunion is how it gets
          missed, which is the same argument the banners' own comment makes about burying them
          under the metric tiles.

          The band renders for nobody most of the time: `premierGathering` is null both when
          the caller may not view gatherings and when no upcoming one is flagged — and in that
          case the greeting is the band, with no wrapper at all. */}
      {premierGathering ? (
        <div>
          <WelcomeHero
            firstName={firstName}
            initials={initials}
            avatarUrl={heroAvatarUrl}
            roles={myRoles.map(formatRoleTitle)}
            chapterName={myChapterName}
            photoUrl={premierGathering.photoUrl}
            ground="page"
          />
          <PremierGatheringHero gathering={premierGathering} />
        </div>
      ) : (
        <WelcomeHero
          firstName={firstName}
          initials={initials}
          avatarUrl={heroAvatarUrl}
          roles={myRoles.map(formatRoleTitle)}
          chapterName={myChapterName}
        />
      )}

      {/* AN EMERGENCY CHECK-IN OUTRANKS EVERY OTHER BANNER, so it goes first — above the
          linked-person prompt and above the profile nudge. Those are things a member should
          get round to; this is their family asking whether they are alive, and it is
          answerable in place with one tap.

          IT IS ALSO THE ONE SURFACE FOR ANSWERING THAT CANNOT BE SWITCHED OFF. `/dashboard`
          has no `permission_resources` row (20260806000006 removed the rows for the screens
          that are a member's own), so this reaches every approved member whatever the family
          has done to `community/safety-check-ins:view`. The policies' `self_expr` admits an
          addressed relative's own row at every scope, including none —
          `20260823000001`'s §10 argues why that redundancy is deliberate.

          It renders `null` for nobody most of the time: one filtered read that returns
          nothing for a member on no open check-in. */}
      <SafetyCheckInBanner />

      {/* Banners sit between the hero and the grid: each one is a thing this member has
          to do, and burying an action item under four metric tiles is how it gets
          missed. Each renders only when it applies, so the usual case is none. */}
      {linkBannerData.showBanner && (
        <LinkPersonBanner unlinkedPeople={linkBannerData.unlinkedPeople} />
      )}

      {/* FIRST IN THE MARKUP SINCE 2026-08-26, AND IT USED TO BE LAST. The old ordering was
          argued from the reader's side — the two banners below are things the MEMBER has not
          finished, this is a thing the FAMILY has not finished, and a payment prompt above
          "add a photograph to your profile" would make the product's first word to a new
          administrator a request for money.

          Right instinct, wrong reader. This renders ONLY for somebody who holds
          `admin/family:edit` and whose family recorded a paid plan at signup: they chose it,
          they are expecting to be charged, and finishing it is the thing they are most likely
          to have come looking for. Reported as: created a family on Standard, logged in, and
          was never reminded or directed to complete the payment. A prompt nobody notices is
          not restraint — see PlanSetupBanner.

          It is its own component and not a row in Recent Updates because it is not news —
          it is a decision waiting on somebody, and it goes away when they take it either
          way. */}
      {signupPlan && <PlanSetupBanner tier={signupPlan.tier} />}

      {/* BOTH OF THESE CAN SHOW AT ONCE, and the profile one goes first of the two: it is
          the broader ask, and the chapter picker below it is one of the things a member would
          otherwise go looking for on the profile page. Neither is dismissible in the same way
          — see ProfileReminderBanner on why this one has no X. */}
      <ProfileReminderBanner completeness={completeness} />
      {needsChapter && <ChapterReminderBanner chapters={chapters} />}

      {/* NO ANNOUNCEMENTS BANNER, since 2026-08-13, and its absence is the change rather
          than a deletion. Pinned news used to render here as its own card between the
          hero and the grid, with a per-BROWSER dismissal in localStorage. It is now
          rows at the top of Recent Updates, with a per-PERSON dismissal that follows the
          member across devices and can be undone. See components/dashboard/updates.ts. */}

      {/* THE COLUMN SPLIT IS 2:1, AND WHICH CARD GOES WHERE IS LOAD-BEARING.
          The Golden Master can afford a tall narrow column on the right because it has
          nine panels to distribute. This page has four, and two of them can vanish
          entirely — so the composition has to hold up when half of it is missing.

          The first arrangement put Recent Updates alone in the wide column and stacked
          the other three on the right. It measured fine and looked broken: a member with
          two notifications got one short card beside a 700px column of content, and the
          bottom-left two thirds of the screen were empty page.

          So the pairing is by WEIGHT rather than by the kit's positions. Each column
          gets two cards, and each column leads with the one that is always there:

            wide (2fr)    At a Glance — the figures, and the reason to open the page
                          Recent Updates — always renders, grows with the feed
            narrow (1fr)  Quick Actions — may be empty for a plain member
                          Remaining Balance — always renders, so this column never is

          Below `lg` it is one column in that same order, which puts the numbers first on
          a phone rather than a strip of buttons. */}
      {/* `min-w-0` ON BOTH COLUMNS IS NOT OPTIONAL — it is the fix for a real horizontal
          scroll, measured at 505px on a 390px screen before it was added.

          A grid item defaults to `min-width: auto`, which means it refuses to be narrower
          than its own min-content and stretches its track to fit. Recent Updates is full
          of `truncate` text, and `truncate` sets `white-space: nowrap` — so a notification
          body of "bravo.newcomer@rls.test has asked to join…" reported a min-content of
          ~489px and dragged the whole page sideways with it. The ellipsis never had a
          chance to appear, because the column simply grew instead.

          This is the same `min-w-0` on `<main>` in app/(protected)/layout.tsx, for the
          same reason. Any new column added here owes it too. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          {/* THE BALANCE AND THE DRIVES ARE INSIDE At a Glance since 2026-08-19, and both were
              in the narrow column beside it before. They are the two things on this screen
              about the reader's own standing with the family — what they owe, and what the
              family is asking them to give to — which is what "at a glance" is asking; under
              Quick Actions they competed with a strip of buttons for the same attention.

              `showViewLink` stays on, and it is still the ONE prop that may differ between
              this rendering and Summary's. The drives card renders nothing when none is open,
              so for most families most of the time this panel is the tiles and the balance.

              THEY SHARE A ROW SINCE 2026-08-22 — the panel lays its children out on the
              same `auto-fit` grid the tiles use, which is what makes the pair read as a pair
              and what lets the balance fill the row on its own when no drive is open. The
              order here is the order they appear in: what you owe, then what you are being
              asked to give. */}
          <AtAGlance tiles={tiles}>
            <DuesBalanceKpi summary={duesSummary} showViewLink />
            <DonationDrivesCard donations={donations} />
          </AtAGlance>
          {/* Merged and ordered on the server: pinned announcements first, then
              notifications and dismissed announcements interleaved by date. The rule is
              in `mergeUpdates` rather than in the component, because the ordering IS the
              feature — "pinned stays at the top, unpinned falls into natural order" —
              and it should be readable without a browser. */}
          <RecentUpdates
            locale={locale}
            items={mergeUpdates(notifications, announcements)}
            mayViewArchive={mayViewUpdates}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <QuickActions actions={quickActions} />
          {/* WHAT THE FAMILY HAS COLLECTED — the `dues` tile until 2026-08-19, and a widget of
              its own since. At a Glance is about the reader; this is the organisation's income
              to date, which is a treasurer's figure read deliberately rather than glanced at,
              and it was the one tile whose figure grew without bound and set the width of
              every tile beside it. It renders nothing at all when the caller holds neither
              ledger grant — `null` is "not entitled" and `0` is a real zero. */}
          <FamilyDuesCollectedCard collectedCents={duesCollectedCents} />
          {/* THE KIT'S "Family Tree Highlights", finally answerable — see the header of
              this file, which listed it among four omitted panels because the tree was a
              scaffold and nothing computed a generation depth. Both are now false.

              Last in the narrow column rather than first: the two cards above it are what
              a member has to DO (their quick actions, what they owe), and this is what
              their family IS. It renders whether or not the tree has anything in it, which
              is the one place it departs from every other card here, and the component
              says why. */}
          {treeSummary && <FamilyTreeCard summary={treeSummary} />}
        </div>
      </div>
    </PageShell>
  )
}
